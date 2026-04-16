from pydantic import BaseModel


class LineageNode(BaseModel):
    id: str
    name: str
    layer: str
    description: str


class LineageEdge(BaseModel):
    source: str
    target: str
    label: str


class LineageGraph(BaseModel):
    nodes: list[LineageNode]
    edges: list[LineageEdge]
