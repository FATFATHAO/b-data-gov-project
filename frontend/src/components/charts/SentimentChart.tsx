import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Card, Empty, Spin } from 'antd';
import dayjs from 'dayjs';
import type { SentimentData } from './type';

const SentimentChart: React.FC<SentimentData> = ({ roomId, data, loading = false, style }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);


  // 初始化
  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.dispose();

    chartInstance.current = echarts.init(chartRef.current);
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  // 渲染数据
  useEffect(() => {
    // if (!chartInstance.current || loading) return;
    // if (data.length === 0) {
    //   chartInstance.current.clear();
    //   return;
    // }
    if (loading || data.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.clear();
      }
      return;
    }

    if (!chartInstance.current) {
      if (chartRef.current) {
        chartInstance.current = echarts.init(chartRef.current);
      } else {
        return;
      }
    }

    // 按时间排序，防止乱序
    const sortedData = [...data].sort((a, b) => a.ts - b.ts);

    const xData = sortedData.map(item => dayjs(item.ts).format('HH:mm:ss'));
    const yData = sortedData.map(item => item.value);

    // 计算当前的平均情绪（取最后5个点的平均值，或者最后一个点）
    const currentScore = yData.length > 0 ? yData[yData.length - 1] : 0.5;
    let moodText = "😐 平静";
    let moodColor = "#ccc";

    if (currentScore >= 0.6) {
      moodText = "😄 开心";
      moodColor = "#52c41a"; // Green
    } else if (currentScore <= 0.4) {
      moodText = "😡 负面";
      moodColor = "#ff4d4f"; // Red
    }

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: `当前情绪指数: ${currentScore.toFixed(2)}  ${moodText}`,
        left: 'center',
        textStyle: {
          color: moodColor,
          fontSize: 14,
          fontWeight: 'normal'
        },
        top: 0
      },
      grid: {
        top: 40,
        bottom: 20,
        left: 50,
        right: 20,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          const item = sortedData[p.dataIndex];
          return `
                <div>${p.name}</div>
                <div style="font-weight:bold">情感分: ${item.value.toFixed(2)}</div>
                <div style="font-size:12px;color:#aaa">样本量: ${item.count}条</div>
            `;
        }
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: '#666' } },
        axisLabel: { color: '#aaa' }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1,
        splitNumber: 4, // 0, 0.25, 0.5, 0.75, 1
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#aaa' },
        splitLine: {
          show: true,
          lineStyle: { color: 'rgba(255,255,255,0.1)', type: 'dashed' }
        }
      },
      // 视觉映射组件：核心功能，根据Y轴的值改变线条颜色
      visualMap: {
        show: false,
        dimension: 1, // 基于Y轴(维度1)变化
        pieces: [
          { gt: 0.6, lte: 1, color: '#52c41a' },   // > 0.6 绿色
          { gt: 0.4, lte: 0.6, color: '#1890ff' }, // 0.4-0.6 蓝色/中性
          { gt: 0, lte: 0.4, color: '#ff4d4f' }    // < 0.4 红色
        ],
        outOfRange: {
          color: '#999'
        }
      },
      series: [
        {
          name: '情感趋势',
          type: 'line',
          data: yData,
          smooth: true, // 平滑曲线
          lineStyle: {
            width: 3
          },
          // 标线：在 0.5 处画一条中性线
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: 'rgba(255,255,255,0.3)', type: 'solid' },
            data: [{ yAxis: 0.5 }]
          },
          // 区域填充，让图表看起来更饱满
          areaStyle: {
            opacity: 0.1
          }
        }
      ]
    };

    chartInstance.current.setOption(option);
  }, [data, loading]);

  return (
    <Card
      title={`情感波动趋势 - ${roomId || '未选择'}`}
      bordered={false}
      style={{ background: '#1f1f1f', marginTop: 20, ...style }}
      headStyle={{ color: '#fff', borderBottom: '1px solid #333' }}
    >
      {loading ? (
        <div style={{ height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin tip="AI正在分析情绪..." />
        </div>
      ) : data.length === 0 ? (
        <div style={{ height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Empty description={<span style={{ color: '#666' }}>暂无情感数据</span>} />
        </div>
      ) : (
        <div ref={chartRef} style={{ width: '100%', height: 250 }} />
      )}
    </Card>
  );
};

export default SentimentChart;
