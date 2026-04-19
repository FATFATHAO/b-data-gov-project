import { type ReactNode } from "react";
import { ConfigProvider, theme } from "antd";

interface AntDProviderProps {
  children: ReactNode;
}

export function AntDProvider({ children }: AntDProviderProps) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#8b5cf6",
          colorBgContainer: "#1a1a2e",
          colorBgElevated: "#252540",
          colorBgLayout: "#0f0f1a",
          colorBgSpotlight: "#3a3a5c",
          colorBorder: "#3a3a5c",
          colorBorderSecondary: "#252540",
          colorText: "#ffffff",
          colorTextSecondary: "#b8b8d1",
          colorTextTertiary: "#8e8e96",
          colorTextQuaternary: "#5a5a7a",
          colorFill: "#252540",
          colorFillSecondary: "#1a1a2e",
          colorFillTertiary: "#3a3a5c",
          colorFillQuaternary: "#0f0f1a",
          colorSuccess: "#52c41a",
          colorWarning: "#faad14",
          colorError: "#ef4444",
          colorInfo: "#1890ff",
          colorLink: "#8b5cf6",
          colorLinkHover: "#a78bfa",
          borderRadius: 8,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
