import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, List, Tag, Button, Empty, Spin, Avatar } from 'antd';
import {
  GlobalOutlined,
  YoutubeOutlined,
  VideoCameraOutlined,
  StarFilled,
  RightOutlined,
  FireOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
// 引入 API
import { getDashboardStats, getMyFavorites, getRank } from '../api';
import * as echarts from 'echarts';
import type { MonitorRoom } from '../api/type';
import { type DashboardInfo, type RankList } from './type';
import ReactEcharts from 'echarts-for-react'
import CountUp from 'react-countup'; // 具名导入，更加稳健
// import { CountUp } from 'react-countup';

const { Title, Text } = Typography;

// 一个带有记忆功能的数字组件
const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const CountUpComponent = (CountUp as any).default || CountUp;

  // 使用ref记录上一次的值，初始化为0
  const prevValueRef = React.useRef(0);

  return (
    <CountUpComponent
      start={prevValueRef.current} // 从上一次的值开始
      end={value}                  // 到当前的新值
      duration={2.0}
      separator=","
      onEnd={() => {
        // 动画结束时，更新 ref 为当前值，供下一次使用
        prevValueRef.current = value;
      }}
      // 关键：启用 preserveValue 可以让 CountUp 内部更智能地处理更新，
      // 但配合上面的 start/onEnd 逻辑是最稳健的
      preserveValue={true}
    />
  );
};


const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<MonitorRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalRank, setGlobalRank] = useState<RankList[]>([]);
  const [stats, setStats] = useState<DashboardInfo>();

  // 获取收藏列表
  useEffect(() => {
    const fetchFavs = async () => {
      setLoading(true);
      try {
        const res = await getMyFavorites();
        setFavorites(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchFavs();
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 并行请求：收藏、统计、全网排行
        const [favRes, statRes, rankRes] = await Promise.all([
          getMyFavorites(),
          getDashboardStats(),
          getRank('all') // 获取全平台混合排行
        ]);

        setFavorites(favRes.data);
        setStats(statRes.data);
        setGlobalRank(rankRes.data);

      } catch (e) {
        console.error("Dashboard data load failed", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
    // 可选：每 10 秒刷新一次排行和统计
    const timer = setInterval(fetchAllData, 10000);
    return () => clearInterval(timer);
  }, []);

  // 跳转处理
  const handleGoToRoom = (roomId: string, platform: string) => {
    // 简单的 ID 提取逻辑 (兼容 bvid 或 纯数字)
    let realId = roomId;
    if (roomId.includes(':')) realId = roomId.split(':').pop() || roomId;

    // 如果是 bilibili_video 前缀，强转 platform 为 bilibili
    if (roomId.startsWith('bilibili_video')) platform = 'bilibili';

    const path = `/${platform}/${realId}`;
    navigate(path);
  };

  // --- ECharts 配置 (Top 10 热度条形图) ---
  const getBarChartOption = () => {
    // 取前 10 名，并反转顺序（让第一名在最上面）
    const top10 = globalRank.slice(0, 10).reverse();

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '3%', containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { show: false },
        axisLabel: { color: '#888' }
      },
      yAxis: {
        type: 'category',
        data: top10.map(item => item.title ? (item.title.length > 8 ? item.title.slice(0, 8) + '...' : item.title) : item.room_id),
        axisLabel: { color: '#fff' },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          name: '热度',
          type: 'bar',
          data: top10.map(item => item.heat),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#faad14' }, // 黄色
              { offset: 1, color: '#ff4d4f' }  // 红色
            ]),
            borderRadius: [0, 4, 4, 0]
          }, label: {
            show: true,
            position: 'right',
            color: '#fff',
            formatter: '{c}'
          }
        }
      ]
    };
  };

  const formatter = (value: number | string) => {
    return <AnimatedNumber value={Number(value)} />
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ color: '#fff', marginBottom: 30 }}>🚀 全网舆情监控总览</Title>

      {/* 核心指标卡 (真实数据) */}
      <Row gutter={24} style={{ marginBottom: 32 }}>
        <Col span={6}>
          <Card bordered={false} style={{ background: '#1f1f1f' }}>
            <Statistic
              title="活跃直播监控"
              value={stats?.live_count}
              prefix={<VideoCameraOutlined />}
              valueStyle={{ color: '#52c41a' }}
              formatter={formatter}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ background: '#1f1f1f' }}>
            <Statistic
              title="正在解析视频"
              value={stats?.video_count}
              prefix={<YoutubeOutlined />}
              valueStyle={{ color: '#faad14' }}
              formatter={formatter}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ background: '#1f1f1f' }}>
            <Statistic
              title="系统总热度值"
              value={stats?.total_heat}
              prefix={<FireOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
              formatter={formatter}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ background: '#1f1f1f' }}>
            <Statistic
              title="系统状态"
              value={"Online"}
              valueStyle={{ color: '#1890ff' }}
              prefix={<GlobalOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 主体区域 */}
      <Row gutter={24}>
        {/* 左侧：我的收藏 (占 2/3) */}
        <Col span={16}>
          <Card
            title={<span style={{ color: '#fff' }}><StarFilled style={{ color: '#faad14', marginRight: 8 }} />我的特别关注</span>}
            bordered={false}
            style={{ background: '#141414', border: '1px solid #333', minHeight: 550 }}
            headStyle={{ borderBottom: '1px solid #333' }}
          >
            {loading && favorites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 50 }}><Spin /></div>
            ) : favorites.length === 0 ? (
              <Empty description={<span style={{ color: '#666' }}>暂无收藏，快去直播间点亮星星吧！</span>} />
            ) : (
              <List
                grid={{ gutter: 16, column: 3 }}
                dataSource={favorites}
                renderItem={(item) => (
                  <List.Item>
                    <Card
                      hoverable
                      style={{ background: '#1f1f1f', border: '1px solid #333' }}
                      bodyStyle={{ padding: 16 }}
                      onClick={() => handleGoToRoom(item.room_id, item.platform)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <Tag color={item.platform === 'bilibili' ? 'pink' : 'black'}>
                          {item.platform.toUpperCase()}
                        </Tag>
                        <Tag color={item.target_type === 'video' ? 'gold' : 'cyan'}>
                          {item.target_type === 'video' ? '视频' : '直播'}
                        </Tag>
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        {/* 优先显示 Title，没有则显示 ID */}
                        <Text ellipsis style={{ color: '#fff', fontSize: 16, width: '100%', display: 'block' }}>
                          {item.title || item.room_id}
                        </Text>
                        <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                          {item.anchor_name || '未知主播'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: item.status === 'RUNNING' ? '#52c41a' : '#666', fontSize: 12 }}>
                          ● {item.status}
                        </Text>
                        <Button type="link" size="small" icon={<RightOutlined />}>进入</Button>
                      </div>
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* 右侧：全网热度榜 + 图表 (占 1/3) */}
        <Col span={8}>
          <Card
            title={<span style={{ color: '#fff' }}><ThunderboltOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />全平台热度 TOP 10</span>}
            bordered={false}
            style={{ background: '#141414', border: '1px solid #333', height: 550, display: 'flex', flexDirection: 'column' }}
            headStyle={{ borderBottom: '1px solid #333' }}
            bodyStyle={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            {/* 上半部分：列表 (只显示前 5) */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              <List
                size="small"
                dataSource={globalRank.slice(0, 5)}
                renderItem={(item, index) => (
                  <List.Item
                    style={{ borderBottom: '1px solid #333', cursor: 'pointer' }}
                    onClick={() => {
                      let targetPlatform = 'bilibili'; // 默认值

                      // 如果后端 RankItem 返回了 platform 字段 (推荐)
                      // 使用 (item as any) 是为了防止你的 TS 类型还没更新导致报错
                      if ((item as any).platform) {
                        targetPlatform = (item as any).platform;
                      }
                      // 兼容旧逻辑：通过 ID 前缀判断
                      else if (item.room_id.includes(':')) {
                        const prefix = item.room_id.split(':')[0];
                        // 特殊处理视频
                        if (prefix === 'bilibili_video') targetPlatform = 'bilibili';
                        else targetPlatform = prefix;
                      }

                      handleGoToRoom(item.room_id, targetPlatform);
                    }}
                  >                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Avatar
                        size={20}
                        style={{
                          backgroundColor: index < 3 ? '#ff4d4f' : '#1890ff',
                          marginRight: 10,
                          fontSize: 12
                        }}
                      >
                        {index + 1}
                      </Avatar>
                      <div style={{ flex: 1, overflow: 'hidden', marginRight: 8 }}>
                        <div style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title || item.room_id}
                        </div>
                        <div style={{ color: '#666', fontSize: 10 }}>
                          {item.anchor_name}
                        </div>
                      </div>
                      <div style={{ color: '#faad14', fontWeight: 'bold' }}>
                        {item.heat}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </div>

            {/* 下半部分：图表 (显示前 10 的热度对比) */}
            <div style={{ height: 200 }}>
              {globalRank.length > 0 && <ReactEcharts option={getBarChartOption()} style={{ height: '100%' }} />}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
