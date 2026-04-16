import { useState } from "react";
import { Layout, Menu, Button, Space, Tooltip, theme } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DatabaseOutlined,
  DashboardOutlined,
  ShareAltOutlined,
  RiseOutlined,
  CloudUploadOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BgColorsOutlined,
} from "@ant-design/icons";
import { useTheme } from "../contexts/ThemeContext";
import { themeConfig, type ThemeName } from "../theme";

const { Sider, Header, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

// 清爽风侧边栏背景（深蓝色）
const CLEAN_SIDER_BG = "#001529";
// 科技风侧边栏背景
const CYBER_SIDER_BG = "#0f0f1a";

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { themeName, switchTheme } = useTheme();
  const {
    token: { colorBgContainer, colorBgLayout, colorText, colorBorder, colorPrimary },
  } = theme.useToken();

  // 侧边栏背景色
  const siderBg = themeName === "clean" ? CLEAN_SIDER_BG : CYBER_SIDER_BG;
  // 侧边栏文字颜色（深色背景用白色，浅色背景用深色）
  const siderTextColor = themeName === "clean" ? "#ffffff" : colorText;

  const menuItems = [
    {
      key: "/catalog",
      icon: <DatabaseOutlined />,
      label: "数据资产目录",
    },
    {
      key: "/quality",
      icon: <DashboardOutlined />,
      label: "质量监控大屏",
    },
    {
      key: "/lineage",
      icon: <ShareAltOutlined />,
      label: "数据血缘追踪",
    },
    {
      key: "/roi",
      icon: <RiseOutlined />,
      label: "治理成效分析",
    },
    {
      key: "/ingestion",
      icon: <CloudUploadOutlined />,
      label: "数据采集中心",
    },
  ];

  const handleThemeSwitch = () => {
    const nextTheme: ThemeName = themeName === "clean" ? "cyber" : "clean";
    switchTheme(nextTheme);
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={220}
        style={{
          background: siderBg,
          borderRight: `1px solid ${colorBorder}`,
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? 0 : "0 20px",
            color: siderTextColor,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 1,
            gap: 8,
          }}
        >
          {collapsed ? (
            <span
              style={{
                fontSize: 20,
                background: `linear-gradient(135deg, ${colorPrimary} 0%, #00D4FF 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              B
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 20,
                  background: `linear-gradient(135deg, ${colorPrimary} 0%, #00D4FF 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                B
              </span>
              <span>-DataGov Lite</span>
            </span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: "transparent",
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: colorBgContainer,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: `0 1px 4px rgba(0,21,41,.08)`,
            borderBottom: `1px solid ${colorBorder}`,
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 40, height: 40, color: colorText }}
            />
            <span style={{ fontSize: 16, fontWeight: 500, color: colorText }}>
              B站数据治理与可视化平台
            </span>
          </Space>

          <Space>
            <Tooltip
              color={siderTextColor}
              title={themeName === "clean" ? "切换到黑色科技风" : "切换到清爽管理风"}
            >
              <Button
                type="text"
                onClick={handleThemeSwitch}
                style={{
                  height: 40,
                  padding: "0 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: colorText,
                }}
              >
                <BgColorsOutlined style={{ fontSize: 16, color: colorPrimary }} />
                <span style={{ fontSize: 12 }}>{themeConfig[themeName].label}</span>
              </Button>
            </Tooltip>
          </Space>
        </Header>
        <Content
          style={{
            padding: 24,
            background: colorBgLayout,
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
