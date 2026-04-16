import random
import uuid
from datetime import datetime, timedelta

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).parent.parent))

from backend.database import get_connection


# -------- 真实数据模板 --------
UP_NAMES = [
    "老番茄", "何同学", "罗翔说刑法", "李子柒", "手工耿",
    "回形针", "巫师财经", "三天票房", "BBBBB", "凉风KAZE",
    "大漠叔叔", "妈咪说", "长不太高", "沙盘上的千年", "狂丸",
]
VIDEO_IDS = [f"BV{random.randint(10**9, 10**10):010d}" for _ in range(20)]

REAL_CONTENTS = [
    "这视频太硬核了", "前排围观", "666666", "一键三连走起",
    "笑死我了哈哈哈哈", "UP主加油", "质量也太高了吧",
    "我超，这期信息量好大", "终于等到了", "催更催更",
    "建议下次做个合集", "太肝了Respect", "这波赢麻了",
    "数据可视化好评", "专业 专业", "确实顶",
    "先码后看", "这UP是懂流量的", "整活还得是你",
    "太真实了", "是我本人没错了", "破防了",
    "不愧是天花板", "满分作文", "格局打开",
]

# -------- 脏数据类型 --------
def make_empty_content() -> str:
    return ""

def make_spam_content() -> str:
    base = random.choice(["哈", "啊", "呃", "呵", "666"])
    return base * random.randint(5, 15)

def make_html_injection() -> str:
    return random.choice([
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "<a href='http://evil.com'>点我</a>",
        "<div style='position:fixed;top:0'>钓鱼</div>",
    ])

def make_unicode_spam() -> str:
    # 各种奇奇怪怪的 Unicode 字符刷屏
    pools = [
        "\u062a\u062a\u062a",       # 阿拉伯字符
        "\u0679\u0679\u0679",       # 维吾尔风格
        "\uff46\uff46\uff46",       # 全角字母
        "\u0647\u0647\u0647",       # 另一种阿拉伯
        "\u200b\u200b\u200b",       # 零宽字符
    ]
    return random.choice(pools)

def make_bad_timestamp() -> str:
    # 超出合法范围的日期时间
    return random.choice([
        "2010-02-30 12:00:00",  # 2月30日不存在
        "2025-13-45 99:99:99",  # 月和小时都超
        "1999-00-01 00:00:00",  # 月份为0
        "2023-04-31 12:00:00",  # 4月31日不存在
    ])

def make_short_content() -> str:
    return random.choice(["哈", "啊", "呵", "嗯", "哦"])

# -------- ODS 数据生成 --------
def generate_ods_rows(n: int = 500) -> list[dict]:
    """生成 n 条 ODS 层弹幕记录，包含约 25% 脏数据"""
    rows = []
    dirty_indices = set(random.sample(range(n), k=int(n * 0.25)))

    for i in range(n):
        is_dirty = i in dirty_indices
        row = {
            "id": str(uuid.uuid4()),
            "video_id": random.choice(VIDEO_IDS),
            "up_id": random.randint(1000, 9999),
            "up_name": random.choice(UP_NAMES),
            "content": random.choice(REAL_CONTENTS),
            "send_time": (
                datetime.now() - timedelta(days=random.randint(0, 365))
            ).strftime("%Y-%m-%d %H:%M:%S"),
            "like_count": random.randint(0, 5000),
        }

        if is_dirty:
            dirty_type = random.choice([
                "empty", "spam", "html", "unicode", "bad_time", "short"
            ])
            if dirty_type == "empty":
                row["content"] = make_empty_content()
            elif dirty_type == "spam":
                row["content"] = make_spam_content()
            elif dirty_type == "html":
                row["content"] = make_html_injection()
            elif dirty_type == "unicode":
                row["content"] = make_unicode_spam()
            elif dirty_type == "bad_time":
                row["send_time"] = make_bad_timestamp()
            elif dirty_type == "short":
                row["content"] = make_short_content()

        rows.append(row)

    return rows


# -------- 主初始化函数 --------
def init_database() -> None:
    """建表 + ODS → DWD → DWS 三层数据灌注"""
    conn = get_connection()

    # 1. ODS 层
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ods_raw_danmaku (
            id          VARCHAR,
            video_id    VARCHAR,
            up_id       INTEGER,
            up_name     VARCHAR,
            content     VARCHAR,
            send_time   VARCHAR,
            like_count  INTEGER
        )
    """)

    # 2. DWD 层（清洗后）
    conn.execute("""
        CREATE TABLE IF NOT EXISTS dwd_clean_danmaku (
            id          VARCHAR,
            video_id    VARCHAR,
            up_id       INTEGER,
            up_name     VARCHAR,
            content     VARCHAR,
            send_time   TIMESTAMP,
            like_count  INTEGER
        )
    """)

    # 3. DWS 层（UP 主汇总）
    conn.execute("""
        CREATE TABLE IF NOT EXISTS dws_up_stats (
            up_id           INTEGER,
            up_name         VARCHAR,
            danmaku_count   INTEGER,
            total_likes     BIGINT,
            avg_likes       DOUBLE,
            video_count     INTEGER
        )
    """)

    # 已有数据则跳过
    if conn.execute("SELECT count(*) FROM ods_raw_danmaku").fetchone()[0] > 0:
        return

    # 灌注 ODS
    ods_rows = generate_ods_rows(500)
    for row in ods_rows:
        conn.execute(
            "INSERT INTO ods_raw_danmaku VALUES (?, ?, ?, ?, ?, ?, ?)",
            [row["id"], row["video_id"], row["up_id"], row["up_name"],
             row["content"], row["send_time"], row["like_count"]]
        )

    # 清洗 → DWD
    conn.execute("""
        INSERT INTO dwd_clean_danmaku
        SELECT
            id,
            video_id,
            up_id,
            up_name,
            content,
            TRY_CAST(send_time AS TIMESTAMP) AS send_time,
            like_count
        FROM ods_raw_danmaku
        WHERE
            content IS NOT NULL
            AND content != ''
            AND length(content) >= 2
            AND content NOT ILIKE '%<%'
            AND send_time NOT ILIKE '%[^0-9\\-: ]%'
            AND send_time SIMILAR TO '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}'
            AND TRY_CAST(send_time AS TIMESTAMP) IS NOT NULL
            AND TRY_CAST(send_time AS TIMESTAMP) >= '2020-01-01'
            AND TRY_CAST(send_time AS TIMESTAMP) <= NOW()
    """)

    # 聚合 → DWS
    conn.execute("""
        INSERT INTO dws_up_stats
        SELECT
            up_id,
            up_name,
            COUNT(*) AS danmaku_count,
            SUM(like_count) AS total_likes,
            AVG(like_count) AS avg_likes,
            COUNT(DISTINCT video_id) AS video_count
        FROM dwd_clean_danmaku
        GROUP BY up_id, up_name
    """)

    conn.commit()
