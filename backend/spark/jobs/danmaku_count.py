"""
弹幕计数 Spark Job

从 Kafka 消费弹幕原始数据 (danmaku_raw)，进行计数，
输出聚合结果到 Kafka (danmaku_agg)。

统一采用滑动窗口持续输出实时热度（支持直播和视频）。

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


def run_danmaku_count(spark: SparkSession, kafka_bootstrap: str) -> None:
    """
    运行弹幕计数 Job

    统一使用滑动窗口持续输出实时热度（支持直播和视频）
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
        .filter(F.col("room_id") != "system_flush")
        .filter(F.col("ts").isNotNull())
        .withColumn("ts_ms", (F.col("ts") / 1000).cast("timestamp"))
    )

    # ============================================================
    # 统一滑动窗口处理 (包含直播和视频)
    # ============================================================
    windowed_df = (
        parsed_df
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

    output_df = (
        windowed_df
        .select(
            F.col("room_id"),
            F.col("count"),
            F.col("type"),
            F.col("window_start_str").alias("window_start"),
            F.col("window_end_str").alias("window_end"),
        )
    )

    # 输出到 Kafka
    query = (
        output_df
        .select(F.to_json(F.struct("*")).alias("value"))
        .writeStream
        .format("kafka")
        .option("kafka.bootstrap.servers", kafka_bootstrap)
        .option("topic", OUTPUT_TOPIC)
        .option("checkpointLocation", CHECKPOINT_DIR)
        .option("failOnDataLoss", "false")
        .outputMode("update")
        .start()
    )

    logger.info(f"Danmaku count job started with unified sliding window")
    query.awaitTermination()



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
