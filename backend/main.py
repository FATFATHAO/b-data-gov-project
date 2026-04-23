import sys
from pathlib import Path

# 确保项目根目录在 sys.path 中（支持 uvicorn backend.main:app 方式启动）
sys.path.insert(0, str(Path(__file__).parent.parent))

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import init_etl_tables, init_auth_tables
from backend.mock_data import init_database
from backend.routers import catalog, quality, lineage, roi, tasks, auth, monitor


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ODS/DWD/DWS 弹幕表（mock 数据）
    init_database()
    # ETL 相关表（B站真实评论爬取）
    init_etl_tables()
    # 用户认证表
    init_auth_tables()
    yield


app = FastAPI(
    title="B-DataGov Lite",
    description="B站数据治理与可视化平台 API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalog.router)
app.include_router(quality.router)
app.include_router(lineage.router)
app.include_router(roi.router)
app.include_router(tasks.router)
app.include_router(auth.router)
app.include_router(monitor.router)


@app.get("/")
def root():
    return {"message": "B-DataGov Lite API", "version": "0.1.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
