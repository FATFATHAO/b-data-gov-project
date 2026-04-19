import React, { useEffect, useState, useRef } from 'react';
import { Card, List, Tag, Typography, Badge } from 'antd';
import { ThunderboltFilled } from '@ant-design/icons';
import { getSurgeStreamUrl } from '../../pages/api';
import type { SentimentDataStruct } from './type';

const { Text } = Typography;

interface SurgeData {
  content: string;
  count: number;
}

interface SurgeEvent {
  room_id: string;
  window_volume: number;
  trigger_reason: string;
  data: SurgeData[];
  timestamp: number;
}

interface Props {
  roomId: string; // 格式: bilibili:123
  style?: React.CSSProperties;
  sentimentData?: SentimentDataStruct[];
}

const SurgeDanmakuList: React.FC<Props> = ({ roomId, style, sentimentData = [] }) => {
  const [events, setEvents] = useState<SurgeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // 建立 SSE 连接
    // 假设后端接口: /api/live/monitor/surge_danmaku/stream?room_id=bilibili:123
    const url = getSurgeStreamUrl(roomId);

    console.log(`[SSE] Connecting to ${url}`);

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setIsConnected(true);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        // 如果是 expired 或者是空数据，忽略
        if (payload.status === 'expired' || !payload.data || payload.data.length === 0) return;

        const newEvent: SurgeEvent = {
          ...payload,
          timestamp: Date.now()
        };

        // 将新事件插到最前面，只保留最近 5 条
        setEvents(prev => [newEvent, ...prev].slice(0, 5));

      } catch (e) {
        console.error("Parse SSE error", e);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [roomId]);

  // 辅助函数：根据时间戳查找最近的情感分并返回颜色
  const getSentimentColor = (timestamp: number) => {
    if (!sentimentData || sentimentData.length === 0) return '#ff4d4f'; // 默认红色

    // 找到时间戳最接近的一条数据
    // 注意：sentimentData 需要是按时间排序的
    // 这里简单做一个查找，或者你可以二分查找优化
    const closest = sentimentData.reduce((prev, curr) => {
      return (Math.abs(curr.ts - timestamp) < Math.abs(prev.ts - timestamp) ? curr : prev);
    });

    // 如果时间差太大（比如超过1分钟），说明数据没对上，回退默认色
    if (Math.abs(closest.ts - timestamp) > 60 * 1000) return '#ff4d4f';

    const score = closest.value;
    if (score >= 0.6) return '#52c41a'; // 开心
    if (score <= 0.4) return '#ff4d4f'; // 愤怒
    return '#1890ff'; // 中性
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ThunderboltFilled style={{ color: '#faad14', marginRight: 8 }} />
          <span style={{ color: '#fff' }}>实时节奏风暴</span>
          {isConnected && <Badge status="processing" style={{ marginLeft: 8 }} />}
        </div>
      }
      bordered={false}
      style={{ background: '#1f1f1f', border: '1px solid #333', marginTop: 20, ...style }}
      headStyle={{ borderBottom: '1px solid #333' }}
      bodyStyle={{ padding: '12px', height: 'calc(100% - 57px)', overflowY: 'auto' }}
    >
      {events.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', padding: '20px 0' }}>
          等待节奏起飞... 🚀
        </div>
      ) : (
        <List
          dataSource={events}
          renderItem={event => {
            const cardColor = getSentimentColor(event.timestamp);

            return (
              <div style={{
                marginBottom: 12,
                // background: 'rgba(255, 77, 79, 0.1)',
                background: `${cardColor}1A`,
                border: `1px solid ${cardColor}`,
                borderRadius: 6,
                padding: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  {/* '#ff4d4f' */}
                  <Text style={{ color: cardColor, fontSize: 12 }}>
                    {new Date(event.timestamp).toLocaleTimeString()} 流量激增!
                  </Text>
                  <Tag color="#f50">Vol: {event.window_volume}</Tag>
                </div>

                <div>
                  {event.data.map((item, idx) => (
                    <Tag key={idx} color="gold" style={{ marginTop: 4 }}>
                      {item.content} <span style={{ opacity: 0.8 }}>x{item.count}</span>
                    </Tag>
                  ))}
                </div>
              </div>
            )
          }}
        />
      )}
    </Card>
  );
};

export default SurgeDanmakuList;
