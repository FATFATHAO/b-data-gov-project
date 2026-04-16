# B-DataGov Lite — 后端接口文档

> B站数据治理与可视化平台 · Phase 1 & 4 后端实现
> 更新时间：2026/04/15

---

## 一、项目结构

```
backend/
├── pyproject.toml              # uv 依赖声明
├── main.py                    # FastAPI 挂载点 + CORS + lifespan
├── database.py                # DuckDB 连接管理 + init_etl_tables()
├── mock_data.py               # ODS→DWD→DWS 弹幕层 Mock 数据
├── bili_spider_etl.py         # B站真实数据 ETL 爬虫脚本（Phase 4）
├── schemas/                   # Pydantic 模型（API 返回格式）
│   ├── catalog.py
│   ├── quality.py            # 新增 CrawlHealth（Phase 4）
│   ├── lineage.py
│   └── roi.py
├── services/                 # 数据查询与清洗业务逻辑
│   ├── catalog_service.py
│   ├── quality_service.py    # 新增 get_crawl_health()（Phase 4）
│   ├── lineage_service.py
│   └── roi_service.py
└── routers/                  # API 路由
    ├── catalog.py
    ├── quality.py            # 新增 /crawl-health（Phase 4）
    ├── lineage.py
    └── roi.py
```

---

## 二、数据库架构

### 2.1 DuckDB 文件路径

```
backend/data/b_data_gov.duckdb
```

启动时由 `main.py` lifespan 自动调用 `init_database()` 和 `init_etl_tables()` 建表灌数。

### 2.2 连接管理（重要修复）

```python
# database.py — 每次请求创建新连接，线程安全
def get_connection() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(DB_PATH))
```

> ⚠️ 早期版本使用全局单例 `_connection`，在 uvicorn 多线程环境下会导致游标状态污染，使 `fetchone()` 返回 `None`。

### 2.3 Mock 数据三层（弹幕）

| 表名 | 层级 | 描述 |
|---|---|---|
| `ods_raw_danmaku` | ODS（原始层） | B站弹幕原始数据，含脏数据 ~500条 |
| `dwd_clean_danmaku` | DWD（明细层） | 清洗后弹幕数据 ~421条 |
| `dws_up_stats` | DWS（汇总层） | UP主互动统计聚合 |

### 2.4 ETL 数据三层（B站评论，Phase 4 新增）

| 表名 | 层级 | 描述 |
|---|---|---|
| `ods_raw_comments` | ODS（原始层） | B站评论原始数据，由爬虫直接写入 |
| `dwd_clean_comments` | DWD（明细层） | Polars 清洗后的干净评论 |
| `dws_comment_stats` | DWS（汇总层） | 按视频聚合的评论统计 |
| `sys_etl_logs` | 系统日志 | ETL 每次运行的元数据（健康度） |

### 2.5 ODS 原始评论层字段 (`ods_raw_comments`)

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | VARCHAR | 评论 rpid（主键） |
| `video_bvid` | VARCHAR | 视频 BV 号 |
| `video_title` | VARCHAR | 视频标题 |
| `up_uid` | BIGINT | UP主 UID |
| `up_name` | VARCHAR | UP主昵称 |
| `content` | VARCHAR | 评论原始内容 |
| `like_count` | INTEGER | 点赞数 |
| `post_time` | BIGINT | Unix 时间戳（秒） |
| `post_time_str` | VARCHAR | 原始时间字符串 |
| `etl_run_id` | VARCHAR | 本次 ETL 运行 ID（UUID前8位） |

### 2.6 DWD 清洗后评论层字段 (`dwd_clean_comments`)

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | VARCHAR | 评论 rpid（主键） |
| `video_bvid` | VARCHAR | 视频 BV 号 |
| `video_title` | VARCHAR | 视频标题 |
| `up_uid` | BIGINT | UP主 UID |
| `up_name` | VARCHAR | UP主昵称 |
| `content` | VARCHAR | 清洗后内容（超长已截断） |
| `like_count` | INTEGER | 点赞数 |
| `post_time` | TIMESTAMP | 标准化时间（UTC） |
| `etl_run_id` | VARCHAR | 本次 ETL 运行 ID |

### 2.7 DWS 评论汇总层字段 (`dws_comment_stats`)

| 字段 | 类型 | 说明 |
|---|---|---|
| `video_bvid` | VARCHAR | 视频 BV 号（主键） |
| `video_title` | VARCHAR | 视频标题 |
| `up_uid` | BIGINT | UP主 UID |
| `up_name` | VARCHAR | UP主昵称 |
| `total_comments` | INTEGER | 评论总数 |
| `total_likes` | BIGINT | 总点赞数 |
| `avg_likes` | DOUBLE | 平均点赞数 |
| `etl_run_id` | VARCHAR | 本次 ETL 运行 ID |

### 2.8 ETL 运行日志字段 (`sys_etl_logs`)

| 字段 | 类型 | 说明 |
|---|---|---|
| `run_id` | VARCHAR | 运行时生成（UUID前8位，主键） |
| `run_time` | TIMESTAMP | 运行时间（UTC） |
| `up_uid` | BIGINT | 目标 UP 主 UID |
| `up_name` | VARCHAR | 目标 UP 主昵称 |
| `videos_fetched` | INTEGER | 本次抓取视频数 |
| `comments_fetched` | INTEGER | 本次抓取评论总数 |
| `dirty_filtered` | INTEGER | 规则1拦截（空内容） |
| `spam_truncated` | INTEGER | 规则2截断（超长刷屏） |
| `api_success_count` | INTEGER | API 请求成功次数 |
| `api_fail_count` | INTEGER | API 请求失败次数 |
| `api_success_rate` | DOUBLE | API 成功率（0.0~1.0） |
| `status` | VARCHAR | SUCCESS / PARTIAL / FAILED |

### 2.9 Mock 弹幕脏数据类型

| 类型 | 示例 | 清洗规则 |
|---|---|---|
| 空内容 | `""` | `content IS NOT NULL AND content != ''` |
| 重复刷屏 | `"哈哈哈哈哈哈哈..."` | `length(content) >= 2` |
| HTML 注入 | `<script>alert(1)</script>` | `content NOT ILIKE '%<%'` |
| 异常 Unicode | `"ټ ټ ټ"` | 非 CJK/ASCII 可打印字符过滤 |
| 非法时间戳 | `"2010-02-30 25:99:99"` | `TRY_CAST(send_time AS TIMESTAMP)` |
| 超短弹幕 | `"哈"`（1字） | `length(content) >= 2` |

---

## 三、API 接口文档

### 3.1 健康检查

**GET** `/` / **GET** `/health`

```json
{ "status": "ok" }
```

---

### 3.2 资产目录（Catalog）

#### GET `/api/catalog/tables`

```json
[
  { "name": "ods_raw_danmaku", "layer": "ODS（原始层）", "row_count": 500 },
  { "name": "dwd_clean_danmaku", "layer": "DWD（明细层）", "row_count": 421 },
  { "name": "dws_up_stats", "layer": "DWS（汇总层）", "row_count": 421 }
]
```

#### GET `/api/catalog/schema/{table_name}`

```json
{
  "table_name": "ods_raw_danmaku",
  "columns": [
    { "name": "id", "type": "VARCHAR" },
    { "name": "video_id", "type": "VARCHAR" },
    { "name": "up_id", "type": "INTEGER" },
    { "name": "content", "type": "VARCHAR" },
    { "name": "send_time", "type": "VARCHAR" },
    { "name": "like_count", "type": "INTEGER" }
  ],
  "row_count": 500
}
```

---

### 3.3 质量监控（Quality）

#### GET `/api/quality/metrics`

```json
{
  "total_records": 500,
  "dirty_records": 79,
  "clean_records": 421,
  "field_missing_rate": 8.6,
  "dirty_rate": 15.8
}
```

#### GET `/api/quality/daily-trend`

```json
{
  "items": [
    { "date": "2026-04-15", "dirty_count": 0, "clean_count": 1 }
  ]
}
```

#### GET `/api/quality/crawl-health`（Phase 4 新增）

返回最近一次 ETL 爬虫运行的健康度数据。

**响应（200）**

```json
{
  "run_id": "a1b2c3d4",
  "run_time": "2026-04-15T10:30:00Z",
  "up_name": "罗翔说刑法",
  "videos_fetched": 5,
  "comments_fetched": 387,
  "dirty_filtered": 12,
  "spam_truncated": 5,
  "api_success_rate": 0.967,
  "status": "SUCCESS"
}
```

**响应（404）** — ETL 从未运行

```json
{ "detail": "暂无 ETL 运行记录，请先执行爬虫脚本" }
```

---

### 3.4 数据血缘（Lineage）

#### GET `/api/lineage/graph`

```json
{
  "nodes": [
    { "id": "ods_raw_danmaku", "name": "ods_raw_danmaku", "layer": "ODS",
      "description": "B站弹幕原始数据（未经清洗）" },
    { "id": "dwd_clean_danmaku", "name": "dwd_clean_danmaku", "layer": "DWD",
      "description": "清洗后的弹幕明细数据（过滤脏数据、空值、非法时间戳）" },
    { "id": "dws_up_stats", "name": "dws_up_stats", "layer": "DWS",
      "description": "UP主互动统计汇总表（基于干净数据聚合）" }
  ],
  "edges": [
    { "source": "ods_raw_danmaku", "target": "dwd_clean_danmaku", "label": "数据清洗" },
    { "source": "dwd_clean_danmaku", "target": "dws_up_stats", "label": "汇总聚合" }
  ]
}
```

---

### 3.5 治理成效（ROI）

#### GET `/api/roi/storage`

```json
{
  "ods_size_mb": 0.0954,
  "dwd_size_mb": 0.0401,
  "dws_size_mb": 0.0257,
  "total_size_mb": 0.1612,
  "compression_ratio": 0.4203
}
```

---

## 四、ETL 爬虫脚本（Phase 4）

### 4.1 文件

```
backend/bili_spider_etl.py
```

### 4.2 环境准备

```bash
# 设置 B 站登录凭证（必填）
export BILI_SESSDATA="your_sessdata_here"

# 安装依赖（已在 pyproject.toml 声明）
uv sync
```

### 4.3 运行命令

```bash
# 方式1：直接运行（自动检测 30 分钟防重复）
uv run python backend/bili_spider_etl.py

# 方式2：定时调度（crontab，每小时运行）
0 * * * * cd /path/to/project && export BILI_SESSDATA="..." && uv run python backend/bili_spider_etl.py >> /var/log/bili_etl.log 2>&1
```

### 4.4 核心配置

| 配置 | 默认值 | 说明 |
|---|---|---|
| `TARGET_UP_UID` | `517327498` | 罗翔说刑法 |
| `FETCH_VIDEO_COUNT` | `5` | 每次 ETL 抓取最新视频数 |
| `FETCH_COMMENTS_PER_VIDEO` | `100` | 每视频评论上限（防止限流） |
| `MAX_CONCURRENCY` | `3` | 并发限制 |
| `RUN_INTERVAL_MINUTES` | `30` | 重复运行最小间隔 |
| `MAX_COMMENT_LEN` | `100` | 超过此长度视为刷屏，截断 |

### 4.5 清洗规则（Polars 实现）

| 规则 | 逻辑 | 处置 |
|---|---|---|
| 规则1（完整性） | `content.strip() == ""` | 过滤丢弃，记录到 `dirty_filtered` |
| 规则2（合规性） | `len(content) > 100` | 截断至 100 字符 + `"..."`，记录到 `spam_truncated` |
| 规则3（标准化） | Unix 10位时间戳 | 转换为 `YYYY-MM-DD HH:mm:ss` UTC 时间 |

### 4.6 幂等设计

- ODS/DWD/DWD 表使用主键 `id` / `video_bvid` 去重：`INSERT OR REPLACE`
- `sys_etl_logs` 追加写入，`run_id` 每次生成新 UUID
- `check_recent_run()` 检查距上次运行不足 30 分钟则跳过

---

## 五、启动方式

### 5.1 一键启动（前后端同时）

```bash
cd /path/to/project
./start.sh
# 后端 → http://localhost:8000
# 前端 → http://localhost:5173
```

### 5.2 单独启动后端

```bash
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### 5.3 API 文档

启动后访问：`http://localhost:8000/docs`（Swagger UI）

---

## 六、技术栈

| 组件 | 技术选型 | 版本要求 |
|---|---|---|
| 环境管理 | uv | Python 3.10+ |
| Web 框架 | FastAPI + Uvicorn | >=0.115 / >=0.30 |
| 数据库 | DuckDB | >=1.5.0 |
| 数据处理 | Polars | >=1.0.0 |
| 数据验证 | Pydantic | >=2.0.0 |
| B站爬虫 | bilibili-api-python | >=17.0.0 |

---

## 七、已完成 vs 待实现

### ✅ 已完成

| 功能 | Phase | 说明 |
|---|---|---|
| 项目结构搭建 | Phase 1 | backend/ 目录规范 |
| Mock 数据三层 | Phase 1 | 500条弹幕 ODS，含6类脏数据 |
| DuckDB 连接管理 | Phase 4 | 每次请求新建连接，线程安全 |
| 资产目录 API | Phase 1 | `/api/catalog/*` |
| 质量监控 API | Phase 1 | `/api/quality/metrics`、`/daily-trend` |
| 数据血缘 API | Phase 1 | `/api/lineage/graph` |
| 治理成效 API | Phase 1 | `/api/roi/storage` |
| CORS 配置 | Phase 1 | `allow_origins=["*"]` |
| B站 ETL 爬虫 | Phase 4 | bilibili-api-python 异步爬虫 |
| Polars 清洗流水线 | Phase 4 | 3条规则，幂等写入 |
| ETL 运行日志 | Phase 4 | `sys_etl_logs` 健康度记录 |
| 爬虫健康度 API | Phase 4 | `GET /api/quality/crawl-health` |
| 一键启动脚本 | Phase 3 | `start.sh` |

### 🔄 待实现

| 功能 | 优先级 | 说明 |
|---|---|---|
| 增量 ETL | 高 | 每次只抓新增评论，而非全量 |
| 弹幕内容质量分析 | 中 | 敏感词过滤、情感分析 |
| UP主粉丝数关联 | 中 | 引入外部UP主画像表 |
| 血缘可视化增强 | 低 | 支持字段级血缘（column lineage） |
| 数据导出功能 | 低 | 支持导出 CSV/Parquet |
| 告警规则配置 | 中 | 质量指标阈值告警 |
| 测试覆盖率 | 中 | 补充 pytest 单元测试 |
