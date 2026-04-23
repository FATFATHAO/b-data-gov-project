"""
backend/routers/monitor.py
Phase 5 - 实时监控数据 API

从 Redis 读取：
- current_hot_rooms (ZSET) → 热门房间排行
- history:{room_id} (LIST) → 弹幕数量历史趋势
- wordcloud:{room_id} (STRING, JSON) → 词云数据
- sentiment:{room_id} (LIST) → 情感历史
- sentiment:current:{room_id} (STRING) → 最新情感值

收藏功能：
- 内存字典持久化（后续可迁移 PostgreSQL）
"""

import sys as _sys
from pathlib import Path

_sys.path.insert(0, str(Path(__file__).parent.parent))

# 项目根目录（.venv 在 backend/.venv 下）
_ROOT = Path(__file__).parent.parent.parent
_VENV_PYTHON = str(_ROOT / "backend" / ".venv" / "bin" / "python")

import json
import logging
import os
import signal
import subprocess
import time
from typing import Optional

import redis
from fastapi import APIRouter, HTTPException

from backend.config import REDIS_HOST, REDIS_PORT

logger = logging.getLogger("monitor")

router = APIRouter(prefix="/api/live", tags=["monitor"])

# Redis 连接
_redis_client: Optional[redis.Redis] = None


def _get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    return _redis_client


# ============================================================
# 收藏功能（内存持久化）
# ============================================================

_favorites: dict[str, dict] = {}


def _fav_key(room_id: str, platform: str, target_type: str) -> str:
    return f"{platform}:{target_type}:{room_id}"


# ============================================================
# 进程管理（collector subprocess）
# ============================================================

# { room_id: { "pid": int, "type": "live"|"video", "platform": str } }
_running_collectors: dict[str, dict] = {}


def _start_collector(raw_id: str, platform: str, collector_type: str, redis_room_id: str) -> None:
    """
    启动 collector 子进程
    raw_id: 原始 ID（如 "732" 或 "BVxxx"）
    collector_type: "live" | "video"
    redis_room_id: 带前缀的完整 ID（如 "bilibili_live:732"）
    """
    # 复用已有的 collector（key 改为 redis_room_id）
    if redis_room_id in _running_collectors:
        logger.info("Collector already running for %s", redis_room_id)
        return

    # 构建命令
    if collector_type == "live":
        cmd = [
            _VENV_PYTHON, "-m", "backend.collectors.bili_live_collector",
            "--room-id", raw_id,
        ]
    else:  # video
        cmd = [
            _VENV_PYTHON, "-m", "backend.collectors.bili_video_collector",
            "--bv-id", raw_id,
        ]

    # 设置环境变量
    env = os.environ.copy()
    env["PYTHONPATH"] = str(_ROOT)

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(_ROOT / "backend"),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        _running_collectors[redis_room_id] = {
            "pid": proc.pid,
            "type": collector_type,
            "platform": platform,
        }
        logger.info("Started collector for %s (PID=%d)", redis_room_id, proc.pid)
    except Exception as e:
        logger.error("Failed to start collector: %s", e)
        raise


def _stop_collector(redis_room_id: str) -> None:
    """停止 collector 子进程（强制 SIGKILL 确保 aiohttp 进程被终止）"""
    # 始终执行 force kill，不依赖 _running_collectors（进程重启后 in-memory dict 会丢失）
    # 从 redis_room_id 提取 raw_id 用于 pkill（如 "bilibili_live:732" → "732"）
    raw_id = redis_room_id.split(":")[-1]
    _force_kill_by_name(raw_id)

    if redis_room_id not in _running_collectors:
        logger.warning("No collector found in memory for %s", redis_room_id)
        return

    info = _running_collectors.pop(redis_room_id)
    pid = info["pid"]
    try:
        os.kill(pid, signal.SIGKILL)
        logger.info("Killed collector PID=%d for %s", pid, redis_room_id)
    except ProcessLookupError:
        logger.info("Collector PID=%d already dead", pid)
    except Exception as e:
        logger.warning("Failed to kill collector PID=%d: %s", pid, e)


def _force_kill_by_name(room_id: str) -> None:
    """通过 room_id 查找并杀死可能残留的 collector 进程"""
    try:
        # pkill -s 9 发送 SIGKILL（强制杀死），因为 aiohttp WebSocket 会忽略 SIGTERM
        subprocess.run(["pkill", "-s", "9", "-f", f"bili_live_collector.*{room_id}"], check=False)
        subprocess.run(["pkill", "-s", "9", "-f", f"bili_video_collector.*{room_id}"], check=False)
        logger.info("Force kill (SIGKILL) attempted for room %s", room_id)
    except Exception as e:
        logger.warning("Force kill failed for room %s: %s", room_id, e)


# ============================================================
# API Endpoints
# ============================================================

@router.get("/rank/{platform}")
def get_rank(platform: str):
    """
    GET /api/live/rank/{platform}

    从 Redis current_hot_rooms ZSET 读取热门房间排行。
    """
    r = _get_redis()
    try:
        # ZREVRANGE with scores: [(member, score), ...]
        items = r.zrevrange("current_hot_rooms", 0, 49, withscores=True)
    except Exception as e:
        logger.error("Redis ZSET read error: %s", e)
        raise HTTPException(status_code=500, detail="Redis read error")

    result = []
    for member, score in items:
        # member 格式: "bilibili_live:732" 或 "bilibili_video:BVxxx"
        # platform filter
        if not member.startswith(platform):
            continue

        # 尝试从 ZSET score 解析 heat
        heat = int(score) if score else 0

        # 从 Redis hash 获取详情
        room_key = f"room:info:{member}"
        info = r.hgetall(room_key)

        # 尝试解析 target_type
        if "video" in member:
            target_type = "video"
        else:
            target_type = "live"

        result.append({
            "room_id": member,
            "heat": heat,
            "status": info.get("status", "UNKNOWN"),
            "target_type": target_type,
            "title": info.get("title", ""),
            "anchor_name": info.get("anchor_name", ""),
        })

    return {"data": result}


@router.get("/monitor/history/{room_id}")
def get_history(room_id: str):
    """
    GET /api/live/monitor/history/{room_id}

    从 Redis history:{room_id} LIST 读取弹幕数量历史趋势。
    room_id 格式: bilibili_live:732 或 bilibili_video:BVxxx
    """
    r = _get_redis()
    key = f"history:{room_id}"

    try:
        raw = r.lrange(key, 0, -1)
    except Exception as e:
        logger.error("Redis LIST read error for %s: %s", key, e)
        raise HTTPException(status_code=500, detail="Redis read error")

    # 不再删除 history key（DELETE 导致轮询间隔内写入的数据丢失）
    # 数据通过 Redis TTL 自然清理（live 3600s, video 永久）

    result = []
    for item in raw:
        try:
            obj = json.loads(item)
            ts = obj.get("ts")
            if ts:
                # ts 可以是毫秒时间戳（数字）或日期时间字符串（YYYY-MM-DD HH:mm:ss）
                try:
                    # 尝试作为数字时间戳处理（毫秒）
                    ms = int(ts)
                    time_str = time.strftime("%H:%M:%S", time.localtime(ms / 1000))
                except (ValueError, TypeError):
                    # 作为日期时间字符串处理，直接提取 HH:mm:ss
                    if isinstance(ts, str) and " " in ts:
                        time_str = ts.split(" ")[1]  # "2026-04-23 12:42:53" → "12:42:53"
                    else:
                        time_str = ""
            else:
                time_str = ""
            result.append({
                "time": time_str,
                "value": obj.get("count", 0),
            })
        except Exception:
            pass

    # 按 time 升序
    result.sort(key=lambda x: x["time"])
    return {"data": result}


@router.get("/monitor/wordcloud/{room_id}")
def get_wordcloud(room_id: str):
    """
    GET /api/live/monitor/wordcloud/{room_id}

    从 Redis wordcloud:{room_id} STRING 读取词云数据。
    room_id 格式: bilibili_live:732 或 bilibili_video:BVxxx
    """
    r = _get_redis()
    key = f"wordcloud:{room_id}"

    try:
        raw = r.get(key)
    except Exception as e:
        logger.error("Redis STRING read error for %s: %s", key, e)
        raise HTTPException(status_code=500, detail="Redis read error")

    if not raw:
        return {"data": []}

    try:
        data = json.loads(raw)
        # 兼容两种格式: [{"name": "x", "value": 10}] 或 {"words": [...]}
        if isinstance(data, list):
            return {"data": data}
        elif isinstance(data, dict) and "words" in data:
            return {"data": data["words"]}
        else:
            return {"data": []}
    except Exception:
        return {"data": []}


@router.get("/monitor/sentiment/{room_id}")
def get_sentiment(room_id: str):
    """
    GET /api/live/monitor/sentiment/{room_id}

    从 Redis sentiment:{room_id} LIST 读取情感历史。
    room_id 格式: bilibili_live:732 或 bilibili_video:BVxxx
    """
    r = _get_redis()
    key = f"sentiment:{room_id}"

    try:
        raw = r.lrange(key, 0, -1)
    except Exception as e:
        logger.error("Redis LIST read error for %s: %s", key, e)
        raise HTTPException(status_code=500, detail="Redis read error")

    result = []
    for item in raw:
        try:
            obj = json.loads(item)
            result.append({
                "ts": obj.get("ts", 0),
                "value": float(obj.get("value", 0.0)),
                "count": int(obj.get("count", 0)),
            })
        except Exception:
            pass

    # 按 ts 升序
    result.sort(key=lambda x: x["ts"])
    return {"data": result}


@router.post("/monitor/start")
def start_monitor(body: dict):
    """
    POST /api/live/monitor/start

    启动直播/视频监控任务。
    {
      "room_id": "732" or "BVxxx",
      "platform": "bilibili",
      "type": "live" | "video"
    }
    """
    room_id = body.get("room_id", "")
    platform = body.get("platform", "bilibili")
    monitor_type = body.get("type", "live")

    if not room_id:
        raise HTTPException(status_code=400, detail="room_id is required")

    # 构建 Redis room_id 格式
    if monitor_type == "video":
        redis_room_id = f"bilibili_video:{room_id}"
    else:
        redis_room_id = f"bilibili_live:{room_id}"

    try:
        _start_collector(room_id, platform, monitor_type, redis_room_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 初始化 Redis room info
    r = _get_redis()
    room_key = f"room:info:{redis_room_id}"
    r.hset(room_key, mapping={
        "title": room_id,
        "anchor_name": "",
        "status": "RUNNING",
    })
    # 设置过期时间 24h
    r.expire(room_key, 86400)

    # 加入热门房间 ZSET（heat=0）
    r.zadd("current_hot_rooms", {redis_room_id: 0})

    return {"data": {"msg": "ok", "room_id": redis_room_id}}


@router.post("/monitor/stop")
def stop_monitor(body: dict):
    """
    POST /api/live/monitor/stop

    停止监控任务。
    {
      "room_id": "bilibili_live:732",
      "platform": "bilibili"
    }
    """
    room_id = body.get("room_id", "")
    platform = body.get("platform", "bilibili")

    if not room_id:
        raise HTTPException(status_code=400, detail="room_id is required")

    # 将 room_id 转换为完整的 redis_room_id 格式（与 start_monitor 保持一致）
    if len(room_id.split(":")) == 1:
        # raw_id 格式：只有数字或 BV 号，需要补上前缀
        if room_id.startswith("BV"):
            redis_room_id = f"bilibili_video:{room_id}"
        else:
            redis_room_id = f"bilibili_live:{room_id}"
    else:
        redis_room_id = room_id

    try:
        _stop_collector(redis_room_id)
    except Exception as e:
        logger.warning("Stop collector error: %s", e)

    # 更新 Redis room 状态（保留在 ZSET 中，status=STOPPED 按钮会变绿）
    r = _get_redis()
    room_key = f"room:info:{redis_room_id}"
    r.hset(room_key, "status", "STOPPED")

    return {"data": None}


@router.post("/monitor/delete")
def delete_monitor(body: dict):
    """
    POST /api/live/monitor/delete

    从监控列表中彻底删除房间（停止 collector + 清除 Redis 数据）。
    {
      "room_id": "bilibili_live:732",
      "platform": "bilibili"
    }
    """
    room_id = body.get("room_id", "")
    platform = body.get("platform", "bilibili")

    if not room_id:
        raise HTTPException(status_code=400, detail="room_id is required")

    # 统一转换为带前缀的 redis_room_id
    if ":" not in room_id:
        if room_id.startswith("BV"):
            redis_room_id = f"bilibili_video:{room_id}"
        else:
            redis_room_id = f"bilibili_live:{room_id}"
    else:
        redis_room_id = room_id

    # 停止 collector
    try:
        _stop_collector(redis_room_id)
    except Exception as e:
        logger.warning("Stop collector error: %s", e)

    # 从 Redis 彻底删除
    r = _get_redis()
    room_key = f"room:info:{redis_room_id}"
    r.delete(room_key)
    r.zrem("current_hot_rooms", redis_room_id)
    
    # 删除关联数据
    r.delete(f"history:{redis_room_id}")
    r.delete(f"wordcloud:{redis_room_id}")
    r.delete(f"sentiment:{redis_room_id}")
    r.delete(f"sentiment:current:{redis_room_id}")

    return {"data": {"msg": "已删除"}}


# ============================================================
# 收藏 API
# ============================================================

@router.get("/favorites/check")
def check_favorite(room_id: str, platform: str, target_type: str):
    """
    GET /api/live/favorites/check?room_id=732&platform=bilibili&target_type=live

    检查收藏状态。
    """
    key = _fav_key(room_id, platform, target_type)
    exists = key in _favorites
    return {"data": {"is_favorited": exists}}


@router.post("/favorites/toggle")
def toggle_favorite(body: dict):
    """
    POST /api/live/favorites/toggle

    {
      "room_id": "732",
      "platform": "bilibili",
      "target_type": "live"
    }
    """
    room_id = body.get("room_id", "")
    platform = body.get("platform", "bilibili")
    target_type = body.get("target_type", "live")

    key = _fav_key(room_id, platform, target_type)

    if key in _favorites:
        del _favorites[key]
        msg = "已取消收藏"
        is_favorited = False
    else:
        _favorites[key] = {
            "room_id": room_id,
            "platform": platform,
            "target_type": target_type,
            "created_at": time.time(),
        }
        msg = "已添加收藏"
        is_favorited = True

    return {"data": {"is_favorited": is_favorited, "msg": msg}}


@router.get("/favorites")
def list_favorites():
    """
    GET /api/live/favorites

    返回所有收藏。
    """
    return {"data": list(_favorites.values())}


# ============================================================
# 仪表盘统计
# ============================================================

@router.get("/dashboard/stats")
def dashboard_stats():
    """
    GET /api/live/dashboard/stats

    返回当前监控统计。
    """
    r = _get_redis()
    try:
        items = r.zrevrange("current_hot_rooms", 0, -1, withscores=True)
    except Exception:
        items = []

    live_count = sum(1 for m, _ in items if "live" in m)
    video_count = sum(1 for m, _ in items if "video" in m)
    total_heat = sum(s for _, s in items)

    return {
        "data": {
            "live_count": live_count,
            "video_count": video_count,
            "total_heat": int(total_heat),
        }
    }


# ============================================================
# 启动恢复（从 Redis 恢复 RUNNING 状态的房间监听）
# ============================================================

def _recover_running_collectors() -> None:
    """
    扫描 Redis 中所有 room:info:* 且 status=RUNNING 的房间，
    自动启动对应 collector 进程。用于后端重启后自动恢复监控。
    """
    r = _get_redis()
    recovered = 0
    for key in r.scan_iter("room:info:*"):
        status = r.hget(key, "status")
        if status != "RUNNING":
            continue
        # 从 key 提取 redis_room_id，如 "room:info:bilibili_live:732" → "bilibili_live:732"
        redis_room_id = key.replace("room:info:", "")
        # 从 redis_room_id 提取 raw_id
        raw_id = redis_room_id.split(":")[-1]
        # 判断类型
        if "video" in redis_room_id:
            collector_type = "video"
        else:
            collector_type = "live"
        try:
            _start_collector(raw_id, "bilibili", collector_type, redis_room_id)
            logger.info("Recovered collector for %s", redis_room_id)
            recovered += 1
        except Exception as e:
            logger.warning("Failed to recover collector for %s: %s", redis_room_id, e)
    if recovered > 0:
        logger.info("Startup recovery: %d collector(s) restored", recovered)


# 在模块加载时执行一次恢复（FastAPI startup 事件会在 lifespan 中触发）
# 为避免在 import 时执行，暴露为显式调用函数
def trigger_startup_recovery():
    _recover_running_collectors()
