import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).parent.parent))

from backend.database import get_connection
from backend.schemas.quality import QualityMetrics, DailyTrend, DailyTrendItem, CrawlHealth


def get_quality_metrics() -> QualityMetrics:
    conn = get_connection()

    # DuckDB 单例连接 bugfix: fetchone 可能为 None
    def exec_one(sql: str) -> int:
        r = conn.execute(sql).fetchone()
        return r[0] if r else 0

    total = exec_one("SELECT count(*) FROM ods_raw_danmaku")
    clean = exec_one("SELECT count(*) FROM dwd_clean_danmaku")
    dirty = total - clean

    missing = exec_one("""
        SELECT count(*) FROM ods_raw_danmaku
        WHERE content IS NULL OR content = '' OR length(content) < 2
    """)

    missing_rate = round(missing / total * 100, 2) if total > 0 else 0.0
    dirty_rate = round(dirty / total * 100, 2) if total > 0 else 0.0

    return QualityMetrics(
        total_records=total,
        dirty_records=dirty,
        clean_records=clean,
        field_missing_rate=missing_rate,
        dirty_rate=dirty_rate,
    )


def get_daily_trend() -> DailyTrend:
    conn = get_connection()

    rows = conn.execute("""
        WITH daily AS (
            SELECT
                DATE(TRY_CAST(send_time AS TIMESTAMP)) AS date,
                content,
                id
            FROM ods_raw_danmaku
            WHERE TRY_CAST(send_time AS TIMESTAMP) IS NOT NULL
        )
        SELECT
            date,
            COUNT(*) AS total,
            SUM(CASE
                WHEN content IS NULL OR content = '' OR length(content) < 2
                     OR content ILIKE '%<%'
                THEN 1 ELSE 0
            END) AS dirty_count
        FROM daily
        GROUP BY date
        ORDER BY date DESC
        LIMIT 7
    """).fetchall()

    items = [
        DailyTrendItem(
            date=str(date),
            dirty_count=dirty,
            clean_count=(total or 0) - dirty,
        )
        for (date, total, dirty) in rows
    ]
    return DailyTrend(items=items)


def get_crawl_health() -> CrawlHealth | None:
    """读取 sys_etl_logs 最新一条记录，返回爬虫健康度"""
    conn = get_connection()

    row = conn.execute("""
        SELECT
            run_id,
            run_time,
            up_name,
            videos_fetched,
            comments_fetched,
            dirty_filtered,
            spam_truncated,
            api_success_rate,
            status
        FROM sys_etl_logs
        ORDER BY run_time DESC
        LIMIT 1
    """).fetchone()

    if not row:
        return None

    return CrawlHealth(
        run_id=row[0] or "",
        run_time=row[1],
        up_name=row[2] or "",
        videos_fetched=row[3] or 0,
        comments_fetched=row[4] or 0,
        dirty_filtered=row[5] or 0,
        spam_truncated=row[6] or 0,
        api_success_rate=row[7] or 0.0,
        status=row[8] or "UNKNOWN",
    )
