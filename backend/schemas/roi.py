from pydantic import BaseModel


class StorageStats(BaseModel):
    ods_size_mb: float
    dwd_size_mb: float
    dws_size_mb: float
    total_size_mb: float
    compression_ratio: float  # DWD/ODS 压缩比
