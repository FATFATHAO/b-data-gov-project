import { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Position,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Card,
  Drawer,
  Typography,
  Tag,
  Space,
  Spin,
  message,
  Descriptions,
  theme,
} from 'antd';
import { fetchLineageGraph } from '../../api';
import type { LineageGraph, LineageNode } from '../../api/types';

const { Text } = Typography;

// ============ 自定义节点样式 ============
const nodeStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 8,
  border: '2px solid',
  minWidth: 180,
  textAlign: 'center',
  fontFamily: 'monospace',
  fontSize: 13,
  cursor: 'pointer',
  transition: 'box-shadow 0.2s',
};

interface CustomNodeData {
  label: string;
  layer: string;
  description: string;
  [key: string]: unknown;
}

const CustomNode = ({ data }: { data: CustomNodeData }) => {
  const style = layerNodeStyles[data.layer] ?? layerNodeStyles.ODS;
  return (
    <div
      style={{
        ...nodeStyle,
        background: style.bg,
        borderColor: style.border,
        color: style.color,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
        {data.label}
      </div>
      <Tag
        color={style.border}
        style={{ marginBottom: 0, fontSize: 11 }}
      >
        {data.layer} 层
      </Tag>
    </div>
  );
};

const nodeTypes = { customNode: CustomNode };

// ============ 主组件 ============
const Lineage = () => {
  const { token } = theme.useToken();
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // 节点样式（使用主题色）
  const layerNodeStyles: Record<string, { bg: string; border: string; color: string }> = {
    ODS: { bg: token.colorBgSpotlight, border: token.colorBorder, color: token.colorText },
    DWD: { bg: `${token.colorInfo}15`, border: token.colorInfo, color: token.colorInfo },
    DWS: { bg: `${token.colorSuccess}15`, border: token.colorSuccess, color: token.colorSuccess },
  };

  useEffect(() => {
    fetchLineageGraph()
      .then(setGraph)
      .catch(() => message.error('获取血缘图失败'))
      .finally(() => setLoading(false));
  }, []);

  // 根据 graph 构建 ReactFlow nodes + edges
  useEffect(() => {
    if (!graph) return;

    const xPositions: Record<string, number> = {
      ODS: 50,
      DWD: 400,
      DWS: 750,
    };

    // 同层节点垂直分布
    const layerCount: Record<string, number> = {};
    const builtNodes: Node[] = graph.nodes.map((node) => {
      const layer = node.layer;
      layerCount[layer] = (layerCount[layer] ?? 0) + 1;
      return {
        id: node.id,
        type: 'customNode',
        position: { x: xPositions[layer] ?? 300, y: (layerCount[layer] - 1) * 120 },
        data: {
          label: node.name,
          layer: node.layer,
          description: node.description,
        } as CustomNodeData,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    const builtEdges: Edge[] = graph.edges.map((edge, i) => ({
      id: `e${i}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: true,
      style: { stroke: token.colorBorder, strokeWidth: 2 },
      labelStyle: { fontSize: 12, fill: token.colorTextSecondary },
      labelBgStyle: { fill: token.colorBgElevated },
      labelBgPadding: [4, 8] as [number, number],
      labelBgBorderRadius: 4,
    }));

    setNodes(builtNodes);
    setEdges(builtEdges);
  }, [graph, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const found = graph?.nodes.find((n) => n.id === node.id);
      if (found) {
        setSelectedNode(found);
        setDrawerOpen(true);
      }
    },
    [graph]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* 顶部说明 */}
      <Card size="small">
        <Space>
          <Text type="secondary">数据血缘追踪 · </Text>
          <Text>点击节点查看详情，箭头表示数据流向（左侧原始层 → 中间明细层 → 右侧汇总层）</Text>
        </Space>
      </Card>

      {/* DAG 主画布 */}
      <Card
        size="small"
        bodyStyle={{ padding: 0, height: 500, position: 'relative' }}
        style={{ flex: 1 }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 200 }}>
            <Spin size="large" />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            style={{ background: token.colorBgLayout }}
          >
            <Background color={token.colorBorder} gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </Card>

      {/* 图例 */}
      <Card size="small" bodyStyle={{ padding: '8px 16px' }}>
        <Space size="large">
          <Space>
            <div style={{ width: 16, height: 16, background: token.colorBgSpotlight, border: `2px solid ${token.colorBorder}`, borderRadius: 4 }} />
            <Text type="secondary">ODS 原始层</Text>
          </Space>
          <Space>
            <div style={{ width: 16, height: 16, background: `${token.colorInfo}15`, border: `2px solid ${token.colorInfo}`, borderRadius: 4 }} />
            <Text type="secondary">DWD 明细层</Text>
          </Space>
          <Space>
            <div style={{ width: 16, height: 16, background: `${token.colorSuccess}15`, border: `2px solid ${token.colorSuccess}`, borderRadius: 4 }} />
            <Text type="secondary">DWS 汇总层</Text>
          </Space>
          <Text type="secondary">| 虚线箭头 = 数据流动方向（动画）</Text>
        </Space>
      </Card>

      {/* 节点详情 Drawer */}
      <Drawer
        title={
          selectedNode ? (
            <Space>
              <Tag color={layerNodeStyles[selectedNode.layer]?.border ?? 'default'}>
                {selectedNode.layer}
              </Tag>
              <Text strong style={{ fontFamily: 'monospace' }}>{selectedNode.name}</Text>
            </Space>
          ) : undefined
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={360}
        placement="right"
      >
        {selectedNode && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="表名">{selectedNode.name}</Descriptions.Item>
            <Descriptions.Item label="层级">{selectedNode.layer} 层</Descriptions.Item>
            <Descriptions.Item label="描述" labelStyle={{ fontWeight: 600 }}>
              {selectedNode.description}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default Lineage;
