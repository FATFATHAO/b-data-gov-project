from datetime import datetime
from pydantic import BaseModel


class QualityMetrics(BaseModel):
    total_records: int
    dirty_records: int
    clean_records: int
    field_missing_rate: float  # 字段缺失率（百分比）
    dirty_rate: float          # 脏数据率（百分比）


class DailyTrendItem(BaseModel):
    date: str
    dirty_count: int
    clean_count: int


class DailyTrend(BaseModel):
    items: list[DailyTrendItem]


class CrawlHealth(BaseModel):
    run_id: str
    run_time: datetime
    up_name: str
    videos_fetched: int
    comments_fetched: int
    dirty_filtered: int
    spam_truncated: int
    api_success_rate: float    # 成功率 0.0 ~ 1.0
    status: str               # SUCCESS / PARTIAL / FAILED
