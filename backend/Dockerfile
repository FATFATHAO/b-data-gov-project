FROM python:3.13-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制项目文件
COPY pyproject.toml uv.lock ./
# COPY backend/ ./backend/
COPY . .

# 安装 Python 依赖
RUN pip install uv && uv sync --frozen

# 设置工作目录
WORKDIR /app/backend

# 默认命令
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
