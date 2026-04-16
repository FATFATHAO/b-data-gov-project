import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).parent.parent))

from fastapi import APIRouter, HTTPException
from backend.schemas.quality import QualityMetrics, DailyTrend, CrawlHealth
from backend.services import quality_service

router = APIRouter(prefix="/api/quality", tags=["质量监控"])


@router.get("/metrics", response_model=QualityMetrics)
def get_metrics():
    return quality_service.get_quality_metrics()


@router.get("/daily-trend", response_model=DailyTrend)
def get_daily_trend():
    return quality_service.get_daily_trend()


@router.get("/crawl-health", response_model=CrawlHealth)
def get_crawl_health():
    """
    返回爬虫健康度数据：
    - 最近一次 ETL 运行的运行时间、抓取量、拦截量
    - API 请求成功率
    - 状态标签 SUCCESS / PARTIAL / FAILED
    """
    health = quality_service.get_crawl_health()
    if health is None:
        raise HTTPException(
            status_code=404,
            detail="暂无 ETL 运行记录，请先执行爬虫脚本"
        )
    return health
