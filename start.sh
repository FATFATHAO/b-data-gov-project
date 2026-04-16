#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> 启动后端 (uvicorn :8000) ..."
# 从项目根目录运行，backend 作为模块加载
cd "$ROOT_DIR"
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "==> 启动前端 (vite :5173) ..."
cd "$ROOT_DIR/frontend"
pnpm dev --host 0.0.0.0 &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动"
echo "   后端 API: http://localhost:8000"
echo "   前端页面: http://localhost:5173"
echo "   按 Ctrl+C 停止所有服务"
echo ""

# 等待任意进程退出，Ctrl+C 时同时杀掉两个子进程
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
