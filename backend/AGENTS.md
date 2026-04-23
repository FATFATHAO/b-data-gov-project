# Backend Agent Guide

## 项目结构

```
backend/
├── collectors/             # 弹幕采集器模块
│   ├── __init__.py
│   ├── config.py           # Kafka 配置、B站凭证
│   ├── bili_live_collector.py  # B站直播弹幕采集器
│   └── bili_video_collector.py # B站视频弹幕采集器
├── spark/                   # Spark Structured Streaming 模块
│   ├── spark_session.py     # SparkSession 初始化
│   ├── jobs/               # Spark Jobs
│   │   ├── danmaku_count.py   # 弹幕计数
│   │   ├── sentiment.py        # 情感分析
│   │   └── wordcloud.py        # 词云生成
│   ├── sinks/              # 输出 Sink
│   │   └── redis_sink.py   # Redis Sink
│   └── utils/              # 工具模块
│       ├── sentiment_dict.py    # 情感词典
│       └── stopwords.py        # 停用词表
├── routers/                # API 路由
│   ├── auth.py             # 认证路由
│   ├── catalog.py          # 数据目录
│   ├── quality.py          # 数据质量
│   ├── lineage.py         # 数据血缘
│   └── roi.py             # ROI 分析
├── services/              # 业务逻辑
│   ├── catalog_service.py
│   ├── quality_service.py
│   ├── lineage_service.py
│   ├── roi_service.py
│   └── etl_service.py
├── schemas/               # Pydantic 模型
│   └── auth.py
├── database.py            # 数据库连接管理
├── main.py                # FastAPI 入口
├── bili_spider_etl.py     # B站数据 ETL 爬虫
└── pyproject.toml
```

## 技术栈

- **框架**: FastAPI + Uvicorn
- **语言**: Python 3.10+
- **包管理**: uv
- **数据库**: DuckDB (数据存储), PostgreSQL (用户认证)
- **实时处理**: Spark Structured Streaming + PySpark
- **消息队列**: Kafka
- **缓存**: Redis
- **数据验证**: Pydantic v2

## API 设计规范

### 路由组织

1. 路由按功能模块划分到 `routers/` 目录
2. 每个路由模块对应一个功能域
3. 使用 `APIRouter` 组织路由

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["catalog"])

@router.get("/items")
async def list_items():
    pass
```

### 请求/响应模型

1. 使用 Pydantic v2 模型定义请求和响应
2. 请求模型放在 `schemas/` 目录
3. 响应模型使用 `Response` 后缀

```python
from pydantic import BaseModel
from datetime import datetime

class ItemCreate(BaseModel):
    name: str
    description: str | None = None

class ItemResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

## 数据库规范

### DuckDB

用于数据存储和 OLAP 查询。

```python
from backend.database import get_connection

with get_connection() as conn:
    result = conn.execute("SELECT * FROM table").fetchall()
```

### PostgreSQL

用于用户认证和权限管理。

```python
import psycopg2

conn = psycopg2.connect(os.getenv("DATABASE_URL"))
```

## Spark Structured Streaming

### Job 启动

```bash
# 启动弹幕计数 Job
python -m spark.jobs.danmaku_count --kafka localhost:9092

# 启动情感分析 Job
python -m spark.jobs.sentiment --kafka localhost:9092

# 启动词云 Job
python -m spark.jobs.wordcloud --kafka localhost:9092

# 启动 Redis Sink
python -m spark.sinks.redis_sink --kafka localhost:9092
```

### 使用启动脚本

```bash
./start_spark_jobs.sh all        # 启动所有 Spark Jobs
./start_spark_jobs.sh bili_live   # 启动 B站直播弹幕采集器
./start_spark_jobs.sh bili_video  # 启动 B站视频弹幕采集器
./start_spark_jobs.sh stop       # 停止所有 Jobs
./start_spark_jobs.sh status     # 查看状态
```

## 开发规范

### 代码风格

1. 使用 Ruff 进行格式化和 lint
2. 每行不超过 120 字符
3. 使用类型注解

### 命名规范

- 变量和函数: `snake_case`
- 类名: `PascalCase`
- 常量: `UPPER_CASE`

### 类型定义

```python
from typing import TypedDict, NotRequired

class UserProfile(TypedDict):
    user_id: str
    email: str
    nickname: NotRequired[str]
```

### 日志规范

```python
import logging

logger = logging.getLogger(__name__)

logger.info("Processing item: %s", item_id)
logger.warning("Retrying operation: %d", attempt)
logger.error("Operation failed: %s", error)
```

### 错误处理

```python
from fastapi import HTTPException

raise HTTPException(status_code=404, detail="Item not found")
```

## 常用命令

```bash
# 安装依赖
cd backend
uv sync

# 启动 FastAPI 开发服务器
uv run uvicorn backend.main:app --reload

# 启动 Spark Jobs
./start_spark_jobs.sh all

# 运行 ETL 脚本
uv run python backend/bili_spider_etl.py
```

## 环境变量

> **注意**: 所有环境变量配置已迁移到 `backend/.env` 文件。
> 复制 `.env.example` 模板并填入实际值即可：
> ```bash
> cp .env.example .env
> ```

### .env.example 配置项说明

```env
# ============================================================
# B站 API 凭证 (必需)
# ============================================================
BILI_SESSDATA=your_sessdata_here      # B站登录凭证
BILI_BILI_JCT=your_bili_jct           # CSRF token
BILI_BUVID3=your_buvid3               # 设备标识，防412错误
BILI_BUVID4=your_buvid4               # 设备标识，防412错误

# ============================================================
# Kafka 配置
# ============================================================
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# ============================================================
# Redis 配置
# ============================================================
REDIS_HOST=localhost
REDIS_PORT=6379

# ============================================================
# 数据库配置
# ============================================================
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
DUCKDB_PATH=backend/data/b_data_gov.duckdb

# ============================================================
# Spark 配置
# ============================================================
SPARK_HOME=/opt/spark

# ============================================================
# Collectors 采集器默认配置
# ============================================================
BILI_ROOM_ID=732                      # 默认直播间
BILI_BV_ID=BVxxxxxx                  # 默认视频BV号
```

## 注意事项

1. Spark Jobs 需要 Kafka 和 Redis 运行
2. ETL 脚本需要 `BILI_SESSDATA` 环境变量
3. DuckDB 是文件数据库，并发写入需要小心
4. 使用 `uv` 进行所有 Python 包管理操作
