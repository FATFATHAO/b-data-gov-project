import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).parent.parent))

from fastapi import APIRouter
from backend.schemas.roi import StorageStats
from backend.services import roi_service

router = APIRouter(prefix="/api/roi", tags=["治理成效"])


@router.get("/storage", response_model=StorageStats)
def get_storage():
    return roi_service.get_storage_stats()
