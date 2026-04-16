from schemas.lineage import LineageGraph, LineageNode, LineageEdge


def get_lineage_graph() -> LineageGraph:
    nodes = [
        LineageNode(
            id="ods_raw_danmaku",
            name="ods_raw_danmaku",
            layer="ODS",
            description="B站弹幕原始数据（未经清洗）",
        ),
        LineageNode(
            id="dwd_clean_danmaku",
            name="dwd_clean_danmaku",
            layer="DWD",
            description="清洗后的弹幕明细数据（过滤脏数据、空值、非法时间戳）",
        ),
        LineageNode(
            id="dws_up_stats",
            name="dws_up_stats",
            layer="DWS",
            description="UP主互动统计汇总表（基于干净数据聚合）",
        ),
    ]

    edges = [
        LineageEdge(
            source="ods_raw_danmaku",
            target="dwd_clean_danmaku",
            label="数据清洗",
        ),
        LineageEdge(
            source="dwd_clean_danmaku",
            target="dws_up_stats",
            label="汇总聚合",
        ),
    ]

    return LineageGraph(nodes=nodes, edges=edges)
