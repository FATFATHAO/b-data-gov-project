"""
B站视频弹幕采集器
从B站视频获取弹幕XML，解析后按时间戳回放到Kafka

使用方式:
    python -m backend.collectors.bili_video_collector --bv-id BV1xx411c7mD --speed 2.0
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import logging
import xml.etree.ElementTree as ET

# 确保项目根目录在 sys.path
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from kafka import KafkaProducer
from bilibili_api import video as bili_video

from .config import KAFKA_BOOTSTRAP_SERVERS, DANMAKU_RAW_TOPIC

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("bili_video_collector")


def _safe_int(x: str, default: int = 0) -> int:
    """安全转整数"""
    try:
        return int(float(x))
    except (ValueError, TypeError):
        return default


def parse_xml(xml_text: str, room_id: str) -> list[dict]:
    """解析B站弹幕XML为字典列表"""
    root = ET.fromstring(xml_text)
    out = []
    for d in root.findall(".//d"):
        p = d.attrib.get("p", "").split(",")
        text = (d.text or "").strip()
        if not text:
            continue

        appear_s = float(p[0]) if len(p) > 0 else 0.0
        # 原始发送时间（秒），如果为0则用当前时间
        send_ts_s = p[4] if len(p) > 4 else "0"
        ts_ms = (_safe_int(send_ts_s) * 1000) if _safe_int(send_ts_s) > 0 else int(time.time() * 1000)

        out.append({
            "platform": "bilibili",
            "room_id": room_id,
            "user": {"id": p[6] if len(p) > 6 else "unknown", "name": None},
            "content": text,
            "event_type": "danmaku",
            "ts": ts_ms,
            "video_time": appear_s,
        })

    out.sort(key=lambda x: x["video_time"])
    return out


async def fetch_danmaku_xml(bv_id: str) -> tuple[str, str]:
    """
    获取B站视频弹幕XML
    返回: (xml_text, unique_room_id)
    """
    v = bili_video.Video(bvid=bv_id)
    pages = await v.get_pages()
    if not pages:
        raise Exception(f"未找到视频 {bv_id} 的分集信息")

    cid = pages[0]["cid"]
    logger.info(f"视频 {bv_id} CID: {cid}")

    xml_text = await v.get_danmaku_xml(cid=cid)
    unique_room_id = f"bilibili_video:{bv_id}"

    return xml_text, unique_room_id


def replay_to_kafka(danmaku_list: list[dict], kafka_servers: str, topic: str, speed: float = 1.0):
    """
    按视频时间戳回放弹幕到Kafka

    Args:
        danmaku_list: 弹幕列表
        kafka_servers: Kafka 服务器地址
        topic: Kafka topic
        speed: 回放倍速 (1.0 = 原速, 2.0 = 2倍速)
    """
    if not danmaku_list:
        logger.warning("弹幕列表为空，退出")
        return

    logger.info(f"连接Kafka: {kafka_servers}")
    producer = KafkaProducer(
        bootstrap_servers=kafka_servers,
        value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
    )

    room_id = danmaku_list[0].get("room_id", "unknown")
    logger.info(f"房间ID: {room_id}, 弹幕数: {len(danmaku_list)}, 倍速: {speed}")

    try:
        start_real_time = time.time()
        total = len(danmaku_list)

        for i, dm in enumerate(danmaku_list):
            video_time = dm.get("video_time", 0)
            target_ts = start_real_time + (video_time / speed)
            wait = target_ts - time.time()

            if wait > 0:
                time.sleep(wait)

            # 篡改时间戳为当前时间
            dm["ts"] = int(time.time() * 1000)

            producer.send(topic, value=dm, key=dm["room_id"])
            if (i + 1) % 50 == 0:
                logger.info(f"已发送 {i + 1}/{total}: {dm['content'][:30]}...")

        logger.info("重放完成")

        # 发送FLUSH信号强制关闭Spark窗口
        logger.info("发送FLUSH信号")
        flush_msg = {
            "platform": "system",
            "room_id": "system_flush",
            "user": {"id": "0", "name": "system"},
            "content": "FLUSH",
            "event_type": "danmaku",
            "ts": int(time.time() * 1000) + 60000,
        }
        producer.send(topic, value=flush_msg)

    except Exception as e:
        logger.error(f"重放过称出错: {e}")
    finally:
        producer.flush()
        producer.close()
        logger.info("Kafka producer 已关闭")


async def main():
    """主入口"""
    parser = argparse.ArgumentParser(description="B站视频弹幕采集器")
    parser.add_argument("--bv-id", required=True, help="B站视频BV号 (如: BV1xx411c7mD)")
    parser.add_argument("--speed", type=float, default=2.0, help="回放倍速 (默认: 2.0)")
    parser.add_argument("--kafka", default=KAFKA_BOOTSTRAP_SERVERS, help=f"Kafka服务器 (默认: {KAFKA_BOOTSTRAP_SERVERS})")
    parser.add_argument("--topic", default=DANMAKU_RAW_TOPIC, help=f"Kafka topic (默认: {DANMAKU_RAW_TOPIC})")

    args = parser.parse_args()

    logger.info(f"=" * 50)
    logger.info(f"B站视频弹幕采集 | BV: {args.bv_id} | 倍速: {args.speed}")
    logger.info(f"=" * 50)

    try:
        # 1. 获取弹幕XML
        logger.info("获取弹幕XML...")
        xml_text, room_id = await fetch_danmaku_xml(args.bv_id)

        # 2. 解析XML
        logger.info("解析弹幕...")
        danmaku_list = parse_xml(xml_text, room_id)
        logger.info(f"解析完成，共 {len(danmaku_list)} 条弹幕")

        # 3. 回放到Kafka
        replay_to_kafka(danmaku_list, args.kafka, args.topic, args.speed)

    except Exception as e:
        logger.error(f"采集失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())