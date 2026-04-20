"""
情感分析 Spark Job

从 Kafka 消费弹幕原始数据 (danmaku_raw)，进行情感分析，
按滑动窗口聚合后输出到 Kafka (danmaku_sentiment)。

功能：
- 区分视频/直播流，使用不同窗口参数
- 视频: 5分钟窗口，3秒滑动步长
- 直播: 1分钟窗口，2秒滑动步长
- 两层情感分析策略: 词典匹配 + SnowNLP 兜底

输入: Kafka topic "danmaku_raw"
输出: Kafka topic "danmaku_sentiment"

数据格式 (danmaku_raw):
{
    "platform": "bilibili",
    "room_id": "bilibili_video:BVxxxx",
    "content": "弹幕内容",
    "ts": 1713000000000,
    ...
}

输出格式 (danmaku_sentiment):
{
    "room_id": "bilibili_video:BVxxxx",
    "type": "sentiment",
    "value": 0.75,
    "count": 156,
    "window_start": "2024-01-01T12:00:00",
    "window_end": "2024-01-01T12:05:00"
}
"""

import json
import logging
import sys
from typing import Optional

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, LongType, FloatType

# 添加项目根目录到 path
_root = "/mnt/data/ArchLinux/Projects/b-data-gov-project/backend"
if _root not in sys.path:
    sys.path.insert(0, _root)

from spark.spark_session import create_spark_session, stop_spark_session
from spark.utils.sentiment_dict import analyze_sentiment, DICT_POS, DICT_NEG

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("spark_sentiment")


# Kafka 配置
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
INPUT_TOPIC = "danmaku_raw"
OUTPUT_TOPIC = "danmaku_sentiment"

# 窗口配置 - 视频
VIDEO_WINDOW_DURATION = "5 minutes"
VIDEO_WINDOW_SLIDE = "3 seconds"

# 窗口配置 - 直播
LIVE_WINDOW_DURATION = "1 minutes"
LIVE_WINDOW_SLIDE = "2 seconds"

# Watermark 配置
WATERMARK_DELAY = "3 seconds"

# 检查点目录
CHECKPOINT_DIR = "/tmp/spark-sentiment-checkpoint"


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
        StructField("ts", LongType(), True),
        StructField("video_time", StringType(), True),
    ])


# 注册情感分析 UDF
@F.udf(returnType=FloatType())
def sentiment_udf(text: str) -> float:
    """
    情感分析 UDF

    Args:
        text: 弹幕文本

    Returns:
        情感分数 (0.0-1.0)，-1.0 表示中性/无效
    """
    if not text:
        return -1.0
    return float(analyze_sentiment(text))


def process_stream(spark: SparkSession, kafka_bootstrap: str, is_video: bool) -> None:
    """
    处理数据流 (视频或直播)

    Args:
        spark: SparkSession 实例
        kafka_bootstrap: Kafka bootstrap servers
        is_video: True 表示视频流，False 表示直播流
    """
    window_dur = VIDEO_WINDOW_DURATION if is_video else LIVE_WINDOW_DURATION
    window_slide = VIDEO_WINDOW_SLIDE if is_video else LIVE_WINDOW_SLIDE
    stream_type = "video" if is_video else "live"

    logger.info(f"Processing {stream_type} stream: window={window_dur}, slide={window_slide}")

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
        .filter(F.col("content").isNotNull())
        .filter(F.col("ts").isNotNull())
        .withColumn("ts_ms", (F.col("ts") / 1000).cast("timestamp"))
    )

    # 根据 is_video 过滤
    if is_video:
        stream_df = parsed_df.filter(F.col("room_id").contains("_video"))
    else:
        stream_df = parsed_df.filter(~F.col("room_id").contains("_video"))

    # 添加情感分数列
    scored_df = stream_df.withColumn("sentiment_score", sentiment_udf(F.col("content")))

    # 过滤无效分数 (中性内容)
    valid_df = scored_df.filter(F.col("sentiment_score") >= 0)

    # 窗口聚合
    windowed_df = (
        valid_df
        .withWatermark("ts_ms", WATERMARK_DELAY)
        .groupBy(
            F.window(F.col("ts_ms"), window_dur, window_slide),
            F.col("room_id")
        )
        .agg(
            F.avg(F.col("sentiment_score")).alias("value"),
            F.count("*").alias("count"),
            F.min(F.col("ts_ms")).alias("window_start"),
            F.max(F.col("ts_ms")).alias("window_end")
        )
        .withColumn("type", F.lit("sentiment"))
        .withColumn("value", F.round(F.col("value"), 3))
        .withColumn(
            "window_start_str",
            F.date_format(F.col("window.start"), "yyyy-MM-dd'T'HH:mm:ss")
        )
        .withColumn(
            "window_end_str",
            F.date_format(F.col("window.end"), "yyyy-MM-dd'T'HH:mm:ss")
        )
    )

    # 准备输出数据
    output_df = (
        windowed_df
        .select(
            F.col("room_id"),
            F.col("type"),
            F.col("value"),
            F.col("count"),
            F.col("window_start_str").alias("window_start"),
            F.col("window_end_str").alias("window_end")
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
        .option("checkpointLocation", f"{CHECKPOINT_DIR}/{stream_type}")
        .option("failOnDataLoss", "false")
        .outputMode("update")
        .start()
    )

    logger.info(f"{stream_type.capitalize()} sentiment job started")
    return query


def run_sentiment(spark: SparkSession, kafka_bootstrap: str) -> None:
    """
    运行情感分析 Job (同时处理视频和直播流)

    Args:
        spark: SparkSession 实例
        kafka_bootstrap: Kafka bootstrap servers
    """
    logger.info("Starting sentiment analysis job")

    # 处理视频流
    video_query = process_stream(spark, kafka_bootstrap, is_video=True)

    # 处理直播流
    live_query = process_stream(spark, kafka_bootstrap, is_video=False)

    # 等待所有查询终止
    from threading import Thread

    def await_query(q):
        q.awaitTermination()

    video_thread = Thread(target=await_query, args=(video_query,))
    live_thread = Thread(target=await_query, args=(live_query,))

    video_thread.start()
    live_thread.start()

    video_thread.join()
    live_thread.join()


def main() -> None:
    """主入口"""
    import argparse

    parser = argparse.ArgumentParser(description="Spark Sentiment Analysis Job")
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
        app_name="B-DataGov-Sentiment",
        checkpoint_dir=args.checkpoint
    )

    try:
        run_sentiment(spark, args.kafka)
    except KeyboardInterrupt:
        logger.info("Job interrupted by user")
    except Exception as e:
        logger.error(f"Job failed with error: {e}", exc_info=True)
    finally:
        stop_spark_session(spark)


if __name__ == "__main__":
    main()
