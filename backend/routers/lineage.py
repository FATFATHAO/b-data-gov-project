import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).parent.parent))

from fastapi import APIRouter
from backend.schemas.lineage import LineageGraph
from backend.services import lineage_service

router = APIRouter(prefix="/api/lineage", tags=["数据血缘"])


@router.get("/graph", response_model=LineageGraph)
def get_graph():
    return lineage_service.get_lineage_graph()
