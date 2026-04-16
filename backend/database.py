from pathlib import Path
import duckdb

DB_PATH = Path(__file__).parent / "data" / "b_data_gov.duckdb"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_connection() -> duckdb.DuckDBPyConnection:
    # 每次请求创建新连接，避免多线程状态污染
    # DuckDB 打开/关闭开销极低，无连接池必要
    return duckdb.connect(str(DB_PATH))


def init_etl_tables() -> None:
    """初始化 B站评论 ETL 相关表"""
    conn = get_connection()

    # ODS 原始评论层
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ods_raw_comments (
            id            VARCHAR,
            video_bvid    VARCHAR,
            video_title   VARCHAR,
            up_uid        BIGINT,
            up_name       VARCHAR,
            content       VARCHAR,
            like_count    INTEGER,
            post_time     BIGINT,
            post_time_str VARCHAR,
            etl_run_id    VARCHAR
        )
    """)

    # DWD 清洗后评论层
    conn.execute("""
        CREATE TABLE IF NOT EXISTS dwd_clean_comments (
            id            VARCHAR PRIMARY KEY,
            video_bvid    VARCHAR,
            video_title   VARCHAR,
            up_uid        BIGINT,
            up_name       VARCHAR,
            content       VARCHAR,
            like_count    INTEGER,
            post_time     TIMESTAMP,
            etl_run_id    VARCHAR
        )
    """)

    # DWS 评论汇总层
    conn.execute("""
        CREATE TABLE IF NOT EXISTS dws_comment_stats (
            video_bvid     VARCHAR PRIMARY KEY,
            video_title    VARCHAR,
            up_uid         BIGINT,
            up_name        VARCHAR,
            total_comments INTEGER,
            total_likes    BIGINT,
            avg_likes      DOUBLE,
            etl_run_id     VARCHAR
        )
    """)

    # ETL 运行日志
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sys_etl_logs (
            run_id            VARCHAR PRIMARY KEY,
            run_time          TIMESTAMP,
            up_uid            BIGINT,
            up_name           VARCHAR,
            videos_fetched    INTEGER,
            comments_fetched  INTEGER,
            dirty_filtered    INTEGER,
            spam_truncated    INTEGER,
            api_success_count INTEGER,
            api_fail_count    INTEGER,
            api_success_rate  DOUBLE,
            status            VARCHAR
        )
    """)

    # 任务调度表（Phase 5）
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sys_tasks (
            task_id         VARCHAR PRIMARY KEY,
            target_type     VARCHAR,
            target_id       VARCHAR,
            fetch_limit     INTEGER,
            up_name         VARCHAR,
            status          VARCHAR,
            error_msg       VARCHAR,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
