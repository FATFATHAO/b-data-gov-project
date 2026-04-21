#!/bin/bash
# Spark Jobs + Collectors 启动脚本
# 用法: ./start_spark_jobs.sh [job_name]
#   - 不带参数: 启动所有 Jobs
#   - 带参数: 启动指定 Job (danmaku_count, sentiment, wordcloud, redis_sink)
#             或 Collector (bili_live, bili_video)

set -e

# 配置
BACKEND_DIR="/mnt/data/ArchLinux/Projects/b-data-gov-project/backend"
SPARK_HOME="${SPARK_HOME:-/opt/spark}"
KAFKA_SERVERS="${KAFKA_SERVERS:-localhost:9092}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
BILI_ROOM_ID="${BILI_ROOM_ID:-732}"
BILI_BV_ID="${BILI_BV_ID:-}"

# PySpark 参数
PYTHON_PATH="${BACKEND_DIR}:${BACKEND_DIR}/spark/jobs:${BACKEND_DIR}/spark/utils:${BACKEND_DIR}/spark/sinks"
SPARK_PACKAGES="org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0"

# Python 解释器
PYTHON="${BACKEND_DIR}/.venv/bin/python"

# 日志目录
LOG_DIR="${BACKEND_DIR}/logs/spark"
mkdir -p "${LOG_DIR}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."

    # 检查 Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python3 未安装"
        exit 1
    fi

    # 检查 PySpark
    if ! python3 -c "import pyspark" 2>/dev/null; then
        log_warn "PySpark 未安装，正在安装..."
        pip install pyspark==3.5.0
    fi

    # 检查 Kafka
    if ! command -v kafka-console-consumer &> /dev/null; then
        log_warn "Kafka 工具未安装"
    fi

    # 检查 Redis
    if ! command -v redis-cli &> /dev/null; then
        log_warn "Redis CLI 未安装"
    fi

    log_info "依赖检查完成"
}

# 启动弹幕计数 Job
start_danmaku_count() {
    log_info "启动弹幕计数 Job..."
    "${PYTHON}" -m spark.jobs.danmaku_count \
        --kafka "${KAFKA_SERVERS}" \
        --checkpoint "/tmp/spark-danmaku-count-checkpoint" \
        >> "${LOG_DIR}/danmaku_count.log" 2>&1 &
    echo $!
}

# 启动情感分析 Job
start_sentiment() {
    log_info "启动情感分析 Job..."
    "${PYTHON}" -m spark.jobs.sentiment \
        --kafka "${KAFKA_SERVERS}" \
        --checkpoint "/tmp/spark-sentiment-checkpoint" \
        >> "${LOG_DIR}/sentiment.log" 2>&1 &
    echo $!
}

# 启动词云 Job
start_wordcloud() {
    log_info "启动词云 Job..."
    "${PYTHON}" -m spark.jobs.wordcloud \
        --kafka "${KAFKA_SERVERS}" \
        --checkpoint "/tmp/spark-wordcloud-checkpoint" \
        >> "${LOG_DIR}/wordcloud.log" 2>&1 &
    echo $!
}

# 启动 Redis Sink Job
start_redis_sink() {
    log_info "启动 Redis Sink Job..."
    "${PYTHON}" -m spark.sinks.redis_sink \
        --kafka "${KAFKA_SERVERS}" \
        --redis-host "${REDIS_HOST}" \
        --redis-port "${REDIS_PORT}" \
        --checkpoint "/tmp/spark-redis-sink-checkpoint" \
        >> "${LOG_DIR}/redis_sink.log" 2>&1 &
    echo $!
}

# 启动 B站直播弹幕 Collector
start_bili_live() {
    log_info "启动 B站直播弹幕 Collector (房间: ${BILI_ROOM_ID})..."
    "${PYTHON}" -m backend.collectors.bili_live_collector \
        --room-id "${BILI_ROOM_ID}" \
        --kafka "${KAFKA_SERVERS}" \
        >> "${LOG_DIR}/bili_live.log" 2>&1 &
    echo $!
}

# 启动 B站视频弹幕 Collector
start_bili_video() {
    if [ -z "${BILI_BV_ID}" ]; then
        log_error "BILI_BV_ID 未设置，无法启动视频弹幕 Collector"
        return 1
    fi
    log_info "启动 B站视频弹幕 Collector (BV: ${BILI_BV_ID})..."
    "${PYTHON}" -m backend.collectors.bili_video_collector \
        --bv-id "${BILI_BV_ID}" \
        --kafka "${KAFKA_SERVERS}" \
        >> "${LOG_DIR}/bili_video.log" 2>&1 &
    echo $!
}

# 停止所有 Jobs
stop_all() {
    log_info "停止所有 Spark Jobs 和 Collectors..."
    pids=$(ps aux | grep -E "spark\.(jobs|sinks)|backend\.collectors" | grep -v grep | awk '{print $2}')
    if [ -n "$pids" ]; then
        kill $pids 2>/dev/null || true
        log_info "已发送停止信号"
    else
        log_info "没有运行的 Jobs 或 Collectors"
    fi
}

# 查看状态
status() {
    log_info "Spark Jobs 和 Collectors 状态:"
    ps aux | grep -E "spark\.(jobs|sinks)|backend\.collectors" | grep -v grep || log_info "没有运行的进程"
}

# 主函数
main() {
    check_dependencies

    case "${1:-all}" in
        danmaku_count)
            start_danmaku_count
            ;;
        sentiment)
            start_sentiment
            ;;
        wordcloud)
            start_wordcloud
            ;;
        redis_sink)
            start_redis_sink
            ;;
        bili_live)
            start_bili_live
            ;;
        bili_video)
            start_bili_video
            ;;
        stop)
            stop_all
            ;;
        status)
            status
            ;;
        all)
            log_info "启动所有 Spark Jobs..."

            log_info "注意: 请确保 Kafka 和 Redis 已启动"
            log_info "  Kafka: ${KAFKA_SERVERS}"
            log_info "  Redis: ${REDIS_HOST}:${REDIS_PORT}"

            start_danmaku_count
            sleep 2
            start_sentiment
            sleep 2
            start_wordcloud
            sleep 2
            start_redis_sink

            log_info "所有 Jobs 已启动"
            log_info "日志目录: ${LOG_DIR}"
            log_info "使用 'ps aux | grep spark.jobs' 查看状态"
            ;;
        *)
            echo "用法: $0 {all|danmaku_count|sentiment|wordcloud|redis_sink|bili_live|bili_video|stop|status}"
            echo ""
            echo "  Spark Jobs:"
            echo "    danmaku_count - 启动弹幕计数 Job"
            echo "    sentiment     - 启动情感分析 Job"
            echo "    wordcloud     - 启动词云 Job"
            echo "    redis_sink    - 启动 Redis Sink Job"
            echo ""
            echo "  Collectors:"
            echo "    bili_live     - 启动 B站直播弹幕 Collector"
            echo "    bili_video   - 启动 B站视频弹幕 Collector"
            echo ""
            echo "  控制命令:"
            echo "    stop          - 停止所有 Jobs"
            echo "    status        - 查看状态"
            echo ""
            echo "  环境变量:"
            echo "    KAFKA_SERVERS - Kafka 服务器 (默认: localhost:9092)"
            echo "    BILI_ROOM_ID   - B站直播间ID (默认: 732)"
            echo "    BILI_BV_ID     - B站视频BV号 (用于 bili_video)"
            exit 1
            ;;
    esac
}

main "$@"
