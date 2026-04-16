import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Tag, Space, Typography, message, theme } from 'antd';
import ReactECharts from 'echarts-for-react';
import { fetchQualityMetrics, fetchDailyTrend, fetchCrawlHealth } from '../../api';
import type { QualityMetrics, DailyTrend, CrawlHealth } from '../../api/types';

const { Text } = Typography;

// 脏数据类型分布（兜底数据）
const FALLBACK_DIRTY_TYPES = [
  { name: '空内容', value: 30 },
  { name: '刷屏重复', value: 40 },
  { name: 'HTML注入', value: 20 },
  { name: '异常Unicode', value: 20 },
  { name: '非法时间戳', value: 10 },
  { name: '超短弹幕', value: 5 },
];

// 近7天趋势兜底数据
const FALLBACK_DAILY_TREND = [
  { date: '2026-04-09', dirty_count: 8, clean_count: 62 },
  { date: '2026-04-10', dirty_count: 12, clean_count: 68 },
  { date: '2026-04-11', dirty_count: 6, clean_count: 74 },
  { date: '2026-04-12', dirty_count: 15, clean_count: 65 },
  { date: '2026-04-13', dirty_count: 9, clean_count: 71 },
  { date: '2026-04-14', dirty_count: 11, clean_count: 69 },
  { date: '2026-04-15', dirty_count: 7, clean_count: 73 },
];

const Quality = () => {
  const { token } = theme.useToken();
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend | null>(null);
  const [crawlHealth, setCrawlHealth] = useState<CrawlHealth | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(true);

  useEffect(() => {
    fetchQualityMetrics()
      .then(setMetrics)
      .catch(() => {
        message.warning('无法连接后端服务，使用演示数据');
        setMetrics({
          total_records: 500,
          dirty_records: 79,
          clean_records: 421,
          field_missing_rate: 8.6,
          dirty_rate: 15.8,
        });
      })
      .finally(() => setLoadingMetrics(false));

    fetchDailyTrend()
      .then(setDailyTrend)
      .catch(() => setDailyTrend({ items: FALLBACK_DAILY_TREND }))
      .finally(() => setLoadingTrend(false));

    fetchCrawlHealth()
      .then(setCrawlHealth)
      .catch(() => setCrawlHealth(null))
      .finally(() => setLoadingHealth(false));
  }, []);

  const qualityScore = metrics
    ? Math.round((metrics.clean_records / metrics.total_records) * 100)
    : 0;

  // 时效性判断：距今超过1小时标黄，超过24小时标红
  const getStaleness = (runTime: string): { color: string; label: string } => {
    if (!runTime) return { color: token.colorTextQuaternary, label: '未知' };
    const elapsed = (Date.now() - new Date(runTime).getTime()) / 1000 / 3600;
    if (elapsed > 24) return { color: token.colorError, label: '数据过期' };
    if (elapsed > 1) return { color: token.colorWarning, label: '数据较旧' };
    return { color: token.colorSuccess, label: '数据最新' };
  };

  const staleness = getStaleness(crawlHealth?.run_time ?? '');
  const successRate = crawlHealth?.api_success_rate ?? 0;
  const successColor = successRate >= 0.9 ? token.colorSuccess : successRate >= 0.7 ? token.colorWarning : token.colorError;

  const statusColor: Record<string, string> = {
    SUCCESS: 'green',
    PARTIAL: 'orange',
    FAILED: 'red',
    UNKNOWN: 'default',
  };

  // ECharts 颜色（使用主题色）
  const chartErrorColor = token.colorError;
  const chartSuccessColor = token.colorSuccess;
  const chartWarningColor = token.colorWarning;

  // 饼图配置
  const pieOption = {
    title: {
      text: '脏数据类型分布',
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 500, color: token.colorText },
    },
    tooltip: { trigger: 'item', formatter: '{b}: {c} 条 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: token.colorTextSecondary } },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        data: FALLBACK_DIRTY_TYPES.map((item) => ({ name: item.name, value: item.value })),
        itemStyle: { borderRadius: 4, borderColor: token.colorBgContainer, borderWidth: 2 },
        color: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'],
      },
    ],
  };

  // 折线图配置
  const lineOption = {
    title: {
      text: '每日脏数据拦截趋势',
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 500 },
    },
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['拦截脏数据', '清洗后数据'], top: 30 },
    grid: { left: 50, right: 20, top: 70, bottom: 30 },
    xAxis: {
      type: 'category',
      data: (dailyTrend?.items ?? FALLBACK_DAILY_TREND).map((i) => i.date.slice(5)),
      boundaryGap: false,
    },
    yAxis: { type: 'value', name: '记录数', min: 0 },
    series: [
      {
        name: '拦截脏数据',
        type: 'line',
        smooth: true,
        data: (dailyTrend?.items ?? FALLBACK_DAILY_TREND).map((i) => i.dirty_count),
        itemStyle: { color: chartErrorColor },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${chartErrorColor}4D` },
              { offset: 1, color: `${chartErrorColor}0D` },
            ],
          },
        },
      },
      {
        name: '清洗后数据',
        type: 'line',
        smooth: true,
        data: (dailyTrend?.items ?? FALLBACK_DAILY_TREND).map((i) => i.clean_count),
        itemStyle: { color: chartSuccessColor },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${chartSuccessColor}4D` },
              { offset: 1, color: `${chartSuccessColor}0D` },
            ],
          },
        },
      },
    ],
  };

  return (
    <div>
      {/* 顶部指标卡片（4张） */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small" loading={loadingMetrics}>
            <Statistic
              title="总处理数据量"
              value={metrics?.total_records ?? 0}
              suffix="条"
              valueStyle={{ color: token.colorInfo }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" loading={loadingMetrics}>
            <Statistic
              title="累计拦截脏数据"
              value={metrics?.dirty_records ?? 0}
              suffix="条"
              valueStyle={{ color: token.colorError }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" loading={loadingMetrics}>
            <Statistic
              title="全局数据质量评分"
              value={qualityScore}
              suffix="分"
              precision={1}
              valueStyle={{ color: qualityScore >= 80 ? token.colorSuccess : qualityScore >= 60 ? token.colorWarning : token.colorError }}
            />
          </Card>
        </Col>

        {/* 数据集成健康度 */}
        <Col span={6}>
          <Card
            size="small"
            loading={loadingHealth}
            style={{
              border: crawlHealth ? `1px solid ${token.colorBorder}` : undefined,
            }}
          >
            {crawlHealth ? (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>数据集成健康度</Text>
                <Space align="center">
                  <Text
                    strong
                    style={{
                      fontSize: 28,
                      color: successColor,
                      lineHeight: 1,
                    }}
                  >
                    {(successRate * 100).toFixed(1)}%
                  </Text>
                  <Tag
                    color={statusColor[crawlHealth.status] ?? 'default'}
                    style={{ marginLeft: 4 }}
                  >
                    {crawlHealth.status}
                  </Tag>
                </Space>
                <Space direction="vertical" size={0}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {crawlHealth.up_name} · {crawlHealth.videos_fetched}视频
                  </Text>
                  <Space size={4}>
                    <Text style={{ color: staleness.color, fontSize: 11 }}>
                      ● {staleness.label}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(crawlHealth.run_time).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Space>
                </Space>
              </Space>
            ) : (
              <Space direction="vertical" size={4}>
                <Text type="secondary" style={{ fontSize: 12 }}>数据集成健康度</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  暂无运行记录
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  请先执行爬虫脚本
                </Text>
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* 下方图表 */}
      <Row gutter={16}>
        <Col span={10}>
          <Card size="small" style={{ height: 380 }}>
            {loadingTrend ? (
              <div style={{ textAlign: 'center', paddingTop: 120 }}>
                <Spin size="large" />
              </div>
            ) : (
              <ReactECharts option={pieOption} style={{ height: 340 }} />
            )}
          </Card>
        </Col>
        <Col span={14}>
          <Card size="small" style={{ height: 380 }}>
            {loadingTrend ? (
              <div style={{ textAlign: 'center', paddingTop: 120 }}>
                <Spin size="large" />
              </div>
            ) : (
              <ReactECharts option={lineOption} style={{ height: 340 }} />
            )}
          </Card>
        </Col>
      </Row>

      {/* 底部质量说明 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card size="small">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="字段缺失率"
                  value={metrics?.field_missing_rate ?? 0}
                  suffix="%"
                  precision={2}
                  valueStyle={{ color: token.colorWarning }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="脏数据率"
                  value={metrics?.dirty_rate ?? 0}
                  suffix="%"
                  precision={2}
                  valueStyle={{ color: token.colorError }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="清洗后有效数据"
                  value={metrics?.clean_records ?? 0}
                  suffix="条"
                  valueStyle={{ color: token.colorSuccess }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 爬虫健康度明细（仅在有数据时显示） */}
      {crawlHealth && (
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="爬虫运行详情">
              <Row gutter={16}>
                <Col span={4}>
                  <Statistic title="运行ID" value={crawlHealth.run_id} valueStyle={{ fontSize: 14, fontFamily: 'monospace' }} />
                </Col>
                <Col span={4}>
                  <Statistic title="抓取评论" value={crawlHealth.comments_fetched} suffix="条" />
                </Col>
                <Col span={4}>
                  <Statistic title="空内容拦截" value={crawlHealth.dirty_filtered} suffix="条" valueStyle={{ color: token.colorError }} />
                </Col>
                <Col span={4}>
                  <Statistic title="刷屏截断" value={crawlHealth.spam_truncated} suffix="条" valueStyle={{ color: token.colorWarning }} />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="API成功率"
                    value={(crawlHealth.api_success_rate * 100).toFixed(1)}
                    suffix="%"
                    valueStyle={{ color: successColor }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="最后更新时间"
                    value={new Date(crawlHealth.run_time).toLocaleString('zh-CN')}
                    valueStyle={{ fontSize: 13 }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default Quality;
