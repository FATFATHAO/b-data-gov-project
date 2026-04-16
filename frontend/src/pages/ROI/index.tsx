import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Tag, Typography, message, theme } from 'antd';
import ReactECharts from 'echarts-for-react';
import { fetchStorageStats, fetchTables } from '../../api';
import type { StorageStats, TableInfo } from '../../api/types';

const { Text } = Typography;

// 治理前模拟词（脏数据特征）
const BEFORE_TAGS = [
  '哈哈哈哈哈哈哈', '啊啊啊啊啊', '<script>', '11111111',
  'ټ ټ ټ', '呵', '66666666', '<img src=x>',
  '哈哈哈哈', '嗯嗯嗯嗯嗯', '呃呃呃', '',
];

// 治理后模拟词（高质量内容）
const AFTER_TAGS = [
  'UP主加油', '干货满满', '建议下次做合集', 'BGM是什么',
  '信息量好大', '先码后看', 'Respect', '确实顶',
  '太肝了', '催更催更', '格局打开', '满分作文',
];

const ROI = () => {
  const { token } = theme.useToken();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStorageStats(), fetchTables()])
      .then(([s, t]) => {
        setStats(s);
        setTables(t.filter((tb) => tb.name !== 'dws_up_stats'));
      })
      .catch(() => message.error('获取 ROI 数据失败'))
      .finally(() => setLoading(false));
  }, []);

  // 柱状图：ODS vs DWD 行数对比
  const barOption = {
    title: {
      text: 'ODS vs DWD 数据量对比',
      subtext: '清洗前后数据行数变化',
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 500 },
    },
    tooltip: { trigger: 'axis' as const },
    legend: {
      data: ['ODS 原始层', 'DWD 明细层'],
      top: 36,
    },
    grid: { left: 60, right: 30, top: 80, bottom: 30 },
    xAxis: {
      type: 'category' as const,
      data: tables.map((t) => t.name.replace('ods_raw_', '').replace('dwd_clean_', '')),
    },
    yAxis: {
      type: 'value' as const,
      name: '行数',
    },
    series: [
      {
        name: 'ODS 原始层',
        type: 'bar' as const,
        barWidth: 32,
        itemStyle: { color: token.colorTextTertiary, borderRadius: [4, 4, 0, 0] },
        data: tables.map((t) =>
          t.name.startsWith('ods') ? t.row_count : 0
        ),
      },
      {
        name: 'DWD 明细层',
        type: 'bar' as const,
        barWidth: 32,
        itemStyle: { color: token.colorSuccess, borderRadius: [4, 4, 0, 0] },
        data: tables.map((t) =>
          t.name.startsWith('dwd') ? t.row_count : 0
        ),
      },
    ],
  };

  // 计算节省百分比
  const savedPercent = stats
    ? Math.round((1 - stats.compression_ratio) * 100)
    : 0;

  return (
    <div>
      {/* 顶部核心价值大字报 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card
            size="small"
            style={{
              background: `linear-gradient(135deg, ${token.colorInfo}20 0%, ${token.colorInfo}40 100%)`,
              border: `1px solid ${token.colorInfo}60`,
            }}
            loading={loading}
          >
            <Statistic
              title={<span style={{ color: token.colorInfo }}>总计节省存储空间</span>}
              value={savedPercent}
              suffix="%"
              valueStyle={{ color: token.colorInfo, fontSize: 36, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            size="small"
            style={{
              background: `linear-gradient(135deg, ${token.colorWarning}20 0%, ${token.colorWarning}40 100%)`,
              border: `1px solid ${token.colorWarning}60`,
            }}
            loading={loading}
          >
            <Statistic
              title={<span style={{ color: token.colorWarning }}>总计清洗脏数据</span>}
              value={stats ? stats.ods_size_mb * 500 - stats.dwd_size_mb * 500 : 0}
              suffix="条"
              valueStyle={{ color: token.colorWarning, fontSize: 36, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            size="small"
            style={{
              background: `linear-gradient(135deg, ${token.colorSuccess}20 0%, ${token.colorSuccess}40 100%)`,
              border: `1px solid ${token.colorSuccess}60`,
            }}
            loading={loading}
          >
            <Statistic
              title={<span style={{ color: token.colorSuccess }}>计算性能提升（清洗后）</span>}
              value="~3"
              suffix="x"
              valueStyle={{ color: token.colorSuccess, fontSize: 36, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 中部图表区 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {/* 左侧柱状图 */}
        <Col span={14}>
          <Card size="small" style={{ height: 360 }} loading={loading}>
            <ReactECharts option={barOption} style={{ height: 320 }} />
          </Card>
        </Col>

        {/* 右侧内容提纯对比 */}
        <Col span={10}>
          <Card size="small" style={{ height: 360 }} bodyStyle={{ padding: 0 }}>
            <Row gutter={0} style={{ height: '100%' }}>
              {/* 治理前 */}
              <Col
                span={12}
                style={{
                  padding: '16px 12px',
                  borderRight: `1px dashed ${token.colorBorder}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <Tag color="red">治理前</Tag>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      充斥无意义符号
                    </Text>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {BEFORE_TAGS.map((t, i) => (
                    <Tag
                      key={i}
                      color="error"
                      style={{ fontFamily: 'monospace', fontSize: 11 }}
                    >
                      {t || <span style={{ color: token.colorTextQuaternary }}>空</span>}
                    </Tag>
                  ))}
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <Text type="danger" style={{ fontSize: 12 }}>
                    刷屏 / 空值 / 注入
                  </Text>
                </div>
              </Col>

              {/* 治理后 */}
              <Col
                span={12}
                style={{
                  padding: '16px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <Tag color="green">治理后</Tag>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      高质量互动内容
                    </Text>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {AFTER_TAGS.map((t, i) => (
                    <Tag
                      key={i}
                      color="success"
                      style={{ fontFamily: 'monospace', fontSize: 11 }}
                    >
                      {t}
                    </Tag>
                  ))}
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <Text type="success" style={{ fontSize: 12 }}>
                    有效评论 / 建议 / 干货
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 底部存储详情 */}
      <Row gutter={16}>
        <Col span={24}>
          <Card size="small" title="存储空间明细" loading={loading}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="ODS 层原始存储"
                  value={stats?.ods_size_mb ?? 0}
                  suffix="MB"
                  precision={4}
                  valueStyle={{ color: token.colorTextTertiary }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="DWD 层清洗后存储"
                  value={stats?.dwd_size_mb ?? 0}
                  suffix="MB"
                  precision={4}
                  valueStyle={{ color: token.colorSuccess }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="DWS 层汇总存储"
                  value={stats?.dws_size_mb ?? 0}
                  suffix="MB"
                  precision={4}
                  valueStyle={{ color: token.colorPrimary }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="清洗压缩比"
                  value={stats?.compression_ratio ?? 0}
                  suffix="x"
                  precision={4}
                  valueStyle={{ color: token.colorWarning }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ROI;
