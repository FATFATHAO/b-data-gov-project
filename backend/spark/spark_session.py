"""
SparkSession 初始化模块

提供统一的 SparkSession 创建和管理功能。
"""

import os
from pathlib import Path
from typing import Optional
from pyspark.sql import SparkSession
from pyspark import SparkConf

# PySpark bundled Spark 根目录（SPARK_HOME 由启动脚本在运行时设置）
_PYSPARK_HOME = os.environ.get(
    "SPARK_HOME",
    str(Path(__file__).parent.parent / ".venv" / "lib" / "python3.13" / "site-packages" / "pyspark")
)


def create_spark_session(
    app_name: str = "B-DataGov-Spark",
    master: Optional[str] = None,
    checkpoint_dir: str = "/tmp/spark-checkpoint"
) -> SparkSession:
    """
    创建并配置 SparkSession

    Args:
        app_name: 应用名称
        master: Spark master URL (如 "local[2]", "spark://master:7077")
        checkpoint_dir: 检查点目录，用于保存 Streaming 进度

    Returns:
        配置好的 SparkSession 实例
    """
    conf = SparkConf()

    # PySpark 4.x + Scala 2.13 的 Kafka 连接器包
    conf.set("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.13:4.1.1")

    # Streaming 配置
    conf.set("spark.sql.streaming.checkpointLocation", checkpoint_dir)

    # Kafka 配置 (Structured Streaming)
    conf.set("spark.sql.streaming.kafka.pollIntervalMs", "100")
    conf.set("spark.sql.streaming.kafka.minPartitions", "1")

    # 内存配置
    conf.set("spark.driver.memory", "2g")
    conf.set("spark.executor.memory", "2g")

    # 序列化配置
    conf.set("spark.serializer", "org.apache.spark.serializer.KryoSerializer")

    # 禁用状态算子正确性检查（允许无界状态累积用于 top-n）
    conf.set("spark.sql.streaming.statefulOperator.checkCorrectness.enabled", "false")

    # Python 版本一致性配置
    venv_python = str(Path(__file__).parent.parent / ".venv" / "bin" / "python")
    conf.set("spark.pyspark.python", venv_python)
    conf.set("spark.pyspark.driver.python", venv_python)

    builder = SparkSession.builder.appName(app_name).config(conf=conf)

    if master:
        builder = builder.master(master)
    # master=None 时默认 local[*]

    spark = builder.getOrCreate()

    # 设置日志级别
    spark.sparkContext.setLogLevel("WARN")

    return spark


def stop_spark_session(spark: SparkSession) -> None:
    """
    停止 SparkSession

    Args:
        spark: 要停止的 SparkSession 实例
    """
    spark.stop()
