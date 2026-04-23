"""
Redis Sink 模块

从 Kafka 消费处理后的数据 (danmaku_agg, danmaku_sentiment, danmaku_wordcloud)，
批量写入 Redis。

功能：
- 消费多个 Kafka topic
- 批量写入 Redis (使用 Pipeline)
- 自动处理 TTL (直播数据 3600s，视频数据永久)

Redis 数据结构:
- current_hot_rooms (ZSET): 热门房间排行榜
- history:{room_id} (LIST): 弹幕数量趋势图
- wordcloud:{room_id} (STRING): 词云 JSON
- sentiment:{room_id} (LIST): 情感历史
- sentiment:current:{room_id} (STRING): 当前情感分数
- monitor:task_status (HASH): 任务状态
"""

import json
import logging
import sys
from typing import Optional, Dict, Any, List
from threading import Thread
from collections import defaultdict

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, FloatType, LongType

# 添加项目根目录到 path
_root = "/mnt/data/ArchLinux/Projects/b-data-gov-project"
if _root not in sys.path:
    sys.path.insert(0, _root)

from spark.spark_session import create_spark_session, stop_spark_session
from backend.config import KAFKA_BOOTSTRAP_SERVERS, REDIS_HOST, REDIS_PORT, DANMAKU_RAW_TOPIC, KAFKA_AGG_TOPIC, KAFKA_SENTIMENT_TOPIC, KAFKA_WORDCLOUD_TOPIC

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("spark_redis_sink")


# Kafka 配置
KAFKA_BOOTSTRAP_SERVERS = KAFKA_BOOTSTRAP_SERVERS
INPUT_TOPICS = f"{DANMAKU_RAW_TOPIC},{KAFKA_AGG_TOPIC},{KAFKA_SENTIMENT_TOPIC},{KAFKA_WORDCLOUD_TOPIC}"

# Redis 配置
REDIS_HOST = REDIS_HOST
REDIS_PORT = REDIS_PORT
REDIS_DB = 0
REDIS_PASSWORD: Optional[str] = None

# 批量写入配置
BATCH_SIZE = 200
FLUSH_INTERVAL_SEC = 0.5

# TTL 配置 (秒)
LIVE_TTL = 3600  # 直播数据 1 小时
VIDEO_TTL = 0     # 视频数据永久

# 检查点目录
CHECKPOINT_DIR = "/tmp/spark-redis-sink-checkpoint"


def get_agg_schema() -> StructType:
    """弹幕计数数据结构"""
    return StructType([
        StructField("room_id", StringType(), True),
        StructField("count", IntegerType(), True),
        StructField("type", StringType(), True),
        StructField("window_start", StringType(), True),
        StructField("window_end", StringType(), True),
    ])


def get_sentiment_schema() -> StructType:
    """情感分析数据结构"""
    return StructType([
        StructField("room_id", StringType(), True),
        StructField("type", StringType(), True),
        StructField("value", FloatType(), True),
        StructField("count", IntegerType(), True),
        StructField("window_start", StringType(), True),
        StructField("window_end", StringType(), True),
    ])


def get_wordcloud_schema() -> StructType:
    """词云数据结构"""
    return StructType([
        StructField("room_id", StringType(), True),
        StructField("type", StringType(), True),
        StructField("data", StringType(), True),  # JSON string
        StructField("window_start", StringType(), True),
    ])


class RedisWriter:
    """Redis 批量写入器"""

    def __init__(self, host: str, port: int, db: int, password: Optional[str] = None):
        """
        初始化 Redis 连接

        Args:
            host: Redis 主机
            port: Redis 端口
            db: Redis 数据库编号
            password: Redis 密码 (可选)
        """
        import redis

        self.pool = redis.ConnectionPool(
            host=host,
            port=port,
            db=db,
            password=password,
            decode_responses=True
        )
        self.batch: Dict[str, list] = defaultdict(list)
        self.lock = __import__("threading").Lock()

    def _get_ttl(self, room_id: str) -> int:
        """获取 TTL，直播 3600s，视频永久"""
        return LIVE_TTL if "_video" not in room_id else VIDEO_TTL

    def add_agg(self, room_id: str, count: int, ts: Optional[str] = None) -> None:
        """
        添加弹幕计数数据

        Args:
            room_id: 房间 ID
            count: 弹幕数量
            ts: 时间戳 (可选)
        """
        with self.lock:
            self.batch["agg"].append({
                "room_id": room_id,
                "count": count,
                "ts": ts
            })

    def add_sentiment(self, room_id: str, value: float, count: int) -> None:
        """
        添加情感分析数据

        Args:
            room_id: 房间 ID
            value: 情感分数
            count: 弹幕数量
        """
        with self.lock:
            self.batch["sentiment"].append({
                "room_id": room_id,
                "value": value,
                "count": count
            })

    def add_wordcloud(self, room_id: str, data: str) -> None:
        """
        添加词云数据

        Args:
            room_id: 房间 ID
            data: 词云 JSON 字符串
        """
        with self.lock:
            self.batch["wordcloud"].append({
                "room_id": room_id,
                "data": data
            })

    def flush(self) -> None:
        """批量写入 Redis"""
        with self.lock:
            if not self.batch:
                return

            import redis
            r = redis.Redis(connection_pool=self.pool)
            pipe = r.pipeline()

            for item in self.batch.get("agg", []):
                room_id = item["room_id"]
                ttl = self._get_ttl(room_id)

                # 更新热门房间排行榜
                pipe.zadd("current_hot_rooms", {room_id: item["count"]})

                # 更新历史趋势
                history_key = f"history:{room_id}"
                point = json.dumps({
                    "count": item["count"],
                    "ts": item.get("ts")
                })
                pipe.rpush(history_key, point)
                if ttl > 0:
                    pipe.expire(history_key, ttl)

            for item in self.batch.get("sentiment", []):
                room_id = item["room_id"]
                ttl = self._get_ttl(room_id)

                # 更新情感历史
                sent_key = f"sentiment:{room_id}"
                point = json.dumps({
                    "value": item["value"],
                    "count": item["count"]
                })
                pipe.rpush(sent_key, point)
                if ttl > 0:
                    pipe.expire(sent_key, ttl)

                # 更新当前情感分数
                current_key = f"sentiment:current:{room_id}"
                pipe.set(current_key, item["value"])
                if ttl > 0:
                    pipe.expire(current_key, ttl)

            for item in self.batch.get("wordcloud", []):
                room_id = item["room_id"]
                ttl = self._get_ttl(room_id)

                # 更新词云
                wc_key = f"wordcloud:{room_id}"
                pipe.set(wc_key, item["data"])
                if ttl > 0:
                    pipe.expire(wc_key, ttl)

            pipe.execute()
            self.batch.clear()

    def close(self) -> None:
        """关闭连接"""
        self.pool.disconnect()


def run_redis_sink(
    spark: SparkSession,
    kafka_bootstrap: str,
    redis_host: str = REDIS_HOST,
    redis_port: int = REDIS_PORT
) -> None:
    """
    运行 Redis Sink Job

    Args:
        spark: SparkSession 实例
        kafka_bootstrap: Kafka bootstrap servers
        redis_host: Redis 主机
        redis_port: Redis 端口
    """
    logger.info(f"Starting Redis sink, consuming from {INPUT_TOPICS}")

    writer = RedisWriter(
        host=redis_host,
        port=redis_port,
        db=REDIS_DB,
        password=REDIS_PASSWORD
    )

    # 从 Kafka 读取流数据
    kafka_df = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", kafka_bootstrap)
        .option("subscribe", INPUT_TOPICS)
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .load()
    )

    # 解析消息
    parsed_df = kafka_df.select(
        F.col("topic").alias("input_topic"),
        F.col("value").cast("string").alias("value_str"),
        F.col("timestamp").alias("event_time")
    )

    # 转换 agg 数据
    agg_schema = get_agg_schema()
    agg_df = (
        parsed_df
        .filter(F.col("input_topic") == "danmaku_agg")
        .select(
            F.from_json(F.col("value_str"), agg_schema).alias("data"),
            F.col("event_time")
        )
        .select("data.*", "event_time")
        .withColumn("ts_str", F.date_format(F.col("event_time"), "yyyy-MM-dd HH:mm:ss"))
    )

    # 转换 sentiment 数据
    sentiment_schema = get_sentiment_schema()
    sentiment_df = (
        parsed_df
        .filter(F.col("input_topic") == "danmaku_sentiment")
        .select(
            F.from_json(F.col("value_str"), sentiment_schema).alias("data")
        )
        .select("data.*")
    )

    # 转换 wordcloud 数据
    wordcloud_schema = get_wordcloud_schema()
    wordcloud_df = (
        parsed_df
        .filter(F.col("input_topic") == "danmaku_wordcloud")
        .select(
            F.from_json(F.col("value_str"), wordcloud_schema).alias("data")
        )
        .select("data.*")
    )

    # 注册 foreachBatch 写入 Redis
    def write_to_redis(batch_df, batch_id):
        if batch_df.isEmpty():
            return

        # 从 batch_df 重新解析 agg 数据
        agg_schema = get_agg_schema()
        try:
            agg_parsed = batch_df.filter(F.col("input_topic") == "danmaku_agg")
            agg_df2 = (
                agg_parsed.select(
                    F.from_json(F.col("value_str"), agg_schema).alias("data"),
                    F.col("event_time")
                )
                .select("data.*", F.col("event_time").alias("ts"))
                .withColumn("ts_str", F.date_format(F.col("ts"), "yyyy-MM-dd HH:mm:ss"))
            )
            for row in agg_df2.collect():
                try:
                    row_dict = row.asDict()
                    writer.add_agg(row_dict["room_id"], int(row_dict["count"]), row_dict.get("ts_str"))
                except Exception as e:
                    logger.warning(f"Failed to add agg: {e}")
        except Exception as e:
            logger.warning(f"Failed to parse agg: {e}")

        # 从 batch_df 重新解析 sentiment 数据
        sentiment_schema = get_sentiment_schema()
        try:
            sent_parsed = batch_df.filter(F.col("input_topic") == "danmaku_sentiment")
            sent_df2 = (
                sent_parsed.select(
                    F.from_json(F.col("value_str"), sentiment_schema).alias("data")
                )
                .select("data.*")
            )
            for row in sent_df2.collect():
                try:
                    row_dict = row.asDict()
                    writer.add_sentiment(row_dict["room_id"], float(row_dict["value"]), int(row_dict["count"]))
                except Exception as e:
                    logger.warning(f"Failed to add sentiment: {e}")
        except Exception as e:
            logger.warning(f"Failed to parse sentiment: {e}")

        # 从 batch_df 重新解析 wordcloud 数据
        wordcloud_schema = get_wordcloud_schema()
        try:
            wc_parsed = batch_df.filter(F.col("input_topic") == "danmaku_wordcloud")
            wc_df2 = (
                wc_parsed.select(
                    F.from_json(F.col("value_str"), wordcloud_schema).alias("data")
                )
                .select("data.*")
            )
            for row in wc_df2.collect():
                try:
                    row_dict = row.asDict()
                    writer.add_wordcloud(row_dict["room_id"], row_dict["data"])
                except Exception as e:
                    logger.warning(f"Failed to add wordcloud: {e}")
        except Exception as e:
            logger.warning(f"Failed to parse wordcloud: {e}")

        # 刷新到 Redis
        writer.flush()
        logger.info(f"Batch {batch_id} written to Redis")

    # 启动查询
    query = (
        parsed_df
        .writeStream
        .foreachBatch(write_to_redis)
        .option("checkpointLocation", CHECKPOINT_DIR)
        .outputMode("append")
        .start()
    )

    logger.info("Redis sink job started")
    query.awaitTermination()


def main() -> None:
    """主入口"""
    import argparse

    parser = argparse.ArgumentParser(description="Spark Redis Sink Job")
    parser.add_argument(
        "--kafka",
        type=str,
        default=KAFKA_BOOTSTRAP_SERVERS,
        help="Kafka bootstrap servers"
    )
    parser.add_argument(
        "--redis-host",
        type=str,
        default=REDIS_HOST,
        help="Redis host"
    )
    parser.add_argument(
        "--redis-port",
        type=int,
        default=REDIS_PORT,
        help="Redis port"
    )
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=CHECKPOINT_DIR,
        help="Checkpoint directory"
    )
    args = parser.parse_args()

    spark = create_spark_session(
        app_name="B-DataGov-RedisSink",
        checkpoint_dir=args.checkpoint
    )

    try:
        run_redis_sink(
            spark,
            args.kafka,
            redis_host=args.redis_host,
            redis_port=args.redis_port
        )
    except KeyboardInterrupt:
        logger.info("Job interrupted by user")
    except Exception as e:
        logger.error(f"Job failed with error: {e}", exc_info=True)
    finally:
        stop_spark_session(spark)


if __name__ == "__main__":
    main()
