import { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Statistic, Row, Col, Typography, Spin, message, theme } from 'antd';
import { DatabaseOutlined, TableOutlined, ClusterOutlined } from '@ant-design/icons';
import { fetchTables, fetchTableSchema } from '../../api';
import type { TableInfo, TableSchema } from '../../api/types';

const { Text } = Typography;

const Catalog = () => {
  const { token } = theme.useToken();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingSchema, setLoadingSchema] = useState(false);

  useEffect(() => {
    fetchTables()
      .then(setTables)
      .catch(() => message.error('获取表列表失败'))
      .finally(() => setLoadingTables(false));
  }, []);

  const handleTableClick = (tableName: string) => {
    if (selectedTable === tableName) return;
    setSelectedTable(tableName);
    setSchema(null);
    setLoadingSchema(true);
    fetchTableSchema(tableName)
      .then(setSchema)
      .catch(() => message.error(`获取表结构失败: ${tableName}`))
      .finally(() => setLoadingSchema(false));
  };

  const totalRows = tables.reduce((sum, t) => sum + t.row_count, 0);

  const schemaColumns = [
    {
      title: '字段名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Text strong style={{ fontFamily: 'monospace' }}>
          {name}
        </Text>
      ),
    },
    {
      title: '数据类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
  ];

  const tableListColumns = [
    {
      title: '表名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <TableOutlined />
          <Text
            strong
            style={{
              cursor: 'pointer',
              color: selectedTable === name ? token.colorPrimary : token.colorText,
              fontFamily: 'monospace',
            }}
            onClick={() => handleTableClick(name)}
          >
            {name}
          </Text>
        </Space>
      ),
    },
    {
      title: '层级',
      dataIndex: 'layer',
      key: 'layer',
      render: (layer: string) => {
        const colorMap: Record<string, string> = {
          'ODS（原始层）': 'orange',
          'DWD（明细层）': 'green',
          'DWS（汇总层）': 'purple',
        };
        return <Tag color={colorMap[layer] || 'default'}>{layer}</Tag>;
      },
    },
    {
      title: '行数',
      dataIndex: 'row_count',
      key: 'row_count',
      align: 'right' as const,
      render: (count: number) => <Text type="secondary">{count.toLocaleString()}</Text>,
    },
  ];

  return (
    <div>
      {/* 顶部概览卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="数据表总数"
              value={tables.length}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: token.colorPrimary }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="数据总行数"
              value={totalRows}
              prefix={<TableOutlined />}
              valueStyle={{ color: token.colorSuccess }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="数据层级"
              value={3}
              prefix={<ClusterOutlined />}
              suffix="层"
              valueStyle={{ color: token.colorPrimary }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 左侧：表列表 */}
        <Col span={8}>
          <Card
            title="数据表列表"
            size="small"
            style={{ height: '100%' }}
          >
            <Table
              size="small"
              dataSource={tables}
              columns={tableListColumns}
              rowKey="name"
              pagination={false}
              loading={loadingTables}
              rowClassName={(record) =>
                selectedTable === record.name ? 'ant-table-row-selected' : ''
              }
              onRow={(record) => ({
                onClick: () => handleTableClick(record.name),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>

        {/* 右侧：选中表的结构 */}
        <Col span={16}>
          <Card
            title={
              selectedTable ? (
                <Space>
                  <TableOutlined />
                  <span style={{ fontFamily: 'monospace' }}>{selectedTable}</span>
                  <Tag>{schema?.columns.length ?? 0} 个字段</Tag>
                </Space>
              ) : (
                '请选择左侧表名查看结构'
              )
            }
            size="small"
            style={{ height: '100%' }}
          >
            {loadingSchema ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : schema ? (
              <Table
                size="small"
                dataSource={schema.columns}
                columns={schemaColumns}
                rowKey="name"
                pagination={{ pageSize: 10 }}
                footer={() => (
                  <Text type="secondary">
                    共 {schema.columns.length} 个字段，当前表 {schema.row_count.toLocaleString()} 条记录
                  </Text>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: token.colorTextQuaternary }}>
                <DatabaseOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                <Text type="secondary">点击左侧表名查看字段结构</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Catalog;
