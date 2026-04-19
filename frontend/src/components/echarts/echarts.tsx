import { useEffect, useRef } from "react";
import * as echarts from "echarts";

type ECharts = echarts.ECharts;
type EChartsOption = echarts.EChartsOption;

interface ReactEChartsProps {
  option: EChartsOption;
  style?: React.CSSProperties;
  className?: string;
}

export function ReactECharts({ option, style, className }: ReactEChartsProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ECharts | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      chartInstance.current = echarts.init(chartRef.current);
      chartInstance.current.setOption(option);

      const handleResize = () => {
        chartInstance.current?.resize();
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        chartInstance.current?.dispose();
      };
    }
  }, []);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.setOption(option, true);
    }
  }, [option]);

  return <div ref={chartRef} style={style} className={className} />;
}

export type { EChartsOption };
