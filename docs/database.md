# 数据库存储文档

> 本文档记录 B-DataGov 项目所有数据的存储位置、表的结构和用途。

---

## 一、PostgreSQL（用户认证数据）

**用途**：用户注册、登录认证

**连接信息**（来自 `DATABASE_URL`）：
```
postgresql://bdata:bdata123456@localhost:5432/dbname
```

### users

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | SERIAL PRIMARY KEY | 用户 ID |
| `username` | VARCHAR(50) UNIQUE NOT NULL | 用户名（唯一） |
| `nickname` | VARCHAR(100) NOT NULL | 昵称 |
| `password_hash` | VARCHAR(255) NOT NULL | 密码哈希（bcrypt） |
| `created_at` | TIMESTAMP | 注册时间 |

**来源**：`backend/routers/auth.py` — 注册时写入，登录时查询验证。

```sql
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50) UNIQUE NOT NULL,
    nickname        VARCHAR(100) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 二、DuckDB（ETL 批处理数据 + 任务记录）

**文件路径**：`backend/data/b_data_gov.duckdb`

**连接方式**：每个请求创建新连接（无连接池，DuckDB 打开/关闭开销极低）

```python
from backend.database import get_connection
conn = get_connection()  # → duckdb.connect(str(DB_PATH))
```

---

### sys_tasks — ETL 任务调度表

| 字段 | 类型 | 说明 |
|---|---|---|
| `task_id` | VARCHAR PRIMARY KEY | 任务 UUID |
| `target_type` | VARCHAR | `video` 或 `up` |
| `target_id` | VARCHAR | 视频 BV 号 或 UP 主 UID |
| `fetch_limit` | INTEGER | 抓取上限 |
| `up_name` | VARCHAR | UP 主名称（自动从 API 获取） |
| `status` | VARCHAR | `running` / `success` / `failed` |
| `error_msg` | VARCHAR | 错误信息（失败时） |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

**来源**：`backend/services/etl_service.py` — `run_bilibili_etl_task()` 写入

---

### ods_raw_comments — ODS 原始评论层

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | VARCHAR PRIMARY KEY | 评论 RPID |
| `video_bvid` | VARCHAR | 视频 BV 号 |
| `video_title` | VARCHAR | 视频标题 |
| `up_uid` | BIGINT | UP 主 UID |
| `up_name` | VARCHAR | UP 主昵称 |
| `content` | VARCHAR | 评论原文 |
| `like_count` | INTEGER | 点赞数 |
| `post_time` | BIGINT | 评论时间戳（秒） |
| `post_time_str` | VARCHAR | 评论时间字符串 |
| `etl_run_id` | VARCHAR | 本次 ETL run_id |

**来源**：`backend/services/etl_service.py` — `_load_to_duckdb()` 写入（爬虫原始数据）

**特点**：`DROP TABLE IF EXISTS` 后重建，每次 ETL 重新爬取

---

### dwd_clean_comments — DWD 清洗后评论层

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | VARCHAR PRIMARY KEY | 评论 RPID |
| `video_bvid` | VARCHAR | 视频 BV 号 |
| `video_title` | VARCHAR | 视频标题 |
| `up_uid` | BIGINT | UP 主 UID |
| `up_name` | VARCHAR | UP 主昵称 |
| `content` | VARCHAR | 清洗后评论（超长截断） |
| `like_count` | INTEGER | 点赞数 |
| `post_time` | TIMESTAMP | 标准化时间（UTC） |
| `etl_run_id` | VARCHAR | 本次 ETL run_id |

**清洗规则**：
- 规则1：过滤空内容
- 规则2：超长评论截断至 100 字符
- 规则3：时间戳标准化为 UTC

---

### dws_comment_stats — DWS 评论汇总层

| 字段 | 类型 | 说明 |
|---|---|---|
| `video_bvid` | VARCHAR PRIMARY KEY | 视频 BV 号 |
| `video_title` | VARCHAR | 视频标题 |
| `up_uid` | BIGINT | UP 主 UID |
| `up_name` | VARCHAR | UP 主昵称 |
| `total_comments` | BIGINT | 评论总数 |
| `total_likes` | BIGINT | 点赞总数 |
| `avg_likes` | DOUBLE | 平均点赞数 |
| `etl_run_id` | VARCHAR | 本次 ETL run_id |

**来源**：按 `video_bvid` 聚合 `dwd_clean_comments` 计算得出

---

### sys_etl_logs — ETL 运行日志

| 字段 | 类型 | 说明 |
|---|---|---|
| `run_id` | VARCHAR PRIMARY KEY | ETL run_id（task_id 前8位） |
| `run_time` | TIMESTAMP | 运行时间 |
| `up_uid` | BIGINT | UP 主 UID |
| `up_name` | VARCHAR | UP 主昵称 |
| `videos_fetched` | INTEGER | 抓取视频数 |
| `comments_fetched` | INTEGER | 抓取评论数 |
| `dirty_filtered` | INTEGER | 脏数据过滤数 |
| `spam_truncated` | INTEGER | 超长截断数 |
| `api_success_count` | INTEGER | API 成功次数 |
| `api_fail_count` | INTEGER | API 失败次数 |
| `api_success_rate` | DOUBLE | API 成功率 |
| `status` | VARCHAR | SUCCESS / PARTIAL / FAILED |

---

## 三、Redis（实时监控数据）

**用途**：实时弹幕流处理结果的缓存，不做持久化（重启后丢失）

**连接信息**（来自 `.env`）：
```
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 实时房间列表

| Key | 类型 | 说明 |
|---|---|---|
| `current_hot_rooms` | ZSET | 热门房间排行，member=房间ID，score=heat（弹幕计数） |

**member 格式**：
- 直播：`bilibili_live:732`
- 视频：`bilibili_video:BV1xx411c7mD`

**写入来源**：`spark/sinks/redis_sink.py` — `add_agg()` 每收到一条 `danmaku_agg` 消息更新一次 ZSET

**读取来源**：`backend/routers/monitor.py` — `get_rank()` 读取并按 score 降序

---

### 房间详细信息

| Key | 类型 | 说明 |
|---|---|---|
| `room:info:{room_id}` | HASH | 房间信息 |

**字段**：
| 字段 | 说明 |
|---|---|
| `title` | 房间标题（视频标题或房间号） |
| `anchor_name` | 主播/UP主昵称 |
| `status` | 状态：`RUNNING` / `STOPPED` / `FINISHED` / `FAILED` |

**写入来源**：
- `start_monitor` API（`POST /api/live/monitor/start`）
- `stop_monitor` API（`POST /api/live/monitor/stop`）

**读取来源**：`get_rank` API 读取房间标题和状态

---

### 历史趋势数据

| Key | 类型 | 说明 |
|---|---|---|
| `history:{room_id}` | LIST | 弹幕数量历史趋势（每次聚合窗口输出一条） |

**LIST 每项 JSON 格式**：
```json
{"count": 42, "ts": 1713000000000}
```

**TTL**：直播 3600 秒（1小时），视频不过期

**读取来源**：`get_history` API — 消费后自动清除 LIST（避免重复）

---

### 词云数据

| Key | 类型 | 说明 |
|---|---|---|
| `wordcloud:{room_id}` | STRING | 词云 JSON 数据 |

**STRING 格式**：
```json
[
  {"name": "弹幕", "value": 120},
  {"name": "哈哈", "value": 85}
]
```

**TTL**：直播 3600 秒，视频不过期

**写入来源**：`spark/sinks/redis_sink.py` — `add_wordcloud()` 每 5 秒更新一次

**读取来源**：`get_wordcloud` API

---

### 情感分析数据

| Key | 类型 | 说明 |
|---|---|---|
| `sentiment:{room_id}` | LIST | 情感历史（每窗口输出一条） |
| `sentiment:current:{room_id}` | STRING | 当前情感分数（最新窗口） |

**LIST 每项 JSON 格式**：
```json
{"value": 0.65, "count": 42, "ts": 1713000000000}
```

**TTL**：直播 3600 秒，视频不过期

**写入来源**：`spark/sinks/redis_sink.py` — `add_sentiment()`

**读取来源**：`get_sentiment` API

---

### 收藏功能（进程内存）

| Key | 类型 | 说明 |
|---|---|---|
| `{platform}:{target_type}:{room_id}` | dict（内存） | 收藏状态 |

**存储结构**（Python 字典）：
```python
{
  "room_id": "732",
  "platform": "bilibili",
  "target_type": "live",
  "created_at": 1713000000.0,
}
```

**注意**：收藏数据存在后端进程内存中，不是 Redis。**服务重启后丢失**，如需持久化应迁移至 PostgreSQL。

**读写来源**：`POST /api/live/favorites/toggle`、`GET /api/live/favorites/check`

---

## 四、数据流向全图

```
┌─────────────────────────────────────────────────────────────┐
│  Collectors                                                  │
│  bili_live_collector ──────────────────────────────────────►│
│  (WebSocket 实时弹幕)         Kafka: danmaku_raw            │
│  bili_video_collector ─────►                                │
│  (XML 回放，有限数据)                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Spark Streaming Jobs                                        │
│  danmaku_count.py ──────────► Kafka: danmaku_agg ──────────►│
│  (10s 窗口 / 1s 滑动)                                       │
│                                                              │
│  sentiment.py ─────────────► Kafka: danmaku_sentiment ──────►│
│  (视频 5min 窗口 / 直播 1min 窗口)                          │
│                                                              │
│  wordcloud.py ─────────────► Kafka: danmaku_wordcloud ──────►│
│  (视频 GlobalWindow / 直播 5min 窗口)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  redis_sink.py                                               │
│  消费三个 output topic ─────────────────────────────────────►│
│                                                              │
│  current_hot_rooms (ZSET)  ◄── agg 写入                     │
│  history:{room_id} (LIST)   ◄── agg 写入                    │
│  sentiment:{room_id} (LIST) ◄── sentiment 写入               │
│  sentiment:current: (STRING) ◄── sentiment 写入               │
│  wordcloud:{room_id} (STRING) ◄── wordcloud 写入             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Redis (运行时数据，不持久化)                                 │
│  FastAPI monitor.py ◄──── get_rank / get_history / ...       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend PlatformMonitor.tsx                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL (持久化)                                          │
│  users ──► 注册/登录                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DuckDB (持久化)                                             │
│  sys_tasks ──► ETL 任务记录                                  │
│  ods_raw_comments ──► 原始评论                               │
│  dwd_clean_comments ──► 清洗后评论                           │
│  dws_comment_stats ──► 视频维度统计                          │
│  sys_etl_logs ──► ETL 运行日志                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 五、房间号存储位置

| 存储位置 | 格式 | 生命周期 | 说明 |
|---|---|---|---|
| Redis `current_hot_rooms` (ZSET) | `bilibili_live:732` / `bilibili_video:BVxxx` | 实时 | 正在监控的房间 |
| Redis `room:info:{room_id}` (HASH) | `status=RUNNING/STOPPED` | 实时 | 房间状态 |
| DuckDB `sys_tasks` | `target_id=BVxxx / UID` | 持久 | 历史任务记录 |
| 内存 favorites dict | `bilibili:live:732` | 进程内 | 收藏状态 |
