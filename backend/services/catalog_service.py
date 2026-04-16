import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).parent.parent))

from backend.database import get_connection
from backend.schemas.catalog import TableInfo, TableSchema, ColumnInfo


TABLE_LAYERS = {
    "ods_raw_danmaku": "ODS（原始层）",
    "dwd_clean_danmaku": "DWD（明细层）",
    "dws_up_stats": "DWS（汇总层）",
}


def list_tables() -> list[TableInfo]:
    conn = get_connection()
    rows = conn.execute("""
        SELECT
            table_name,
            table_schema
        FROM information_schema.tables
        WHERE table_schema = 'main'
          AND table_name IN ('ods_raw_danmaku', 'dwd_clean_danmaku', 'dws_up_stats')
    """).fetchall()

    result = []
    for (table_name, _schema) in rows:
        count = conn.execute(
            f"SELECT count(*) FROM {table_name}"
        ).fetchone()[0]
        result.append(TableInfo(
            name=table_name,
            layer=TABLE_LAYERS.get(table_name, "未知"),
            row_count=count,
        ))
    return result


def get_table_schema(table_name: str) -> TableSchema:
    conn = get_connection()

    col_rows = conn.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = ?
        ORDER BY ordinal_position
    """, [table_name]).fetchall()

    count = conn.execute(
        f"SELECT count(*) FROM {table_name}"
    ).fetchone()[0]

    return TableSchema(
        table_name=table_name,
        columns=[
            ColumnInfo(name=name, type=dtype) for name, dtype in col_rows
        ],
        row_count=count,
    )
