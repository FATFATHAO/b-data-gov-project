#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

echo "=========================================="
echo "  B-DataGov 一键启动"
echo "=========================================="

# ============================================================
# 1. 检查 .env 是否存在
# ============================================================
if [ ! -f "${BACKEND_DIR}/.env" ]; then
    echo "[WARN] ${BACKEND_DIR}/.env 不存在，复制 .env.example"
    cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
    echo "[WARN] 请编辑 ${BACKEND_DIR}/.env 填入 BILI_SESSDATA 等凭证"
fi

# ============================================================
# 2. 启动 Docker 中间件（PostgreSQL / Redis / Kafka）
# ============================================================
echo ""
echo "==> 1. 启动 Docker 中间件 (PostgreSQL / Redis / Kafka)..."
cd "${BACKEND_DIR}"
docker compose up -d
echo "    Docker 中间件已启动"

# ============================================================
# 3. 启动 Spark Jobs + Collectors
# ============================================================
echo ""
echo "==> 2. 启动 Spark Jobs 和 Collectors..."

# 加载 .env 中的环境变量供后续使用
set -a
source "${BACKEND_DIR}/.env"
set +a

# 后台启动 Spark Jobs（不使用 start_spark_jobs.sh，避免二次进程 fork）
PYTHON="${BACKEND_DIR}/.venv/bin/python"
LOG_DIR="${BACKEND_DIR}/logs/spark"
mkdir -p "${LOG_DIR}"

KAFKA_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-localhost:9092}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# 弹幕计数 Job
echo "    启动弹幕计数 Job..."
"${PYTHON}" -m spark.jobs.danmaku_count \
    --kafka "${KAFKA_SERVERS}" \
    --checkpoint "/tmp/spark-danmaku-count-checkpoint" \
    >> "${LOG_DIR}/danmaku_count.log" 2>&1 &

# 情感分析 Job
echo "    启动情感分析 Job..."
"${PYTHON}" -m spark.jobs.sentiment \
    --kafka "${KAFKA_SERVERS}" \
    --checkpoint "/tmp/spark-sentiment-checkpoint" \
    >> "${LOG_DIR}/sentiment.log" 2>&1 &

# 词云 Job
echo "    启动词云 Job..."
"${PYTHON}" -m spark.jobs.wordcloud \
    --kafka "${KAFKA_SERVERS}" \
    --checkpoint "/tmp/spark-wordcloud-checkpoint" \
    >> "${LOG_DIR}/wordcloud.log" 2>&1 &

# Redis Sink
echo "    启动 Redis Sink..."
"${PYTHON}" -m spark.sinks.redis_sink \
    --kafka "${KAFKA_SERVERS}" \
    --redis-host "${REDIS_HOST}" \
    --redis-port "${REDIS_PORT}" \
    --checkpoint "/tmp/spark-redis-sink-checkpoint" \
    >> "${LOG_DIR}/redis_sink.log" 2>&1 &

# B站直播 Collector（默认房间 732）
if [ -n "${BILI_SESSDATA}" ]; then
    echo "    启动 B站直播弹幕 Collector (房间: ${BILI_ROOM_ID:-732})..."
    "${PYTHON}" -m backend.collectors.bili_live_collector \
        --room-id "${BILI_ROOM_ID:-732}" \
        >> "${LOG_DIR}/bili_live.log" 2>&1 &
else
    echo "    [SKIP] B站直播 Collector: BILI_SESSDATA 未设置"
fi

# ============================================================
# 4. 启动后端 API
# ============================================================
echo ""
echo "==> 3. 启动后端 API (uvicorn :8000)..."
cd "${ROOT_DIR}"
"${ROOT_DIR}/backend/.venv/bin/uvicorn" backend.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    >> "${BACKEND_DIR}/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "    后端 PID: ${BACKEND_PID}"

# ============================================================
# 5. 启动前端
# ============================================================
echo ""
echo "==> 4. 启动前端 (vite :5173)..."
cd "${ROOT_DIR}/frontend"
pnpm dev --host 0.0.0.0 \
    >> "${BACKEND_DIR}/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "    前端 PID: ${FRONTEND_PID}"

# ============================================================
# 完成
# ============================================================
echo ""
echo "=========================================="
echo "  ✅ 所有服务已启动"
echo "=========================================="
echo "   Docker 中间件: docker compose -f ${BACKEND_DIR}/docker-compose.yaml logs"
echo "   后端 API:     http://localhost:8000"
echo "   前端页面:     http://localhost:5173"
echo "   Spark 日志:   ${LOG_DIR}/"
echo ""
echo "   如需停止所有服务: ./stop.sh 或 pkill -f 'uvicorn|spark|bili_live'"
echo ""

# 等待任意进程退出，Ctrl+C 时同时杀掉所有子进程
trap "echo '正在停止所有服务...'; pkill -f 'uvicorn' 2>/dev/null; pkill -f 'spark.jobs' 2>/dev/null; pkill -f 'bili_live' 2>/dev/null; pkill -f 'vite' 2>/dev/null; exit" SIGINT SIGTERM
wait
