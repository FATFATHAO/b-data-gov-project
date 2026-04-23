"""
弹幕计数 Spark Job

从 Kafka 消费弹幕原始数据 (danmaku_raw)，进行计数，
输出聚合结果到 Kafka (danmaku_agg)。

视频 vs 直播 区分处理：
- 视频 (room_id 含 "_video")：有限数据，监听 FLUSH 信号后一次性输出最终汇总
- 直播 (room_id 不含 "_video")：无限流，10秒窗口/1秒滑动步长持续输出

输入: Kafka topic "danmaku_raw"
输出: Kafka topic "danmaku_agg"

弹幕消息格式 (danmaku_raw):
{
    "platform": "bilibili",
    "room_id": "bilibili_video:BVxxxx",   # 视频
    "room_id": "bilibili_live:732",         # 直播
    "user": {"id": "xxx", "name": null},
    "content": "弹幕内容",
    "event_type": "danmaku",
    "ts": 1713000000000,
    "video_time": 12.5
}

FLUSH 信号 (回放结束时由 collector 发送):
{
    "platform": "system",
    "room_id": "system_flush",
    "content": "FLUSH",
    ...
}

输出格式 (danmaku_agg):
{
    "room_id": "bilibili_video:BVxxxx",
    "count": 156,
    "type": "agg",
    "window_start": "2024-01-01T12:00:00",
    "window_end": "2024-01-01T12:00:10"
}
"""

import json
import logging
import sys
import time
from collections import defaultdict
from typing import Dict, Optional

from pyspark.sql import SparkSession, DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, LongType
from pyspark.sql.types import TimestampType, IntegerType

# 添加项目根目录到 path
_root = "/mnt/data/ArchLinux/Projects/b-data-gov-project"
if _root not in sys.path:
    sys.path.insert(0, _root)

from spark.spark_session import create_spark_session, stop_spark_session
from backend.config import KAFKA_BOOTSTRAP_SERVERS, DANMAKU_RAW_TOPIC, DANMAKU_AGG_TOPIC

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("spark_danmaku_count")


# Kafka 配置
KAFKA_BOOTSTRAP_SERVERS = KAFKA_BOOTSTRAP_SERVERS
INPUT_TOPIC = DANMAKU_RAW_TOPIC
OUTPUT_TOPIC = DANMAKU_AGG_TOPIC

# 直播窗口配置
WINDOW_DURATION = "10 seconds"
WINDOW_SLIDE = "1 seconds"
WATERMARK_DELAY = "3 seconds"

# 检查点目录
CHECKPOINT_DIR = "/tmp/spark-danmaku-count-checkpoint"

# ============================================================
# 视频弹幕缓冲（跨批次累积）
# 结构: { room_id: accumulated_count }
# ============================================================
_video_buffer: Dict[str, int] = defaultdict(int)


def _is_video_room(room_id: str) -> bool:
    return room_id is not None and "_video" in room_id


def _is_flush(row: tuple) -> bool:
    """判断一行是否为 FLUSH 信号 (room_id = system_flush)"""
    # row 是 RawRow/dict，通过下标访问
    return isinstance(row, dict) and row.get("room_id") == "system_flush"


def get_danmaku_schema() -> StructType:
    """定义弹幕数据结构"""
    return StructType([
        StructField("platform", StringType(), True),
        StructField("room_id", StringType(), True),
        StructField("user", StructType([
            StructField("id", StringType(), True),
            StructField("name", StringType(), True),
        ]), True),
        StructField("content", StringType(), True),
        StructField("event_type", StringType(), True),
        StructField("ts", LongType(), True),  # 毫秒时间戳
        StructField("video_time", StringType(), True),
    ])


def _send_to_kafka(msg: str) -> None:
    """发送消息到 danmaku_agg topic"""
    from kafka import KafkaProducer
    from kafka.errors import KafkaError
    try:
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: v.encode("utf-8"),
        )
        future = producer.send(OUTPUT_TOPIC, value=msg)
        producer.flush()
        producer.close()
    except KafkaError as e:
        logger.error("Failed to send to Kafka: %s", e)


def process_video_batch(
    batch_df: DataFrame,
    batch_id: int,
    kafka_bootstrap: str,
) -> None:
    """
    处理视频微批次：监听 FLUSH 信号，累积弹幕计数，FLUSH 时输出最终结果

    Args:
        batch_df: 当前微批次的 DataFrame
        batch_id: 微批次 ID
        kafka_bootstrap: Kafka 服务器
    """
    global _video_buffer

    # 收集所有行（微批次数据量不大，视频弹幕有限）
    rows = batch_df.collect()

    if not rows:
        return

    # 找出所有 FLUSH 信号对应的视频 room_id
    # FLUSH 的 room_id = "system_flush"，但 content 携带目标 room_id
    # 例如 content = "FLUSH:bilibili_video:BVxxx"
    flush_target = None  # None = 全部输出，string = 指定房间
    has_general_flush = False
    danmaku_rows = []

    for row in rows:
        r = row.asDict() if hasattr(row, 'asDict') else dict(row)
        rid = r.get("room_id") or ""
        content = r.get("content") or ""

        if rid == "system_flush" and content.startswith("FLUSH:"):
            # 指定房间的 FLUSH:FLUSH:BVxxx
            flush_target = content.split(":", 1)[1]
            logger.info(f"检测到 FLUSH 信号 for room: {flush_target}")
            continue

        if rid == "system_flush":
            # 通用 FLUSH：所有缓冲中的视频房间都输出
            has_general_flush = True
            logger.info("检测到通用 FLUSH 信号，全部房间输出")
            continue

        # 视频弹幕：累加到缓冲
        if _is_video_room(rid):
            danmaku_rows.append(r)
        # 直播弹幕：不在这里处理（由 live_query 处理）

    # 累加弹幕到缓冲
    for r in danmaku_rows:
        rid = r.get("room_id")
        _video_buffer[rid] = _video_buffer.get(rid, 0) + 1

    # 输出逻辑（在循环结束后执行，只执行一次）
    if flush_target is not None:
        # 指定房间 FLUSH：只输出该房间
        count = _video_buffer.pop(flush_target, 0)
        if count > 0:
            msg = json.dumps({
                "room_id": flush_target,
                "count": count,
                "type": "agg",
                "window_start": "",
                "window_end": "",
            })
            _send_to_kafka(msg)
            logger.info(f"视频最终输出 room={flush_target}, count={count}")
    elif has_general_flush:
        # 通用 FLUSH：输出所有缓冲
        for rid, count in list(_video_buffer.items()):
            msg = json.dumps({
                "room_id": rid,
                "count": count,
                "type": "agg",
                "window_start": "",
                "window_end": "",
            })
            _send_to_kafka(msg)
            logger.info(f"视频最终输出 room={rid}, count={count}")
        _video_buffer.clear()

    # FLUSH 输出已在循环结束后执行


def run_danmaku_count(spark: SparkSession, kafka_bootstrap: str) -> None:
    """
    运行弹幕计数 Job

    视频: foreachBatch 累积 + FLUSH 触发输出
    直播: 滑动窗口持续输出
    """
    global OUTPUT_TOPIC

    logger.info(f"Starting danmaku count job, reading from {INPUT_TOPIC}")

    # 从 Kafka 读取流数据
    kafka_df = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", kafka_bootstrap)
        .option("subscribe", INPUT_TOPIC)
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .load()
    )

    # 解析 JSON 数据
    schema = get_danmaku_schema()
    parsed_df = (
        kafka_df
        .select(F.from_json(F.col("value").cast("string"), schema).alias("data"))
        .select("data.*")
        .filter(F.col("room_id").isNotNull())
        .filter(F.col("ts").isNotNull())
        .withColumn("ts_ms", (F.col("ts") / 1000).cast("timestamp"))
    )

    # ============================================================
    # 分支 1：直播弹幕 - 滑动窗口（保持原有逻辑）
    # ============================================================
    live_df = parsed_df.filter(~F.col("room_id").contains("_video"))

    live_windowed = (
        live_df
        .withWatermark("ts_ms", WATERMARK_DELAY)
        .groupBy(
            F.window(F.col("ts_ms"), WINDOW_DURATION, WINDOW_SLIDE),
            F.col("room_id")
        )
        .agg(
            F.count("*").alias("count"),
            F.min(F.col("ts_ms")).alias("window_start"),
            F.max(F.col("ts_ms")).alias("window_end")
        )
        .withColumn("type", F.lit("agg"))
        .withColumn(
            "window_start_str",
            F.date_format(F.col("window.start"), "yyyy-MM-dd'T'HH:mm:ss")
        )
        .withColumn(
            "window_end_str",
            F.date_format(F.col("window.end"), "yyyy-MM-dd'T'HH:mm:ss")
        )
    )

    live_output = (
        live_windowed
        .select(
            F.col("room_id"),
            F.col("count"),
            F.col("type"),
            F.col("window_start_str").alias("window_start"),
            F.col("window_end_str").alias("window_end"),
        )
    )

    # 直播输出到 Kafka
    live_query = (
        live_output
        .select(F.to_json(F.struct("*")).alias("value"))
        .writeStream
        .format("kafka")
        .option("kafka.bootstrap.servers", kafka_bootstrap)
        .option("topic", OUTPUT_TOPIC)
        .option("failOnDataLoss", "false")
        .outputMode("update")
        .start()
    )

    # ============================================================
    # 分支 2：视频弹幕 - foreachBatch 累积 + FLUSH 输出
    # ============================================================
    video_df = parsed_df.filter(F.col("room_id").contains("_video"))

    video_query = (
        video_df
        .writeStream
        .foreachBatch(lambda batch_df, batch_id:
            process_video_batch(batch_df, batch_id, kafka_bootstrap)
        )
        .outputMode("update")
        .start()
    )

    logger.info(f"Danmaku count job started, video and live queries running")
    live_query.awaitTermination()
    video_query.awaitTermination()


def main() -> None:
    """主入口"""
    import argparse

    parser = argparse.ArgumentParser(description="Spark Danmaku Count Job")
    parser.add_argument(
        "--kafka",
        type=str,
        default=KAFKA_BOOTSTRAP_SERVERS,
        help="Kafka bootstrap servers"
    )
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=CHECKPOINT_DIR,
        help="Checkpoint directory"
    )
    args = parser.parse_args()

    spark = create_spark_session(
        app_name="B-DataGov-DanmakuCount",
        checkpoint_dir=args.checkpoint
    )

    try:
        run_danmaku_count(spark, args.kafka)
    except KeyboardInterrupt:
        logger.info("Job interrupted by user")
    except Exception as e:
        logger.error(f"Job failed with error: {e}", exc_info=True)
    finally:
        stop_spark_session(spark)


if __name__ == "__main__":
    main()
