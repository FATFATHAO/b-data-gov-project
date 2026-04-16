"""
backend/services/etl_service.py
Phase 5 - 动态采集配置与任务调度中心

核心函数：run_bilibili_etl_task
- 复用 bili_spider_etl.py 中的数据抓取、Polars 清洗、DuckDB 写入逻辑
- 支持 video/up 两种采集模式
- 通过 sys_tasks 表跟踪任务状态
"""

from __future__ import annotations

import os
import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

import polars as pl

_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from backend.database import get_connection

# bilibili-api-python
from bilibili_api import Credential, user, video as bili_video, comment

# Polars 清洗规则常量（复用 bili_spider_etl.py）
MAX_COMMENT_LEN = 100

# 日志
logger = logging.getLogger("etl_service")


# ============================================================
# 辅助：构建 Bilibili 凭证
# ============================================================

def _build_credential() -> Credential:
    sessdata = os.environ.get("BILI_SESSDATA", "").strip()
    if not sessdata:
        raise RuntimeError(
            "未找到 BILI_SESSDATA 环境变量。"
            "请先设置：export BILI_SESSDATA='your_sessdata_here'"
        )
    return Credential(sessdata=sessdata)


# ============================================================
# 数据抓取（异步）- 复用于 bili_spider_etl.py
# ============================================================

async def _fetch_user_videos(
    uid: int,
    credential: Credential,
    count: int,
) -> list[dict]:
    """获取指定 UP 主最新的 count 个视频基础信息"""
    u = user.User(uid=uid, credential=credential)
    all_videos = []
    async for video_card in u.get_videos(pn=1, num=30):
        all_videos.append(video_card)
        if len(all_videos) >= count:
            break
    return all_videos[:count]


async def _fetch_video_comments(
    bvid: str,
    credential: Credential,
    limit: int,
) -> list[dict]:
    """获取指定视频的评论（热评+最新评论）"""
    v = bili_video.Video(bvid=bvid, credential=credential)
    comments = []

    for comment_type in [comment.CommentType.HOT, comment.CommentType.NORMAL]:
        viewer = comment.CommentViewer(
            oid=bvid,
            type=comment_type,
            credential=credential,
        )
        async for c in viewer.get_list():
            comments.append({
                "rpid": c.get("rpid", c.get("rpid_str", "")),
                "bvid": bvid,
                "msg": c.get("content", {}).get("message", ""),
                "like": c.get("like", 0),
                "ctime": c.get("ctime", 0),
                "uname": c.get("member", {}).get("uname", ""),
                "mid": c.get("member", {}).get("mid", ""),
            })
            if len(comments) >= limit:
                break
        if len(comments) >= limit:
            break

    return comments[:limit]


# ============================================================
# Polars 清洗 - 复用于 bili_spider_etl.py clean_df()
# ============================================================

def _clean_df(df_raw: pl.DataFrame, run_id: str) -> tuple[pl.DataFrame, int, int]:
    """
    规则1（完整性）：过滤空内容
    规则2（合规性）：超长评论截断
    规则3：时间戳标准化

    返回：(清洗后df, 规则1拦截数, 规则2截断数)
    """
    if df_raw.is_empty():
        return df_raw, 0, 0

    # 规则1：过滤空内容
    df_clean = df_raw.filter(
        pl.col("content").str.strip_chars().str.len_chars() > 0
    )
    rule1_blocked = len(df_raw) - len(df_clean)

    # 规则2：截断超长评论
    df_clean = df_clean.with_columns(
        pl.when(pl.col("content").str.len_chars() > MAX_COMMENT_LEN)
          .then(pl.col("content").str.slice(0, MAX_COMMENT_LEN) + "...")
          .otherwise(pl.col("content"))
          .alias("content")
    )

    # 规则3：时间戳标准化
    df_clean = df_clean.with_columns(
        (pl.col("post_time").cast(pl.Int64).map_elements(
            lambda ts: datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                       if ts and ts > 0 else None,
            return_dtype=pl.String,
        )).alias("post_time_str")
    )
    df_clean = df_clean.with_columns(
        pl.col("post_time_str").str.to_datetime("%Y-%m-%d %H:%M:%S", strict=False)
                                .cast(pl.Datetime).dt.replace_time_zone("UTC")
                                .alias("post_time_norm")
    )

    rule2_truncated = (
        df_clean.filter(pl.col("content").str.ends_with("...")).height
        if df_clean.height > 0 else 0
    )

    df_clean = df_clean.with_columns(pl.lit(run_id).alias("etl_run_id"))
    return df_clean, rule1_blocked, rule2_truncated


# ============================================================
# 辅助：transform_to_raw_df - 复用于 bili_spider_etl.py
# ============================================================

def _transform_to_raw_df(
    comments: list[dict],
    videos: list[dict],
    up_uid: int,
    up_name: str,
) -> pl.DataFrame:
    """将原始评论列表转为 polars DataFrame（ODS 层）"""
    video_map = {v.get("bvid") or v.get("aid"): v for v in videos}
    rows = []
    for c in comments:
        bvid = c.get("bvid", "")
        vinfo = video_map.get(bvid, {})
        rows.append({
            "id": str(c.get("rpid", "")),
            "video_bvid": bvid,
            "video_title": vinfo.get("title", ""),
            "up_uid": up_uid,
            "up_name": up_name,
            "content": c.get("msg", ""),
            "like_count": c.get("like", 0) or 0,
            "post_time": c.get("ctime", 0) or 0,
            "post_time_str": str(c.get("ctime", "")),
            "etl_run_id": "",
        })
    return pl.DataFrame(rows, schema={
        "id": pl.String,
        "video_bvid": pl.String,
        "video_title": pl.String,
        "up_uid": pl.Int64,
        "up_name": pl.String,
        "content": pl.String,
        "like_count": pl.Int64,
        "post_time": pl.Int64,
        "post_time_str": pl.String,
        "etl_run_id": pl.String,
    })


# ============================================================
# DuckDB 写入 - 复用于 bili_spider_etl.py load_to_duckdb()
# ============================================================

def _load_to_duckdb(
    df_raw: pl.DataFrame,
    df_clean: pl.DataFrame,
    run_id: str,
    comments_total: int,
    dirty_filtered: int,
    spam_truncated: int,
    api_success: int,
    api_fail: int,
    up_uid: int,
    up_name: str,
) -> None:
    """将 DataFrame 写入 DuckDB ODS/DWD/DWS 表，并写入 ETL 日志"""
    conn = get_connection()
    conn.execute("PRAGMA eager_warnings = 'ignore'")

    # ODS：INSERT OR REPLACE（主键去重，幂等）
    if not df_raw.is_empty():
        df_raw_pd = df_raw.with_columns(pl.lit(run_id).alias("etl_run_id")).to_pandas()
        conn.execute("""
            INSERT OR REPLACE INTO ods_raw_comments
            (id, video_bvid, video_title, up_uid, up_name,
             content, like_count, post_time, post_time_str, etl_run_id)
            SELECT
                CAST(t.id AS VARCHAR),
                CAST(t.video_bvid AS VARCHAR),
                CAST(t.video_title AS VARCHAR),
                CAST(t.up_uid AS BIGINT),
                CAST(t.up_name AS VARCHAR),
                CAST(t.content AS VARCHAR),
                CAST(t.like_count AS BIGINT),
                CAST(t.post_time AS BIGINT),
                CAST(t.post_time_str AS VARCHAR),
                CAST(t.etl_run_id AS VARCHAR)
            FROM df_raw_pd AS t
        """)

    # DWD：先清空该 run_id 的旧数据，再插入（确保幂等）
    if not df_clean.is_empty():
        conn.execute("DELETE FROM dwd_clean_comments WHERE etl_run_id = ?", [run_id])
        df_clean_pd = df_clean.to_pandas()
        conn.execute("""
            INSERT INTO dwd_clean_comments
            (id, video_bvid, video_title, up_uid, up_name,
             content, like_count, post_time, etl_run_id)
            SELECT
                CAST(t.id AS VARCHAR),
                CAST(t.video_bvid AS VARCHAR),
                CAST(t.video_title AS VARCHAR),
                CAST(t.up_uid AS BIGINT),
                CAST(t.up_name AS VARCHAR),
                CAST(t.content AS VARCHAR),
                CAST(t.like_count AS BIGINT),
                CAST(t.post_time_norm AS TIMESTAMP),
                CAST(t.etl_run_id AS VARCHAR)
            FROM df_clean_pd AS t
        """)

    # DWS 汇总：按视频聚合
    if not df_clean.is_empty():
        conn.execute("DELETE FROM dws_comment_stats WHERE etl_run_id = ?", [run_id])
        dws_pd = df_clean.group_by(
            "video_bvid", "video_title", "up_uid", "up_name", "etl_run_id"
        ).agg([
            pl.col("id").count().alias("total_comments"),
            pl.col("like_count").sum().alias("total_likes"),
            pl.col("like_count").mean().alias("avg_likes"),
        ]).to_pandas()
        if not dws_pd.empty:
            conn.execute("""
                INSERT INTO dws_comment_stats
                (video_bvid, video_title, up_uid, up_name,
                 total_comments, total_likes, avg_likes, etl_run_id)
                SELECT
                    CAST(t.video_bvid AS VARCHAR),
                    CAST(t.video_title AS VARCHAR),
                    CAST(t.up_uid AS BIGINT),
                    CAST(t.up_name AS VARCHAR),
                    CAST(t.total_comments AS BIGINT),
                    CAST(t.total_likes AS BIGINT),
                    CAST(t.avg_likes AS DOUBLE),
                    CAST(t.etl_run_id AS VARCHAR)
                FROM dws_pd AS t
            """)

    # sys_etl_logs：追加日志
    success_rate = round(api_success / (api_success + api_fail), 4) if (api_success + api_fail) > 0 else 0.0
    status = "SUCCESS" if api_fail == 0 else ("PARTIAL" if api_success > 0 else "FAILED")

    conn.execute("""
        INSERT INTO sys_etl_logs
        (run_id, run_time, up_uid, up_name,
         videos_fetched, comments_fetched, dirty_filtered, spam_truncated,
         api_success_count, api_fail_count, api_success_rate, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        run_id,
        datetime.now(timezone.utc),
        up_uid,
        up_name,
        0,
        comments_total,
        dirty_filtered,
        spam_truncated,
        api_success,
        api_fail,
        success_rate,
        status,
    ])

    conn.commit()
    logger.info(
        "数据写入完成: ODS=%d, DWD=%d, dirty_filtered=%d, spam_truncated=%d",
        len(df_raw), len(df_clean), dirty_filtered, spam_truncated
    )


# ============================================================
# 辅助：更新任务状态
# ============================================================

def _update_task_status(
    task_id: str,
    status: str,
    error_msg: Optional[str],
) -> None:
    """更新 sys_tasks 表中的任务状态"""
    conn = get_connection()
    conn.execute("""
        UPDATE sys_tasks
        SET status = ?, error_msg = ?, updated_at = ?
        WHERE task_id = ?
    """, [status, error_msg, datetime.now(timezone.utc), task_id])
    conn.commit()


# ============================================================
# 查询任务列表
# ============================================================

def list_tasks() -> tuple[list[dict], int]:
    """查询 sys_tasks 表，返回所有任务"""
    conn = get_connection()
    rows = conn.execute("""
        SELECT task_id, target_type, target_id, fetch_limit,
               up_name, status, error_msg, created_at, updated_at
        FROM sys_tasks
        ORDER BY created_at DESC
    """).fetchall()

    tasks = [
        {
            "task_id": r[0],
            "target_type": r[1],
            "target_id": r[2],
            "fetch_limit": r[3],
            "up_name": r[4] or "",
            "status": r[5],
            "error_msg": r[6],
            "created_at": r[7],
            "updated_at": r[8],
        }
        for r in rows
    ]
    return tasks, len(tasks)


# ============================================================
# 核心入口：run_bilibili_etl_task
# ============================================================

async def run_bilibili_etl_task(
    task_id: str,
    target_type: Literal["video", "up"],
    target_id: str,
    fetch_limit: int,
) -> None:
    """
    Phase 5 核心函数：动态 ETL 任务

    target_type="video"：
        target_id = BVID，直接抓取该视频的评论
        需要先通过 video.get_info() 获取 up_uid / up_name

    target_type="up"：
        target_id = UID，遍历该 UP 主视频列表，收集所有评论
    """
    run_id = task_id[:8]
    logger.info(
        "ETL 任务启动 | task_id=%s, type=%s, target=%s, limit=%d",
        task_id, target_type, target_id, fetch_limit
    )

    try:
        # 1. 构建凭证
        credential = _build_credential()

        # 2. 根据 target_type 分支处理
        if target_type == "video":
            # 获取视频元数据（包含 UP 主信息）
            v = bili_video.Video(bvid=target_id, credential=credential)
            try:
                info = await v.get_info()
            except Exception as e:
                logger.error("获取视频 %s 元数据失败: %s", target_id, e)
                _update_task_status(task_id, "failed", f"获取视频元数据失败: {e}")
                return

            up_uid = info["owner"]["mid"]
            up_name = info["owner"]["name"]
            videos = [{"bvid": target_id, "title": info["title"], "aid": info["aid"]}]
            comments = await _fetch_video_comments(target_id, credential, fetch_limit)
            api_success, api_fail = 1, 0

        else:  # target_type == "up"
            up_uid = int(target_id)

            # 获取 UP 主名称
            try:
                u = user.User(uid=up_uid, credential=credential)
                up_name = (await u.get_user_info())["name"]
            except Exception as e:
                logger.warning("获取 UP 主 %s 名称失败: %s", up_uid, e)
                up_name = f"UID:{up_uid}"

            # 获取视频列表（获取数量根据 fetch_limit 估算）
            video_count = min(fetch_limit // 20 + 1, 30)
            videos = await _fetch_user_videos(up_uid, credential, video_count)

            if not videos:
                _update_task_status(task_id, "failed", "未获取到视频列表，请检查 UID 和 SESSDATA 是否有效")
                return

            # 并发抓评论
            sem = asyncio.Semaphore(3)
            api_success, api_fail = 0, 0
            all_comments: list[dict] = []

            async def fetch_one(bvid: str) -> list[dict]:
                nonlocal api_success, api_fail
                async with sem:
                    try:
                        cs = await _fetch_video_comments(bvid, credential, fetch_limit)
                        api_success += 1
                        return cs
                    except Exception:
                        api_fail += 1
                        return []

            results = await asyncio.gather(*[
                fetch_one(v.get("bvid") or v.get("aid"))
                for v in videos
            ])
            for cs in results:
                all_comments.extend(cs)

            comments = all_comments

        # 3. 检查是否获取到评论
        if not comments:
            _update_task_status(task_id, "failed", "未抓取到任何评论")
            return

        # 4. Transform
        df_raw = _transform_to_raw_df(comments, videos, up_uid, up_name)
        df_clean, rule1_blocked, rule2_truncated = _clean_df(df_raw, run_id)

        # 5. Load
        _load_to_duckdb(
            df_raw=df_raw,
            df_clean=df_clean,
            run_id=run_id,
            comments_total=len(comments),
            dirty_filtered=rule1_blocked,
            spam_truncated=rule2_truncated,
            api_success=api_success,
            api_fail=api_fail,
            up_uid=up_uid,
            up_name=up_name,
        )

        _update_task_status(task_id, "success", None)
        logger.info("ETL 任务完成 | task_id=%s, comments=%d", task_id, len(comments))

    except Exception as e:
        logger.error("ETL 任务失败 | task_id=%s, error=%s", task_id, e, exc_info=True)
        _update_task_status(task_id, "failed", str(e))
