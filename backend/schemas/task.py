from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class TaskCreateRequest(BaseModel):
    target_type: Literal["video", "up"]
    target_id: str = Field(..., description="BVID (video模式) 或 UID (up模式)")
    fetch_limit: int = Field(default=100, ge=1, le=500, description="采集条数")


class TaskCreateResponse(BaseModel):
    task_id: str
    message: str


class TaskItem(BaseModel):
    task_id: str
    target_type: str
    target_id: str
    fetch_limit: int
    up_name: str
    status: str
    error_msg: Optional[str]
    created_at: datetime
    updated_at: datetime


class TaskListResponse(BaseModel):
    tasks: list[TaskItem]
    total: int
