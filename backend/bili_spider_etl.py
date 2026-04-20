"""
B站数据 ETL 爬虫脚本
B-DataGov Lite — Phase 4

功能：爬取指定 UP 主视频及评论，用 Polars 清洗后存入 DuckDB
设计：可定时重复运行（幂等），记录治理日志到 sys_etl_logs
依赖：BILI_SESSDATA 环境变量（必填）

使用方式：
    export BILI_SESSDATA="your_sessdata_here"
    uv run python backend/bili_spider_etl.py
"""

from __future__ import annotations

import os
import sys
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

# 确保项目根目录在 sys.path（支持 uv run 方式直接运行）
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

import polars as pl
import duckdb

from backend.database import get_connection, init_etl_tables

# ============================================================
# Bilibili API 异步封装（bilibili-api-python）
# ============================================================
from bilibili_api import Credential, user, video as bili_video, comment
from bilibili_api.comment import get_comments, CommentResourceType, OrderType

# ============================================================
# 配置
# ============================================================

TARGET_UP_UID = 517327498          # 罗翔说刑法
TARGET_UP_NAME = "罗翔说刑法"
FETCH_VIDEO_COUNT = 5              # 每次 ETL 抓取最新视频数
FETCH_COMMENTS_PER_VIDEO = 100    # 每视频评论上限（避免限流）
MAX_CONCURRENCY = 3               # 并发限制（防止触发风控）
RUN_INTERVAL_MINUTES = 30         # 重复运行时最小间隔（分钟）

# Polars 清洗规则
MAX_COMMENT_LEN = 100             # 超过此长度视为刷屏，截断

# 日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("bili_etl")


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

    # v17.4.1 WBI 接口需要 buvid3 配合签名，尝试从环境获取
    buvid3 = os.environ.get("BILI_BUVID3", "").strip()

    logger.info("SESSDATA 已加载（长度=%d）", len(sessdata))
    if buvid3:
        logger.info("BUVID3 已加载")
        return Credential(sessdata=sessdata, buvid3=buvid3)
    else:
        logger.info("BUVID3 未提供，将自动生成（可能触发风控）")
        return Credential(sessdata=sessdata)


# ============================================================
# Bilibili 数据抓取（异步）
# ============================================================

async def fetch_user_videos(
    uid: int,
    credential: Credential,
    count: int = FETCH_VIDEO_COUNT,
) -> list[dict]:
    """
    获取指定 UP 主最新的 count 个视频基础信息。
    返回 dict 列表，每项包含 bvid, title, aid, pic, pubdate 等。
    """
    logger.info("抓取 UP主 %d 的视频列表（最多 %d 个）...", uid, count)
    u = user.User(uid=uid, credential=credential)

    try:
        # v17.4.1: get_top_videos() 返回单个视频 dict，不是 AsyncGenerator
        # 需要循环调用 get_media_list() 获取视频列表
        all_videos = []
        offset = None

        while len(all_videos) < count:
            result = await u.get_media_list(ps=min(20, count - len(all_videos)), oid=offset)
            media_list = result.get("media_list", [])
            if not media_list:
                break

            for item in media_list:
                if len(all_videos) >= count:
                    break
                # get_media_list 返回的字段使用 bv_id 和 link
                all_videos.append({
                    "bvid": item.get("bv_id") or item.get("short_link", "").replace("https://b23.tv/", ""),
                    "aid": item.get("id"),  # 可能是 media_id，需要转换
                    "title": item.get("title", ""),
                    "pic": item.get("cover", ""),
                    "pubdate": item.get("pubtime", 0),
                    "duration": item.get("duration", 0),
                })
                offset = item.get("id")

            if not result.get("has_more", False):
                break

        logger.info("获取到 %d 个视频", len(all_videos))
        return all_videos[:count]

    except Exception as e:
        logger.error("获取视频列表失败: %s", e)
        raise


async def fetch_video_comments(
    bvid: str,
    credential: Credential,
    limit: int = FETCH_COMMENTS_PER_VIDEO,
) -> list[dict]:
    """
    获取指定视频的评论（热评+最新评论）。
    返回 dict 列表，每项包含 rpid, oid, msg, like 等。
    """
    try:
        # v17.4.1: 需要先获取 AID 才能查询评论
        # 使用 video.Video 获取视频信息
        v = bili_video.Video(bvid=bvid, credential=credential)
        video_info = await v.get_info()
        aid = video_info.get("aid")
        if not aid:
            logger.warning("视频 %s 无法获取 aid", bvid)
            return []

        all_comments = []

        # v17.4.1: 使用 comment.get_comments() 函数
        # mode=2 热评, mode=0 最新评论
        for mode in [OrderType.LIKE, OrderType.TIME]:  # 热评排, 最新
            page = 1
            while len(all_comments) < limit:
                resp = await get_comments(
                    oid=aid,
                    type_=CommentResourceType.VIDEO,
                    page_index=page,
                    order=mode,
                    credential=credential
                )
                replies = resp.get("replies", []) or []
                if not replies:
                    break
                for c in replies:
                    all_comments.append({
                        "rpid": c.get("rpid", c.get("rpid_str", "")),
                        "bvid": bvid,
                        "msg": c.get("content", {}).get("message", ""),
                        "like": c.get("like", 0),
                        "ctime": c.get("ctime", 0),          # Unix 时间戳（秒）
                        "uname": c.get("member", {}).get("uname", ""),
                        "mid": c.get("member", {}).get("mid", ""),
                    })
                page += 1
                if len(all_comments) >= limit:
                    break

        return all_comments[:limit]

    except Exception as e:
        logger.warning("抓取视频 %s 评论失败: %s", bvid, e)
        return []


async def crawl_all(credential: Credential) -> tuple[list[dict], int, int]:
    """
    并发抓取视频列表和评论。
    返回 (all_comments, api_success_count, api_fail_count)
    """
    # 1. 抓视频列表
    videos = await fetch_user_videos(TARGET_UP_UID, credential, FETCH_VIDEO_COUNT)

    if not videos:
        logger.warning("视频列表为空，请检查 UID 和 SESSDATA 是否有效")
        return [], 0, 1

    # 2. 并发抓每视频评论（限流）
    sem = asyncio.Semaphore(MAX_CONCURRENCY)
    api_success = 0
    api_fail = 0

    async def fetch_one(v: dict) -> tuple[list[dict], bool]:
        async with sem:
            bvid = v.get("bvid") or v.get("aid")
            if not bvid:
                return [], False
            try:
                comments = await fetch_video_comments(bvid, credential, FETCH_COMMENTS_PER_VIDEO)
                nonlocal api_success, api_fail
                api_success += 1
                return comments, True
            except Exception:
                api_fail += 1
                return [], False

    results = await asyncio.gather(*[fetch_one(v) for v in videos])
    all_comments: list[dict] = []
    for comments_list, ok in results:
        all_comments.extend(comments_list)

    logger.info("评论抓取完成：%d 条评论（成功API: %d, 失败: %d）",
                 len(all_comments), api_success, api_fail)
    return all_comments, api_success, api_fail


# ============================================================
# Polars 数据清洗
# ============================================================

def transform_to_raw_df(comments: list[dict], videos: list[dict]) -> pl.DataFrame:
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
            "up_uid": TARGET_UP_UID,
            "up_name": TARGET_UP_NAME,
            "content": c.get("msg", ""),
            "like_count": c.get("like", 0) or 0,
            "post_time": c.get("ctime", 0) or 0,
            "post_time_str": str(c.get("ctime", "")),
            "etl_run_id": "",  # 稍后填充
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


def clean_df(df_raw: pl.DataFrame, run_id: str) -> tuple[pl.DataFrame, int, int]:
    """
    Polars 清洗规则：
    规则1（完整性）：过滤 content 为空或纯空白
    规则2（合规性）：超长（>100字符）→ 截断到100字符

    返回：(清洗后df, 规则1拦截数, 规则2截断数)
    """
    if df_raw.is_empty():
        return df_raw, 0, 0

    # 规则1：过滤空内容
    df_clean = df_raw.filter(
        pl.col("content").str.strip_chars().str.len_chars() > 0
    )
    rule1_blocked = len(df_raw) - len(df_clean)

    # 规则2：截断超长评论（保留前100字符+省略号）
    df_clean = df_clean.with_columns(
        pl.when(pl.col("content").str.len_chars() > MAX_COMMENT_LEN)
          .then(
              pl.col("content").str.slice(0, MAX_COMMENT_LEN) + "..."
          )
          .otherwise(pl.col("content"))
          .alias("content")
    )

    # 规则3：时间戳标准化（10位Unix秒 → "YYYY-MM-DD HH:mm:ss"）
    df_clean = df_clean.with_columns(
        (
            pl.col("post_time").cast(pl.Int64)
            .map_elements(
                lambda ts: datetime.fromtimestamp(ts, tz=timezone.utc)
                           .strftime("%Y-%m-%d %H:%M:%S")
                           if ts and ts > 0 else None,
                return_dtype=pl.String,
            )
        ).alias("post_time_str")
    )

    # 规范化 post_time 为 TIMESTAMP 类型
    df_clean = df_clean.with_columns(
        pl.col("post_time_str").str.to_datetime("%Y-%m-%d %H:%M:%S", strict=False)
                                .cast(pl.Datetime).dt.replace_time_zone("UTC")
                                .alias("post_time_norm")
    )

    # 截断计数（超过 MAX_COMMENT_LEN 的原始评论数）
    rule2_truncated = df_clean.filter(
        pl.col("content").str.ends_with("...")
    ).height if df_clean.height > 0 else 0

    # 填充 run_id
    df_clean = df_clean.with_columns(pl.lit(run_id).alias("etl_run_id"))

    return df_clean, rule1_blocked, rule2_truncated


# ============================================================
# DuckDB 写入（幂等）
# ============================================================

def load_to_duckdb(
    df_raw: pl.DataFrame,
    df_clean: pl.DataFrame,
    run_id: str,
    comments_total: int,
    dirty_filtered: int,
    spam_truncated: int,
    api_success: int,
    api_fail: int,
) -> None:
    """将 DataFrame 写入 DuckDB ODS/DWD 表，并写入 ETL 日志"""

    conn = get_connection()
    try:
        conn.execute("PRAGMA warnings_as_errors = false")
    except Exception:
        pass  # Older DuckDB versions don't have this pragma

    # ODS：INSERT OR REPLACE（主键去重，幂等）
    if not df_raw.is_empty():
        # 使用 iter_rows 避免 pyarrow/numpy 依赖
        df_with_run = df_raw.with_columns(pl.lit(run_id).alias("etl_run_id"))
        for row in df_with_run.iter_rows(named=True):
            conn.execute("""
                INSERT INTO ods_raw_comments
                (id, video_bvid, video_title, up_uid, up_name,
                 content, like_count, post_time, post_time_str, etl_run_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    video_bvid = excluded.video_bvid,
                    video_title = excluded.video_title,
                    up_uid = excluded.up_uid,
                    up_name = excluded.up_name,
                    content = excluded.content,
                    like_count = excluded.like_count,
                    post_time = excluded.post_time,
                    post_time_str = excluded.post_time_str,
                    etl_run_id = excluded.etl_run_id
            """, [
                str(row["id"]),
                str(row["video_bvid"]),
                str(row["video_title"]),
                int(row["up_uid"]),
                str(row["up_name"]),
                str(row["content"]),
                int(row["like_count"]),
                int(row["post_time"]),
                str(row["post_time_str"]),
                str(row["etl_run_id"]),
            ])

    # DWD：先清空该 run_id 的旧数据，再插入（确保幂等）
    if not df_clean.is_empty():
        # 删除旧记录
        conn.execute("DELETE FROM dwd_clean_comments WHERE etl_run_id = ?", [run_id])

        # 使用 iter_rows 避免 pyarrow/numpy 依赖
        for row in df_clean.iter_rows(named=True):
            conn.execute("""
                INSERT INTO dwd_clean_comments
                (id, video_bvid, video_title, up_uid, up_name,
                 content, like_count, post_time, etl_run_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                str(row["id"]),
                str(row["video_bvid"]),
                str(row["video_title"]),
                int(row["up_uid"]),
                str(row["up_name"]),
                str(row["content"]),
                int(row["like_count"]),
                str(row["post_time_norm"]),  # post_time_norm is the datetime column
                str(row["etl_run_id"]),
            ])

    # DWS 汇总：按视频聚合
    if not df_clean.is_empty():
        conn.execute("DELETE FROM dws_comment_stats WHERE etl_run_id = ?", [run_id])
        # 使用 Polars 的 group_by 然后逐行插入
        dws_agg = df_clean.group_by("video_bvid", "video_title", "up_uid", "up_name", "etl_run_id").agg([
            pl.col("id").count().alias("total_comments"),
            pl.col("like_count").sum().alias("total_likes"),
            pl.col("like_count").mean().alias("avg_likes"),
        ])
        for row in dws_agg.iter_rows(named=True):
            conn.execute("""
                INSERT INTO dws_comment_stats
                (video_bvid, video_title, up_uid, up_name,
                 total_comments, total_likes, avg_likes, etl_run_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                str(row["video_bvid"]),
                str(row["video_title"]),
                int(row["up_uid"]),
                str(row["up_name"]),
                int(row["total_comments"]),
                int(row["total_likes"]),
                float(row["avg_likes"]),
                str(row["etl_run_id"]),
            ])

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
        TARGET_UP_UID,
        TARGET_UP_NAME,
        FETCH_VIDEO_COUNT,
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
# 防频繁重复运行
# ============================================================

def check_recent_run() -> bool:
    """
    检查 sys_etl_logs 最近一条记录。
    若距今不足 RUN_INTERVAL_MINUTES 分钟，返回 True（应跳过）。
    """
    try:
        conn = get_connection()
        row = conn.execute("""
            SELECT run_time FROM sys_etl_logs
            ORDER BY run_time DESC LIMIT 1
        """).fetchone()
        if row and row[0]:
            last_run: datetime = row[0]
            elapsed = (datetime.now(timezone.utc) - last_run).total_seconds() / 60
            if elapsed < RUN_INTERVAL_MINUTES:
                logger.info(
                    "上次运行距今 %.0f 分钟（< %d分钟），跳过本次执行",
                    elapsed, RUN_INTERVAL_MINUTES
                )
                return True
    except Exception:
        pass
    return False


# ============================================================
# 主流程
# ============================================================

async def run_etl() -> None:
    """ETL 主流程：抽取 → 清洗 → 加载"""
    logger.info("=" * 50)
    logger.info("B站 ETL 流水线启动 | UP: %s (UID: %d)", TARGET_UP_NAME, TARGET_UP_UID)
    logger.info("=" * 50)

    # 0. 初始化 ETL 表
    init_etl_tables()
    logger.info("ETL 表初始化完成")

    # 1. 防频繁重复运行
    if check_recent_run():
        return

    # 2. 构建凭证
    credential = _build_credential()

    # 3. 抽取（并发爬虫）
    comments, api_success, api_fail = await crawl_all(credential)

    if not comments:
        logger.warning("未抓取到任何评论，ETL 中止")
        return

    # 4. 获取视频元数据（用于 ODS 填充 video_title）
    try:
        videos = await fetch_user_videos(TARGET_UP_UID, credential, FETCH_VIDEO_COUNT)
    except Exception as e:
        logger.warning("无法获取视频元数据，使用空标题: %s", e)
        videos = []

    # 5. 生成 run_id
    run_id = str(uuid.uuid4())[:8]

    # 6. Transform → ODS DataFrame
    df_raw = transform_to_raw_df(comments, videos)

    # 7. Transform → DWD DataFrame（Polars 清洗）
    df_clean, rule1_blocked, rule2_truncated = clean_df(df_raw, run_id)

    # 8. Load → DuckDB
    load_to_duckdb(
        df_raw=df_raw,
        df_clean=df_clean,
        run_id=run_id,
        comments_total=len(comments),
        dirty_filtered=rule1_blocked,
        spam_truncated=rule2_truncated,
        api_success=api_success,
        api_fail=api_fail,
    )

    logger.info("✅ ETL 流水线执行完成 | run_id=%s", run_id)


def main():
    """入口函数"""
    try:
        asyncio.run(run_etl())
    except KeyboardInterrupt:
        logger.info("ETL 被用户中断")
    except Exception as e:
        logger.error("ETL 执行失败: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
