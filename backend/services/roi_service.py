import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).parent.parent))

from backend.database import get_connection
from backend.schemas.roi import StorageStats


def get_storage_stats() -> StorageStats:
    conn = get_connection()

    def table_bytes(table: str) -> float:
        """估算表字节数（MockDuckDB 不支持 pg_total_relation_size，用行数估算）"""
        rows = conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        cols = conn.execute(f"""
            SELECT count(*) FROM information_schema.columns WHERE table_name = '{table}'
        """).fetchone()[0]
        # 假设平均每行 128 字节
        return rows * cols * 8  # 估算值（字节）

    # ODS 保留原始字段多、包括脏数据，行数最多
    ods_rows = conn.execute(
        "SELECT count(*) FROM ods_raw_danmaku"
    ).fetchone()[0]
    dwd_rows = conn.execute(
        "SELECT count(*) FROM dwd_clean_danmaku"
    ).fetchone()[0]
    dws_rows = conn.execute(
        "SELECT count(*) FROM dws_up_stats"
    ).fetchone()[0]

    # 每行估算 200 字节
    ods_mb = round(ods_rows * 200 / 1024 / 1024, 4)
    dwd_mb = round(dwd_rows * 100 / 1024 / 1024, 4)  # 清洗后字段精简
    dws_mb = round(dws_rows * 64 / 1024 / 1024, 4)   # 汇总层行数少

    total = round(ods_mb + dwd_mb + dws_mb, 4)
    compression = round(dwd_mb / ods_mb, 4) if ods_mb > 0 else 0.0

    return StorageStats(
        ods_size_mb=ods_mb,
        dwd_size_mb=dwd_mb,
        dws_size_mb=dws_mb,
        total_size_mb=total,
        compression_ratio=compression,
    )
