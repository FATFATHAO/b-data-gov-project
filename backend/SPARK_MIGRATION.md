# Flink → Spark 迁移完成文档

> 更新日期: 2026-04-19

## 一、迁移概述

本次迁移将 HRBUST 项目的 Flink 实时处理架构替换为 Spark Structured Streaming，保持相同的数据处理逻辑。

### 架构对比

**原 Flink 架构:**
```
Collector → Kafka → Flink Jobs → Redis
```

**新 Spark 架构:**
```
Collector → Kafka → Spark Structured Streaming → Redis
```

## 二、项目结构

```
backend/
├── spark/                          # Spark 模块 (新增)
│   ├── __init__.py
│   ├── spark_session.py             # SparkSession 初始化
│   ├── jobs/                        # Spark Jobs
│   │   ├── __init__.py
│   │   ├── danmaku_count.py         # 弹幕计数 Job
│   │   ├── sentiment.py              # 情感分析 Job
│   │   └── wordcloud.py            # 词云 Job
│   ├── sinks/                       # 输出 Sink
│   │   ├── __init__.py
│   │   └── redis_sink.py           # Redis Sink
│   └── utils/                       # 工具模块
│       ├── __init__.py
│       ├── sentiment_dict.py         # 情感词典
│       └── stopwords.py             # 停用词表
├── start_spark_jobs.sh               # 启动脚本 (新增)
└── pyproject.toml                   # 依赖更新
```

## 三、Spark Jobs 详情

### 3.1 弹幕计数 Job (`danmaku_count.py`)

| 配置 | 值 |
|------|-----|
| 输入 | Kafka topic `danmaku_raw` |
| 输出 | Kafka topic `danmaku_agg` |
| 窗口 | 10秒窗口，1秒滑动步长 |
| Watermark | 3秒乱序容忍 |

**功能:**
- 按 room_id 分组统计弹幕数量
- 滑动窗口聚合

### 3.2 情感分析 Job (`sentiment.py`)

| 配置 | 视频流 | 直播流 |
|------|--------|--------|
| 窗口 | 5分钟/3秒滑动 | 1分钟/2秒滑动 |
| Watermark | 3秒 | 3秒 |

**功能:**
- 两层情感分析策略: 词典匹配 + SnowNLP 兜底
- 区分视频/直播使用不同窗口参数

### 3.3 词云 Job (`wordcloud.py`)

| 配置 | 视频流 | 直播流 |
|------|--------|--------|
| 窗口 | GlobalWindow/5秒触发 | 5分钟/5秒滑动 |
| Watermark | 3秒 | 3秒 |

**功能:**
- Jieba 分词
- 停用词过滤
- Top 380 词输出

### 3.4 Redis Sink (`redis_sink.py`)

| 功能 | 说明 |
|------|------|
| 消费 Topics | `danmaku_agg`, `danmaku_sentiment`, `danmaku_wordcloud` |
| 批量写入 | Pipeline 批量提交 |
| TTL | 直播 3600s，视频永久 |

**Redis 数据结构:**
- `current_hot_rooms` (ZSET): 热门房间排行榜
- `history:{room_id}` (LIST): 弹幕数量趋势图
- `wordcloud:{room_id}` (STRING): 词云 JSON
- `sentiment:{room_id}` (LIST): 情感历史
- `sentiment:current:{room_id}` (STRING): 当前情感分数

## 四、依赖更新

### pyproject.toml 新增依赖

```toml
[project]
dependencies = [
    # ... 原有依赖 ...
    "pyspark>=3.5.0",
    "redis>=5.0.0",
    "jieba>=0.42.1",
    "snownlp>=0.12.2",
]
```

## 五、使用方法

### 5.1 安装依赖

```bash
cd backend
uv sync
```

### 5.2 启动 Spark Jobs

```bash
# 启动所有 Jobs
./start_spark_jobs.sh all

# 启动单个 Job
./start_spark_jobs.sh danmaku_count
./start_spark_jobs.sh sentiment
./start_spark_jobs.sh wordcloud
./start_spark_jobs.sh redis_sink

# 查看状态
./start_spark_jobs.sh status

# 停止所有 Jobs
./start_spark_jobs.sh stop
```

### 5.3 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--kafka` | Kafka bootstrap servers | `localhost:9092` |
| `--checkpoint` | 检查点目录 | `/tmp/spark-*-checkpoint` |
| `--redis-host` | Redis 主机 (redis_sink) | `localhost` |
| `--redis-port` | Redis 端口 (redis_sink) | `6379` |

### 5.4 直接运行

```bash
# 使用 python -m 运行
python -m spark.jobs.danmaku_count --kafka localhost:9092
python -m spark.jobs.sentiment --kafka localhost:9092
python -m spark.jobs.wordcloud --kafka localhost:9092
python -m spark.sinks.redis_sink --kafka localhost:9092
```

## 六、验证方法

1. **确保 Kafka 和 Redis 已启动**

2. **启动一个测试数据源 (如 video_pipeline)**

3. **检查 Kafka topic 是否有数据**
   ```bash
   kafka-console-consumer --topic danmaku_raw --from-beginning
   ```

4. **启动 Spark Job**
   ```bash
   python -m spark.jobs.danmaku_count
   ```

5. **检查输出 topic**
   ```bash
   kafka-console-consumer --topic danmaku_agg --from-beginning
   ```

6. **检查 Redis 数据**
   ```bash
   redis-cli
   > ZREVRANGE current_hot_rooms 0 10 WITHSCORES
   > GET wordcloud:bilibili_video:BVxxxx
   ```

## 七、与 Flink 版本的功能对比

| 功能 | Flink 版本 | Spark 版本 |
|------|-----------|-----------|
| 弹幕计数 | ✅ | ✅ |
| 情感分析 | ✅ | ✅ |
| 词云生成 | ✅ | ✅ |
| Watermark | ✅ | ✅ |
| 视频/直播区分 | ✅ | ✅ |
| Redis 存储 | ✅ | ✅ |
| Checkpoint | ✅ | ✅ |

## 八、注意事项

1. **Checkpoint 目录**: 每个 Job 需要独立的 checkpoint 目录
2. **性能调优**: `local[2]` 适合开发环境，生产环境需要集群
3. **版本匹配**: PySpark 3.5.x 需要与 Kafka Broker 版本兼容
4. **依赖安装**: 首次运行需要安装 PySpark、Redis、Jieba、SnowNLP

## 九、后续优化建议

1. **集群部署**: 使用 `spark-submit` 提交到 Spark 集群
2. **监控集成**: 添加 Spark UI 和 Prometheus 指标暴露
3. **资源调优**: 调整 `spark.executor.memory`, `spark.cores.max` 等参数
4. **容错处理**: 增强错误处理和重试机制
