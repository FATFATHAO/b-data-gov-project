"""
词云 Spark Job

从 Kafka 消费弹幕原始数据 (danmaku_raw)，进行分词和词频统计，
按滑动窗口聚合后输出到 Kafka (danmaku_wordcloud)。

功能：
- 区分视频/直播流，使用不同窗口参数
- 视频: GlobalWindow 每5秒触发
- 直播: 5分钟窗口，5秒滑动步长
- 使用 Jieba 分词 + 停用词过滤

输入: Kafka topic "danmaku_raw"
输出: Kafka topic "danmaku_wordcloud"

数据格式 (danmaku_raw):
{
    "platform": "bilibili",
    "room_id": "bilibili_video:BVxxxx",
    "content": "弹幕内容",
    "ts": 1713000000000,
    ...
}

输出格式 (danmaku_wordcloud):
{
    "room_id": "bilibili_video:BVxxxx",
    "type": "wordcloud",
    "ts": 1713000000000,
    "data": [
        {"name": "弹幕", "value": 89},
        {"name": "主播", "value": 45},
        ...
    ]
}
"""

import json
import logging
import sys
from typing import Optional, List

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, LongType, IntegerType
from pyspark.sql.types import ArrayType

# 添加项目根目录到 path
_root = "/mnt/data/ArchLinux/Projects/b-data-gov-project"
if _root not in sys.path:
    sys.path.insert(0, _root)

from spark.spark_session import create_spark_session, stop_spark_session
from spark.utils.stopwords import filter_stopwords
from backend.config import KAFKA_BOOTSTRAP_SERVERS, DANMAKU_RAW_TOPIC, DANMAKU_WORDCLOUD_TOPIC

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("spark_wordcloud")


# Kafka 配置
KAFKA_BOOTSTRAP_SERVERS = KAFKA_BOOTSTRAP_SERVERS
INPUT_TOPIC = DANMAKU_RAW_TOPIC
OUTPUT_TOPIC = DANMAKU_WORDCLOUD_TOPIC

# 窗口配置 - 视频 (GlobalWindow 每5秒)
VIDEO_TRIGGER_INTERVAL = "5 seconds"

# 窗口配置 - 直播
LIVE_WINDOW_DURATION = "5 minutes"
LIVE_WINDOW_SLIDE = "5 seconds"

# Watermark 配置
WATERMARK_DELAY = "3 seconds"

# 词云 Top N
TOP_N_WORDS = 380

# 检查点目录
CHECKPOINT_DIR = "/tmp/spark-wordcloud-checkpoint"


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


# 注册分词 UDF
@F.udf(returnType=ArrayType(StringType()))
def tokenize_udf(text: str) -> List[str]:
    """
    分词 UDF (使用 Jieba)

    Args:
        text: 弹幕文本

    Returns:
        词列表
    """
    if not text:
        return []

    try:
        import jieba
        words = list(jieba.cut(text))
        # 过滤停用词和单字
        filtered = filter_stopwords(words)
        return filtered
    except Exception as e:
        logger.warning(f"Tokenize error: {e}")
        return []


def process_video_stream(spark: SparkSession, kafka_bootstrap: str) -> None:
    """
    处理视频弹幕流 (GlobalWindow 每5秒触发)

    Args:
        spark: SparkSession 实例
        kafka_bootstrap: Kafka bootstrap servers
    """
    logger.info(f"Processing video stream with GlobalWindow, trigger={VIDEO_TRIGGER_INTERVAL}")

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
        .filter(F.col("room_id").contains("_video"))  # 只处理视频
        .withColumn("ts_ms", (F.col("ts") / 1000).cast("timestamp"))
    )

    # 分词
    words_df = (
        parsed_df
        .withColumn("words", tokenize_udf(F.col("content")))
        .select(F.col("room_id"), F.col("ts"), F.explode(F.col("words")).alias("word"))
    )

    # 词频统计
    word_count_df = (
        words_df
        .groupBy(F.col("room_id"), F.col("word"))
        .agg(F.count("*").alias("count"))
    )

    # 按 room_id 分组，限制每个 room_id 最多 TOP_N_WORDS 条
    result_df = (
        words_df
        .groupBy(F.col("room_id"), F.col("word"))
        .agg(F.count("*").alias("count"))
        .groupBy(F.col("room_id"))
        .agg(
            F.slice(
                F.collect_list(F.struct(F.col("word").alias("name"), F.col("count").alias("value"))),
                1,
                TOP_N_WORDS
            ).alias("data")
        )
        .withColumn("type", F.lit("wordcloud"))
        .withColumn("ts", F.lit(0))
        .select(
            F.col("room_id"),
            F.col("type"),
            F.col("ts"),
            F.col("data")
        )
    )

    # 输出到 Kafka
    query = (
        result_df
        .select(
            F.col("room_id"),
            F.col("type"),
            F.col("ts"),
            F.to_json(F.col("data")).alias("data")
        )
        .select(F.to_json(F.struct("*")).alias("value"))
        .writeStream
        .format("kafka")
        .option("kafka.bootstrap.servers", kafka_bootstrap)
        .option("topic", OUTPUT_TOPIC)
        .option("checkpointLocation", f"{CHECKPOINT_DIR}/video")
        .option("failOnDataLoss", "false")
        .outputMode("complete")
        .start()
    )

    logger.info("Video wordcloud job started")
    return query


def process_live_stream(spark: SparkSession, kafka_bootstrap: str) -> None:
    """
    处理直播弹幕流 (滑动窗口)

    Args:
        spark: SparkSession 实例
        kafka_bootstrap: Kafka bootstrap servers
    """
    logger.info(f"Processing live stream: window={LIVE_WINDOW_DURATION}, slide={LIVE_WINDOW_SLIDE}")

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
        .filter(~F.col("room_id").contains("_video"))  # 只处理直播
        .withColumn("ts_ms", (F.col("ts") / 1000).cast("timestamp"))
    )

    # 分词
    words_df = (
        parsed_df
        .withColumn("words", tokenize_udf(F.col("content")))
        .select(
            F.col("room_id"),
            F.col("ts"),
            F.col("ts_ms"),
            F.explode(F.col("words")).alias("word")
        )
    )

    # 滑动窗口聚合
    windowed_df = (
        words_df
        .withWatermark("ts_ms", WATERMARK_DELAY)
        .groupBy(
            F.col("room_id"),
            F.col("word"),
            F.window(F.col("ts_ms"), LIVE_WINDOW_DURATION, LIVE_WINDOW_SLIDE)
        )
        .agg(F.count("*").alias("count"))
    )

    # 按 room_id 和 window 分组，限制每个分组最多 TOP_N_WORDS 条
    result_df = (
        windowed_df
        .groupBy(F.col("room_id"), F.col("window"))
        .agg(
            F.slice(
                F.collect_list(F.struct(F.col("word").alias("name"), F.col("count").alias("value"))),
                1,
                TOP_N_WORDS
            ).alias("data")
        )
        .withColumn("type", F.lit("wordcloud"))
        .withColumn(
            "window_start_str",
            F.date_format(F.col("window.start"), "yyyy-MM-dd'T'HH:mm:ss")
        )
        .select(
            F.col("room_id"),
            F.col("type"),
            F.lit(0).alias("ts"),
            F.col("data"),
            F.col("window_start_str").alias("window_start")
        )
    )

    # 输出到 Kafka
    query = (
        result_df
        .select(
            F.col("room_id"),
            F.col("type"),
            F.col("ts"),
            F.to_json(F.col("data")).alias("data"),
            F.col("window_start")
        )
        .select(F.to_json(F.struct("*")).alias("value"))
        .writeStream
        .format("kafka")
        .option("kafka.bootstrap.servers", kafka_bootstrap)
        .option("topic", OUTPUT_TOPIC)
        .option("checkpointLocation", f"{CHECKPOINT_DIR}/live")
        .option("failOnDataLoss", "false")
        .outputMode("update")
        .start()
    )

    logger.info("Live wordcloud job started")
    return query


def run_wordcloud(spark: SparkSession, kafka_bootstrap: str) -> None:
    """
    运行词云 Job (同时处理视频和直播流)

    Args:
        spark: SparkSession 实例
        kafka_bootstrap: Kafka bootstrap servers
    """
    logger.info("Starting wordcloud job")

    # 处理直播流
    live_query = process_live_stream(spark, kafka_bootstrap)

    # 等待所有查询终止
    from threading import Thread

    def await_query(q):
        q.awaitTermination()

    live_thread = Thread(target=await_query, args=(live_query,))
    live_thread.start()
    live_thread.join()


def main() -> None:
    """主入口"""
    import argparse

    parser = argparse.ArgumentParser(description="Spark Wordcloud Job")
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
        app_name="B-DataGov-Wordcloud",
        checkpoint_dir=args.checkpoint
    )

    try:
        run_wordcloud(spark, args.kafka)
    except KeyboardInterrupt:
        logger.info("Job interrupted by user")
    except Exception as e:
        logger.error(f"Job failed with error: {e}", exc_info=True)
    finally:
        stop_spark_session(spark)


if __name__ == "__main__":
    main()
