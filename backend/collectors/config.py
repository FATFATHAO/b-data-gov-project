"""
弹幕采集器配置
从后端统一配置模块导入所有配置
"""

from backend.config import (
    KAFKA_BOOTSTRAP_SERVERS,
    KAFKA_SERVERS,
    DANMAKU_RAW_TOPIC,
    BILI_SESSDATA,
    BILI_BILI_JCT,
    BILI_BUVID3,
    BILI_BUVID4,
)

__all__ = [
    "KAFKA_BOOTSTRAP_SERVERS",
    "KAFKA_SERVERS",
    "DANMAKU_RAW_TOPIC",
    "BILI_SESSDATA",
    "BILI_BILI_JCT",
    "BILI_BUVID3",
    "BILI_BUVID4",
]
