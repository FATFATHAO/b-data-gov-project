import type { EChartsOption } from "echarts";
import { ReactECharts } from "../echarts/echarts";

interface BarChartProps {
  title?: string;
  data?: Array<{ name: string; value: number }>;
  loading?: boolean;
}

export function BarChart({ title, data = [], loading }: BarChartProps) {
  const option: EChartsOption = {
    title: {
      text: title,
    },
    tooltip: {
      trigger: "axis",
    },
    xAxis: {
      type: "category",
      data: data.map((d) => d.name),
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: title || "数值",
        type: "bar",
        data: data.map((d) => d.value),
      },
    ],
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center">加载中...</div>;
  }

  return <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />;
}

export default BarChart;
