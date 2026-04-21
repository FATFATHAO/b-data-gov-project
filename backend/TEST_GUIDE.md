# B站爬虫脚本测试指南

> 更新日期: 2026-04-21

## 准备工作

### 环境变量

```bash
cd /mnt/data/ArchLinux/Projects/b-data-gov-project/backend

# B站凭证（必需）
export BILI_SESSDATA="your_sessdata_here"
export BILI_BILI_JCT="your_bili_jct"
export BILI_BUVID3="your_buvid3"
export BILI_BUVID4="your_buvid4"

# Kafka（默认 localhost:9092）
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

### 前置条件

- Kafka 已启动，确保 `danmaku_raw` topic 存在
- Redis 已启动（用于验证 Spark 输出）
- 虚拟环境已安装：`cd backend && source .venv/bin/activate`

---

## 一、直播弹幕采集器测试 (bili_live_collector)

### 测试目标

测试B站直播间实时弹幕采集和发送到Kafka的效果。

### 测试步骤

```bash
# 1. 启动Kafka消费者监听 danmaku_raw topic
kafka-console-consumer --topic danmaku_raw --from-beginning --bootstrap-server localhost:9092

# 2. 启动直播采集器（默认房间 732）
cd backend
source .venv/bin/activate
python -m backend.collectors.bili_live_collector --room-id 732

# 或使用启动脚本
BILI_SESSDATA="your_sessdata" ./start_spark_jobs.sh bili_live
```

### 预期输出

```
2026-04-21 10:30:00 [INFO] ==================================================
2026-04-21 10:30:00 [INFO] B站直播弹幕采集 | 房间: 732
2026-04-21 10:30:00 [INFO] Kafka: localhost:9092 | Topic: danmaku_raw
2026-04-21 10:30:00 [INFO] ==================================================
2026-04-21 10:30:00 [INFO] SESSDATA 已加载（长度=64）
2026-04-21 10:30:00 [INFO] 连接Kafka: localhost:9092
2026-04-21 10:30:01 [INFO] 正在连接直播间: 732...
2026-04-21 10:30:02 [INFO] 已成功连接直播间: 732
```

### Kafka 消费者预期消息格式

```json
{
  "platform": "bilibili",
  "room_id": "bilibili_live:732",
  "user": { "id": "abc123", "name": "用户名" },
  "content": "弹幕内容",
  "event_type": "danmaku",
  "ts": 1713000000000
}
```

### 测试不同房间

```bash
# 罗翔老师直播间
python -m backend.collectors.bili_live_collector --room-id 732

# B站官方直播间
python -m backend.collectors.bili_live_collector --room-id 5450
```

---

## 二、视频弹幕采集器测试 (bili_video_collector)

### 测试目标

测试从B站视频获取弹幕XML并回放到Kafka的效果。

### 测试步骤

```bash
# 1. 启动Kafka消费者
kafka-console-consumer --topic danmaku_raw --from-beginning --bootstrap-server localhost:9092

# 2. 启动视频弹幕采集器（需要 BV 号）
cd backend
source .venv/bin/activate
python -m backend.collectors.bili_video_collector --bv-id BV1xx411c7mD --speed 2.0
```

### 预期输出

```
2026-04-21 10:35:00 [INFO] ==================================================
2026-04-21 10:35:00 [INFO] B站视频弹幕采集 | BV: BV1xx411c7mD | 倍速: 2.0
2026-04-21 10:35:00 [INFO] ==================================================
2026-04-21 10:35:00 [INFO] 获取弹幕XML...
2026-04-21 10:35:01 [INFO] 视频 BV1xx411c7mD CID: 123456789
2026-04-21 10:35:01 [INFO] 解析弹幕...
2026-04-21 10:35:01 [INFO] 解析完成，共 500 条弹幕
2026-04-21 10:35:01 [INFO] 连接Kafka: localhost:9092
2026-04-21 10:35:01 [INFO] 房间ID: bilibili_video:BV1xx411c7mD, 弹幕数: 500, 倍速: 2.0
2026-04-21 10:35:01 [INFO] 已发送 50/500: 测试弹幕内容...
2026-04-21 10:35:02 [INFO] 已发送 100/500: ...
2026-04-21 10:35:05 [INFO] 重放完成
2026-04-21 10:35:05 [INFO] 发送FLUSH信号
2026-04-21 10:35:05 [INFO] Kafka producer 已关闭
```

### 参数说明

| 参数      | 说明                           | 默认值         |
| --------- | ------------------------------ | -------------- |
| `--bv-id` | B站视频BV号                    | 必填           |
| `--speed` | 回放倍速 (1.0=原速, 2.0=2倍速) | 2.0            |
| `--kafka` | Kafka服务器地址                | localhost:9092 |
| `--topic` | Kafka topic                    | danmaku_raw    |

---

## 三、ETL爬虫脚本测试 (bili_spider_etl)

### 测试目标

测试爬取UP主视频和评论并存入DuckDB的效果。

### 测试步骤

```bash
cd backend
source .venv/bin/activate

# 运行ETL脚本
export BILI_SESSDATA="your_sessdata"
export BILI_BUVID3="your_buvid3"
python backend/bili_spider_etl.py
```

### 预期输出

```
2026-04-21 10:40:00 [INFO] ==================================================
2026-04-21 10:40:00 [INFO] B站 ETL 流水线启动 | UP: 罗翔说刑法 (UID: 517327498)
2026-04-21 10:40:00 [INFO] ==================================================
2026-04-21 10:40:00 [INFO] ETL 表初始化完成
2026-04-21 10:40:00 [INFO] SESSDATA 已加载（长度=64）
2026-04-21 10:40:00 [INFO] 抓取 UP主 517327498 的视频列表（最多 5 个）...
2026-04-21 10:40:01 [INFO] 获取到 5 个视频
2026-04-21 10:40:01 [INFO] 评论抓取完成：150 条评论（成功API: 5, 失败: 0）
2026-04-21 10:40:02 [INFO] 数据写入完成: ODS=150, DWD=148, dirty_filtered=2, spam_truncated=0
2026-04-21 10:40:02 [INFO] ✅ ETL 流水线执行完成 | run_id=a1b2c3d4
```

### 验证数据

```bash
# 进入DuckDB查看数据
duckdb backend/data/b_data_gov.duckdb

# 查看ODS原始评论
SELECT COUNT(*) FROM ods_raw_comments;

# 查看DWD清洗后评论
SELECT COUNT(*) FROM dwd_clean_comments;

# 查看视频统计
SELECT * FROM dws_comment_stats;

# 查看最近ETL日志
SELECT * FROM sys_etl_logs ORDER BY run_time DESC LIMIT 1;
```

---

## 四、Spark Jobs 测试

### 测试完整链路

```bash
# 1. 启动视频弹幕采集（高速回放便于测试）
python -m backend.collectors.bili_video_collector --bv-id BV1xx411c7mD --speed 5.0

# 2. 启动弹幕计数 Job（新窗口）
./start_spark_jobs.sh danmaku_count

# 3. 启动 Redis Sink（新窗口）
./start_spark_jobs.sh redis_sink

# 4. 检查Redis输出
redis-cli
> KEYS *
> ZREVRANGE current_hot_rooms 0 10 WITHSCORES
> GET wordcloud:bilibili_video:BV1xx411c7mD
```

---

## 五、常见问题排查

| 问题                            | 原因           | 解决方法                |
| ------------------------------- | -------------- | ----------------------- |
| `未找到 BILI_SESSDATA 环境变量` | 未设置SESSDATA | 设置环境变量后重试      |
| `412 Precondition Failed`       | WBI验证失败    | 添加 BILI_BUVID3/BUVID4 |
| `Kafka connection failed`       | Kafka未启动    | 检查Kafka服务           |
| `未找到视频分集信息`            | BV号无效       | 使用正确的BV号          |
| `获取视频列表失败`              | SESSDATA过期   | 重新获取有效凭证        |

---

## 六、测试后清理

```bash
# 停止所有后台进程
pkill -f bili_live_collector
pkill -f bili_video_collector
pkill -f danmaku_count

# 或使用停止脚本
./start_spark_jobs.sh stop
```

