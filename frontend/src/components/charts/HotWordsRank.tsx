import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Card, Empty, Spin } from 'antd';

interface Props {
  roomId: string | null;
  data: { name: string; value: number }[];
  loading?: boolean;
  platformName?: string;
}

const HotWordsRank: React.FC<Props> = ({ roomId, data, loading = false, platformName }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);


  // 初始化图表
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
      const handleResize = () => chartInstance.current?.resize();
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        chartInstance.current?.dispose();
        chartInstance.current = null;
      };
    }
  }, []);

  // 更新数据逻辑
  useEffect(() => {
    // if (!chartInstance.current || loading) return;
    // if (data.length === 0) {
    //   chartInstance.current.clear(); // 清空画布
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

    // 数据预处理：排序并取Top 10
    // ECharts 默认Y轴从下往上画，为了让第一名在最上面
    // yAxis.inverse = true (数据降序排列)
    const sortedData = [...data]
      .sort((a, b) => b.value - a.value) // 降序：大 -> 小
      .slice(0, 10); // 只取前10名
    console.log(data);

    const yAxisData = sortedData.map(item => item.name);
    const seriesData = sortedData.map(item => item.value);

    // 动态计算颜色：前三名给特殊渐变，后面给统一样式
    const getBarColor = (dataIndex: number) => {
      const colors = [
        // No.1: 红金渐变
        new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#f7ba2a' }, { offset: 1, color: '#ff4d4f' }]),
        // No.2: 蓝青渐变
        new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#00d2ff' }, { offset: 1, color: '#3a7bd5' }]),
        // No.3: 绿青渐变
        new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#4facfe' }, { offset: 1, color: '#00f260' }]),
      ];
      // 简单一点的默认色：
      const simpleBlue = new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#1890ff' }, { offset: 1, color: '#87e8de' }]);

      return colors[dataIndex] || simpleBlue;
    };

    const option = {
      backgroundColor: 'transparent',
      // 网格布局：给左边的文字留够空间
      grid: {
        top: 10,
        bottom: 10,
        left: 80,
        right: 50,
        containLabel: true
      },
      tooltip: {
        show: true,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: '{b}: {c}次'
      },
      xAxis: {
        type: 'value',
        show: false, // 隐藏X轴，保持简洁
        splitLine: { show: false }
      },
      yAxis: {
        type: 'category',
        data: yAxisData,
        inverse: true, // 反转Y轴，让第一名在最上面
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          margin: 10,
          color: '#fff',
          fontSize: 14,
          formatter: function (value: string, index: number) {
            // 给前三名加个 Emoji 或者特殊标记
            const rank = index + 1;
            let prefix = `${rank}`;
            if (rank === 1) prefix = '{no1|TOP 1}';
            else if (rank === 2) prefix = '{no2|2}';
            else if (rank === 3) prefix = '{no3|3}';

            // 为了对齐，如果名字太长可以截断
            return `${prefix}  ${value.length > 5 ? value.slice(0, 5) + '..' : value}`;
          },
          // 富文本样式定义
          rich: {
            no1: {
              backgroundColor: '#ff4d4f',
              color: '#fff',
              borderRadius: 4,
              padding: [2, 6],
              fontSize: 10,
              fontWeight: 'bold'
            },
            no2: {
              backgroundColor: '#3a7bd5',
              color: '#fff',
              borderRadius: 4,
              padding: [2, 6],
              fontSize: 10
            },
            no3: {
              backgroundColor: '#00f260',
              color: '#fff',
              borderRadius: 4,
              padding: [2, 6],
              fontSize: 10,
              textBorderColor: '#333',
              textBorderWidth: 1
            }
          }
        },
        // 开启这个动画配置，让排序变化时条目平滑移动
        animationDuration: 300,
        animationDurationUpdate: 300
      },
      series: [
        {
          type: 'bar',
          data: seriesData,
          barWidth: 16, // 柱子细一点
          itemStyle: {
            borderRadius: [0, 10, 10, 0], // 右边圆角
            color: function (params: any) {
              return getBarColor(params.dataIndex);
            }
          },
          label: {
            show: true,
            position: 'right',
            color: '#fff',
            fontSize: 12,
            formatter: '{c}'
          },
          // 背景条
          showBackground: true,
          backgroundStyle: {
            color: 'rgba(255, 255, 255, 0.05)', // 非常淡的背景槽
            borderRadius: [0, 10, 10, 0]
          },
          // 开启实时排序动画
          realtimeSort: true,
        }
      ]
    };

    chartInstance.current.setOption(option);

  }, [data, loading]);

  return (
    <Card
      title={`${platformName?.startsWith('bilibili') ? "实时热词排行" : "实时热门弹幕排行"} - ${roomId || '未选择'}`}
      bordered={false}
      style={{ background: '#1f1f1f', marginTop: 20 }}
      headStyle={{ color: '#fff', borderBottom: '1px solid #333' }}
    >
      {loading ? (
        <div style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin tip="热度分析中..." />
        </div>
      ) : data.length === 0 ? (
        <div style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Empty description={<span style={{ color: '#666' }}>暂无数据</span>} />
        </div>
      ) : (
        <div ref={chartRef} style={{ width: '100%', height: 300 }} />
      )}
    </Card>
  );
};

export default HotWordsRank;
