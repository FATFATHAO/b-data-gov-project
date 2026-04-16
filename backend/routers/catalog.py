import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).parent.parent))

from fastapi import APIRouter, HTTPException
from backend.schemas.catalog import TableInfo, TableSchema
from backend.services import catalog_service

router = APIRouter(prefix="/api/catalog", tags=["资产目录"])


@router.get("/tables", response_model=list[TableInfo])
def list_tables():
    return catalog_service.list_tables()


@router.get("/schema/{table_name}", response_model=TableSchema)
def get_schema(table_name: str):
    try:
        return catalog_service.get_table_schema(table_name)
    except Exception:
        raise HTTPException(status_code=404, detail=f"表 '{table_name}' 不存在")
