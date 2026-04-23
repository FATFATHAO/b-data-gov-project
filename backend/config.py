"""
后端配置模块
集中管理所有环境变量配置，自动从 .env 文件加载
"""

import os
from pathlib import Path
from typing import Optional

# 尝试加载 python-dotenv
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

# ============================================================
# 路径配置
# ============================================================
# 项目根目录
ROOT_DIR = Path(__file__).parent.parent.resolve()
# backend 目录
BACKEND_DIR = Path(__file__).parent.resolve()

# .env 文件路径 (位于 backend/.env)
ENV_FILE = BACKEND_DIR / ".env"

# ============================================================
# 加载 .env 文件
# ============================================================
def _load_env():
    """加载 .env 文件中的环境变量"""
    if load_dotenv and ENV_FILE.exists():
        load_dotenv(ENV_FILE, override=True)
    elif load_dotenv is None:
        # python-dotenv 未安装，尝试手动加载
        if ENV_FILE.exists():
            with open(ENV_FILE) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, value = line.partition("=")
                        os.environ.setdefault(key.strip(), value.strip())

_load_env()

# ============================================================
# Kafka 配置
# ============================================================
KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_SERVERS: str = os.getenv("KAFKA_SERVERS", KAFKA_BOOTSTRAP_SERVERS)
DANMAKU_RAW_TOPIC: str = os.getenv("DANMAKU_RAW_TOPIC", "danmaku_raw")

# ============================================================
# Redis 配置
# ============================================================
REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))

# ============================================================
# 数据库配置
# ============================================================
DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")
DUCKDB_PATH: str = os.getenv("DUCKDB_PATH", "backend/data/b_data_gov.duckdb")

# ============================================================
# B站 API 凭证 (必需)
# ============================================================
BILI_SESSDATA: str = os.getenv("BILI_SESSDATA", "")
BILI_BILI_JCT: str = os.getenv("BILI_BILI_JCT", "")
BILI_BUVID3: str = os.getenv("BILI_BUVID3", "")
BILI_BUVID4: str = os.getenv("BILI_BUVID4", "")

# ============================================================
# Kafka Topic 配置
# ============================================================
DANMAKU_RAW_TOPIC: str = os.getenv("DANMAKU_RAW_TOPIC", "danmaku_raw")
DANMAKU_AGG_TOPIC: str = os.getenv("DANMAKU_AGG_TOPIC", "danmaku_agg")
DANMAKU_SENTIMENT_TOPIC: str = os.getenv("DANMAKU_SENTIMENT_TOPIC", "danmaku_sentiment")
DANMAKU_WORDCLOUD_TOPIC: str = os.getenv("DANMAKU_WORDCLOUD_TOPIC", "danmaku_wordcloud")

# Aliases for compatibility with redis_sink.py
KAFKA_AGG_TOPIC = DANMAKU_AGG_TOPIC
KAFKA_SENTIMENT_TOPIC = DANMAKU_SENTIMENT_TOPIC
KAFKA_WORDCLOUD_TOPIC = DANMAKU_WORDCLOUD_TOPIC

# ============================================================
# Collectors 采集器默认配置
# ============================================================
BILI_ROOM_ID: int = int(os.getenv("BILI_ROOM_ID", "732"))
BILI_BV_ID: Optional[str] = os.getenv("BILI_BV_ID")

# ============================================================
# Spark 配置
# ============================================================
SPARK_HOME: str = os.getenv("SPARK_HOME", "/opt/spark")

# ============================================================
# 辅助函数
# ============================================================

def is_bili_configured() -> bool:
    """检查 B站凭证是否已配置"""
    return bool(BILI_SESSDATA)

def require_bili_credential():
    """如果 B站凭证未配置，抛出 RuntimeError"""
    if not BILI_SESSDATA:
        raise RuntimeError(
            "未找到 BILI_SESSDATA 环境变量。\n"
            "请在 backend/.env 文件中设置 BILI_SESSDATA，或运行:\n"
            f"  cp {ENV_FILE}.example {ENV_FILE}\n"
            "然后编辑 .env 文件填入你的 B站凭证。"
        )
