# Flink → Spark 迁移完成文档

> 更新日期: 2026-04-20

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
├── collectors/                       # 弹幕采集器 (新增)
│   ├── __init__.py
│   ├── config.py                    # Kafka 配置、B站凭证
│   ├── bili_live_collector.py      # B站直播弹幕采集器
│   └── bili_video_collector.py       # B站视频弹幕采集器
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

## 四、Collectors 采集器

### 4.1 bili_live_collector.py (B站直播弹幕)

| 配置 | 值 |
|------|-----|
| 输入 | B站直播间 WebSocket |
| 输出 | Kafka topic `danmaku_raw` |
| 技术 | bilibili-api `LiveDanmaku` + Kafka Producer |

**功能:**
- 通过 WebSocket 实时采集B站直播间弹幕
- 自动重连机制
- 发送至 Kafka 供 Spark 处理

**Kafka 消息格式:**
```json
{
  "platform": "bilibili",
  "room_id": "bilibili_live:732",
  "user": {"id": "user_hash", "name": "用户名"},
  "content": "弹幕内容",
  "event_type": "danmaku",
  "ts": 1713000000000
}
```

### 4.2 bili_video_collector.py (B站视频弹幕)

| 配置 | 值 |
|------|-----|
| 输入 | B站视频弹幕 XML |
| 输出 | Kafka topic `danmaku_raw` |
| 回放速度 | 默认 2.0x |

**功能:**
- 获取视频弹幕 XML 并解析
- 按视频时间戳回放弹幕到 Kafka
- 支持倍速控制（1.0 = 原速, 2.0 = 2倍速）
- 回放完成后发送 FLUSH 信号

**Kafka 消息格式:**
```json
{
  "platform": "bilibili",
  "room_id": "bilibili_video:BVxxxx",
  "user": {"id": "user_hash", "name": null},
  "content": "弹幕内容",
  "event_type": "danmaku",
  "ts": 1713000000000,
  "video_time": 12.5
}
```

## 五、依赖更新

### pyproject.toml 新增依赖

```toml
[project]
dependencies = [
    # ... 原有依赖 ...
    "pyspark>=3.5.0",
    "redis>=5.0.0",
    "jieba>=0.42.1",
    "snownlp>=0.12.2",
    "kafka-python>=2.0.2",
    "bilibili-api-python>=17.4.1",
]
```

## 六、使用方法

### 6.1 安装依赖

```bash
cd backend
uv sync
```

### 6.2 启动 Collectors 采集器

```bash
# 启动 B站直播弹幕采集 (默认房间 732)
./start_spark_jobs.sh bili_live

# 自定义房间 ID
BILI_ROOM_ID=12345 ./start_spark_jobs.sh bili_live

# 启动 B站视频弹幕采集 (需要设置 BV 号)
BILI_BV_ID=BV1xx411c7mD ./start_spark_jobs.sh bili_video
```

### 6.3 启动 Spark Jobs

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

### 6.4 命令行参数

**Collectors 参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--room-id` | 直播间ID (bili_live) | `732` |
| `--bv-id` | B站视频BV号 (bili_video) | - |
| `--speed` | 回放倍速 (bili_video) | `2.0` |
| `--kafka` | Kafka 服务器 | `localhost:9092` |
| `--topic` | Kafka topic | `danmaku_raw` |

**Spark Jobs 参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--kafka` | Kafka bootstrap servers | `localhost:9092` |
| `--checkpoint` | 检查点目录 | `/tmp/spark-*-checkpoint` |
| `--redis-host` | Redis 主机 (redis_sink) | `localhost` |
| `--redis-port` | Redis 端口 (redis_sink) | `6379` |

### 6.5 直接运行

```bash
# Collectors
python -m backend.collectors.bili_live_collector --room-id 732
python -m backend.collectors.bili_video_collector --bv-id BV1xx411c7mD --speed 2.0

# Spark Jobs
python -m spark.jobs.danmaku_count --kafka localhost:9092
python -m spark.jobs.sentiment --kafka localhost:9092
python -m spark.jobs.wordcloud --kafka localhost:9092
python -m spark.sinks.redis_sink --kafka localhost:9092
```

### 6.6 环境变量

```bash
# B站 API 凭证 (必需)
export BILI_SESSDATA="your_sessdata_here"
export BILI_BILI_JCT="your_bili_jct"      # 可选
export BILI_BUVID3="your_buvid3"          # 可选，防 412 错误
export BILI_BUVID4="your_buvid4"          # 可选，防 412 错误

# Collector 配置
export BILI_ROOM_ID=732                   # 默认直播间
export BILI_BV_ID=BVxxxxxx                # 视频 BV 号
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092
export REDIS_HOST=localhost
export REDIS_PORT=6379
```

## 七、验证方法

1. **确保 Kafka 和 Redis 已启动**

2. **启动 B站直播 Collector**
   ```bash
   ./start_spark_jobs.sh bili_live
   ```

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
   > GET wordcloud:bilibili_live:732
   ```

## 八、与 Flink 版本的功能对比

| 功能 | Flink 版本 | Spark 版本 |
|------|-----------|-----------|
| 弹幕计数 | ✅ | ✅ |
| 情感分析 | ✅ | ✅ |
| 词云生成 | ✅ | ✅ |
| Watermark | ✅ | ✅ |
| 视频/直播区分 | ✅ | ✅ |
| Redis 存储 | ✅ | ✅ |
| Checkpoint | ✅ | ✅ |
| B站直播采集 | ✅ | ✅ |
| B站视频采集 | ✅ | ✅ |

## 九、注意事项

1. **B站凭证**: `BILI_SESSDATA` 必需，`BILI_BUVID3/BUVID4` 可防 412 错误
2. **Checkpoint 目录**: 每个 Job 需要独立的 checkpoint 目录
3. **性能调优**: `local[2]` 适合开发环境，生产环境需要集群
4. **版本匹配**: PySpark 3.5.x 需要与 Kafka Broker 版本兼容
5. **依赖安装**: 首次运行需要安装 PySpark、Redis、Jieba、SnowNLP

## 十、后续优化建议

1. **集群部署**: 使用 `spark-submit` 提交到 Spark 集群
2. **监控集成**: 添加 Spark UI 和 Prometheus 指标暴露
3. **资源调优**: 调整 `spark.executor.memory`, `spark.cores.max` 等参数
4. **容错处理**: 增强错误处理和重试机制
5. **斗鱼采集器**: 可参考已完成的 collectors 实现斗鱼直播弹幕采集器
