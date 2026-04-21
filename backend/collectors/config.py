"""
弹幕采集器配置
"""

import os

# Kafka 配置
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
DANMAKU_RAW_TOPIC = "danmaku_raw"

# B站 API 凭证
BILI_SESSDATA = os.getenv("BILI_SESSDATA", "")
BILI_BILI_JCT = os.getenv("BILI_BILI_JCT", "")
BILI_BUVID3 = os.getenv("BILI_BUVID3", "")
BILI_BUVID4 = os.getenv("BILI_BUVID4", "")