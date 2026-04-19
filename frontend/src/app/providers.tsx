import { type ReactNode } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { ConfigProvider, theme } from "antd";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
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
            colorTextTertiary: "#8b8cb8",
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
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}
