"""
弹幕采集器模块
B-DataGov Lite — Collectors

支持:
- B站直播弹幕 (bili_live_collector)
- B站视频弹幕 (bili_video_collector)
- 斗鱼直播弹幕 (douyu_collector)
"""

from .bili_live_collector import main as bili_live_main
from .bili_video_collector import main as bili_video_main

__all__ = ["bili_live_main", "bili_video_main"]