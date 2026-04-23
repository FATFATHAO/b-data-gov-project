"""
B站直播弹幕采集器
实时采集B站直播间的弹幕，发送到Kafka

使用方式:
    python -m backend.collectors.bili_live_collector --room-id 732
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import logging

# 确保项目根目录在 sys.path
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from kafka import KafkaProducer
from bilibili_api import live, Credential
from bilibili_api.utils.network import select_client

# 切换到 aiohttp 客户端，避免 curl-cffi 的 websocket segfault 问题
select_client("aiohttp")

from .config import KAFKA_BOOTSTRAP_SERVERS, DANMAKU_RAW_TOPIC, BILI_SESSDATA, BILI_BILI_JCT, BILI_BUVID3, BILI_BUVID4

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("bili_live_collector")


def _build_credential() -> Credential:
    """构建B站凭证"""
    if not BILI_SESSDATA:
        raise RuntimeError(
            "未找到 BILI_SESSDATA 环境变量。"
            "请先设置：export BILI_SESSDATA='your_sessdata_here'"
        )
    logger.info("SESSDATA 已加载（长度=%d）", len(BILI_SESSDATA))

    cred_kwargs = {"sessdata": BILI_SESSDATA}
    if BILI_BILI_JCT:
        cred_kwargs["bili_jct"] = BILI_BILI_JCT
        logger.info("BILI_JCT 已加载")
    if BILI_BUVID3:
        cred_kwargs["buvid3"] = BILI_BUVID3
        logger.info("BUVID3 已加载")
    if BILI_BUVID4:
        cred_kwargs["buvid4"] = BILI_BUVID4
        logger.info("BUVID4 已加载")

    return Credential(**cred_kwargs)


async def main():
    """主入口"""
    parser = argparse.ArgumentParser(description="B站直播弹幕采集器")
    parser.add_argument("--room-id", type=int, required=True, help="直播间ID (长号短号都可以)")
    parser.add_argument("--kafka", default=KAFKA_BOOTSTRAP_SERVERS, help=f"Kafka服务器 (默认: {KAFKA_BOOTSTRAP_SERVERS})")
    parser.add_argument("--topic", default=DANMAKU_RAW_TOPIC, help=f"Kafka topic (默认: {DANMAKU_RAW_TOPIC})")

    args = parser.parse_args()

    logger.info(f"=" * 50)
    logger.info(f"B站直播弹幕采集 | 房间: {args.room_id}")
    logger.info(f"Kafka: {args.kafka} | Topic: {args.topic}")
    logger.info(f"=" * 50)

    # 构建凭证
    credential = _build_credential()

    # 初始化Kafka producer
    logger.info(f"连接Kafka: {args.kafka}")
    producer = KafkaProducer(
        bootstrap_servers=args.kafka,
        value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
    )

    # 直播间ID格式
    room_id_str = f"bilibili_live:{args.room_id}"

    # 初始化直播弹幕连接
    room = live.LiveDanmaku(room_display_id=args.room_id, credential=credential)

    @room.on("DANMU_MSG")
    async def on_danmaku(event):
        """弹幕消息处理"""
        try:
            info = event["data"]["info"]
            message = {
                "platform": "bilibili",
                "room_id": room_id_str,
                "user": {
                    "id": info[0][7] if len(info[0]) > 7 else "unknown",  # user_hash
                    "name": info[2][1] if len(info[2]) > 1 else "unknown",  # user_name
                },
                "content": info[1],
                "event_type": "danmaku",
                "ts": int(time.time() * 1000),
            }

            producer.send(args.topic, value=message, key=room_id_str)
            logger.debug(f"发送弹幕: {message['user']['name']}: {message['content'][:30]}")

        except Exception as e:
            logger.error(f"处理弹幕出错: {e}")

    try:
        logger.info(f"正在连接直播间: {args.room_id}...")
        await room.connect()
        logger.info(f"已成功连接直播间: {args.room_id}")

        # 保持连接
        while True:
            await asyncio.sleep(1)

    except KeyboardInterrupt:
        logger.info("用户中断连接")
    except Exception as e:
        logger.error(f"直播连接中断: {e}")
    finally:
        producer.flush()
        producer.close()
        logger.info("Kafka producer 已关闭")


if __name__ == "__main__":
    asyncio.run(main())