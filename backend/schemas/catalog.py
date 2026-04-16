from pydantic import BaseModel


class ColumnInfo(BaseModel):
    name: str
    type: str


class TableInfo(BaseModel):
    name: str
    layer: str
    row_count: int


class TableSchema(BaseModel):
    table_name: str
    columns: list[ColumnInfo]
    row_count: int
