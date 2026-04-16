import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).parent.parent))

import uuid
from fastapi import APIRouter, BackgroundTasks

from backend.schemas.task import (
    TaskCreateRequest,
    TaskCreateResponse,
    TaskItem,
    TaskListResponse,
)
from backend.services import etl_service
from backend.database import get_connection

router = APIRouter(prefix="/api/tasks", tags=["任务调度"])


def _insert_task_record(
    task_id: str,
    target_type: str,
    target_id: str,
    fetch_limit: int,
) -> None:
    """插入一条任务记录（状态为 running）"""
    conn = get_connection()
    conn.execute("""
        INSERT INTO sys_tasks (task_id, target_type, target_id, fetch_limit, status)
        VALUES (?, ?, ?, ?, 'running')
    """, [task_id, target_type, target_id, fetch_limit])
    conn.commit()


@router.post("", response_model=TaskCreateResponse)
def create_task(
    body: TaskCreateRequest,
    background_tasks: BackgroundTasks,
):
    """
    POST /api/tasks

    请求体：
    {
      "target_type": "video" | "up",
      "target_id": "BVxxxx" | "517327498",
      "fetch_limit": 100
    }

    使用 FastAPI BackgroundTasks 后台执行，立即返回 task_id。
    前端轮询 GET /api/tasks 可获取最新状态。
    """
    task_id = str(uuid.uuid4())

    # 插入任务记录（状态为 running）
    _insert_task_record(task_id, body.target_type, body.target_id, body.fetch_limit)

    # 后台执行 ETL
    background_tasks.add_task(
        etl_service.run_bilibili_etl_task,
        task_id=task_id,
        target_type=body.target_type,
        target_id=body.target_id,
        fetch_limit=body.fetch_limit,
    )

    return TaskCreateResponse(
        task_id=task_id,
        message="任务已提交后台执行",
    )


@router.get("", response_model=TaskListResponse)
def list_tasks():
    """
    GET /api/tasks

    返回所有历史任务，按创建时间倒序。
    前端可据此展示任务列表，并轮询检查状态变化。
    """
    tasks, total = etl_service.list_tasks()
    return TaskListResponse(
        tasks=[TaskItem(**t) for t in tasks],
        total=total,
    )
