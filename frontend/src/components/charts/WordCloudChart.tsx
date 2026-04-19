import React, { useCallback, useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import 'echarts-wordcloud';
import { Card, Empty, Spin } from 'antd';

interface Props {
  roomId: string | null;
  data: { name: string; value: number }[];
  loading?: boolean;
}

const WordCloudChart: React.FC<Props> = ({ roomId, data, loading = false }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 存储最新的数据
  const latestDataRef = useRef(data);
  // 存储上一次渲染的数据
  const renderedDataMapRef = useRef<Map<string, number>>(new Map());

  // 实时更新Ref
  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);


  // 初始化图表
  const renderChart = useCallback(() => {
    const currentData = latestDataRef.current;
    // 如果没有DOM，或者还在加载，或者没有数据，就不画
    if (!chartRef.current || loading || currentData.length === 0) return;

    // 懒初始化：如果实例不存在，现在创建
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
      // 绑定resize
      chartInstance.current.resize();
    }

    // --- 智能配色逻辑 ---
    const coloredData = currentData.map(item => {
      const prevValue = renderedDataMapRef.current.get(item.name);
      let color = '#5c7bd9'; // 默认冷色（稳定词）

      if (prevValue === undefined) {
        // 新出现的词：绿色
        color = '#91cc75';
      } else if (item.value > prevValue) {
        // 词频增加的词（热词）：红色高亮！
        color = '#ff4d4f';
      } else {
        // 没变化的词：做背景，加点透明度随机感
        const opacity = 0.6 + Math.random() * 0.4;
        color = `rgba(92, 123, 217, ${opacity})`;
      }

      return {
        ...item,
        textStyle: { color: color }
      };
    });

    // 更新 "上一次数据" 的记录
    const newMap = new Map();
    currentData.forEach(item => newMap.set(item.name, item.value));
    renderedDataMapRef.current = newMap;

    const option = {
      backgroundColor: 'transparent',
      tooltip: { show: true, formatter: '{b}: {c}次' },
      series: [{
        type: 'wordCloud',
        shape: 'circle',
        left: 'center', top: 'center',
        width: '95%', height: '95%',
        sizeRange: [14, 60],
        rotationRange: [0, 0], // 强制水平
        gridSize: 8,
        drawOutOfBound: false,
        layoutAnimation: true,
        textStyle: { fontFamily: 'sans-serif', fontWeight: 'bold' },
        emphasis: { focus: 'self', textStyle: { shadowBlur: 10, shadowColor: '#333' } },
        data: coloredData
      }]
    };

    chartInstance.current.setOption(option);
  }, [loading]);

  // 10s刷新一次
  useEffect(() => {
    const timer = setInterval(() => {
      renderChart();
    }, 10000);
    return () => clearInterval(timer);
  }, [renderChart]);

  // 首屏加载触发逻辑，如果当前图表是空的或者刚刚有数据立马进行加载
  useEffect(() => {
    if (data.length > 0 && renderedDataMapRef.current.size === 0) {
      //稍微延迟一点点确保DOM已经mount
      setTimeout(() => {
        renderChart();
      }, 0);
    }
  }, [data, renderChart]);

  // 窗口大小解析
  useEffect(() => {
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return (
    <Card
      title={`实时弹幕热词 - ${roomId || '未选择'}`}
      extra={
        <span style={{ fontSize: '12px', color: '#666' }}>
          <span style={{ color: '#ff4d4f' }}>■</span>飙升
          <span style={{ color: '#91cc75', marginLeft: 8 }}>■</span>新词
          <span style={{ color: '#5c7bd9', marginLeft: 8 }}>■</span>持平
        </span>
      }
      bordered={false}
      style={{ background: '#1f1f1f', marginTop: 20 }}
      headStyle={{ color: '#fff', borderBottom: '1px solid #333' }}
    >
      {loading ? (
        <div style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin tip="词云生成中..." />
        </div>
      ) : data.length === 0 ? (
        <div style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Empty description={<span style={{ color: '#666' }}>暂无热词数据</span>} />
        </div>
      ) : (
        <div ref={chartRef} style={{ width: '100%', height: 300 }} />
      )}
    </Card>
  );
};
export default WordCloudChart;
