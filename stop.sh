#!/bin/bash
# 停止所有服务

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

echo "==> 停止后端..."
pkill -f 'uvicorn' 2>/dev/null || true

echo "==> 停止前端..."
pkill -f 'vite' 2>/dev/null || true

echo "==> 停止 Spark Jobs..."
pkill -f 'spark.jobs' 2>/dev/null || true

echo "==> 停止 Collectors..."
pkill -f 'bili_live' 2>/dev/null || true
pkill -f 'bili_video' 2>/dev/null || true

echo "==> Docker 中间件（不停止，如需停止: cd backend && docker compose down）..."
echo "    如需完全停止 Docker: cd ${BACKEND_DIR} && docker compose down"

echo "✅ 已停止所有本地服务"
