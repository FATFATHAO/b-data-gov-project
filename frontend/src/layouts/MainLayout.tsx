import React from "react";
import { Layout, Menu, Dropdown, Avatar, Space, message } from "antd";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  DashboardOutlined,
  VideoCameraOutlined,
  CloudServerOutlined,
  UserOutlined,
  LogoutOutlined,
  DownOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  UploadOutlined,
  SafetyOutlined,
  BranchesOutlined,
  BarChartOutlined,
  CustomerServiceOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useAuth } from "@/contexts/AuthContext";

const { Header, Content } = Layout;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // --- 退出登录逻辑 ---
  const handleLogout = () => {
    logout();
    message.success("已退出登录");
    navigate("/login", { replace: true });
  };

  // --- 下拉菜单配置 ---
  const userMenuItems: MenuProps["items"] = [
    {
      key: "profile",
      label: (
        <div style={{ padding: "4px 0" }}>
          <div style={{ fontWeight: "bold" }}>{user?.nickname || "用户"}</div>
          <div style={{ fontSize: "12px", color: "#888" }}>@{user?.username}</div>
        </div>
      ),
      disabled: true,
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: handleLogout,
      danger: true,
    },
  ];

  // 主导航菜单项
  const items = [
    { key: "/", icon: <DashboardOutlined />, label: "全网态势总览" },
    { key: "/governance/catalog", icon: <DatabaseOutlined />, label: "资产目录" },
    { key: "/governance/ingestion", icon: <UploadOutlined />, label: "数据采集" },
    { key: "/governance/quality", icon: <SafetyOutlined />, label: "质量监控" },
    { key: "/governance/lineage", icon: <BranchesOutlined />, label: "数据血缘" },
    { key: "/governance/roi", icon: <BarChartOutlined />, label: "治理成效" },
    { key: "/bilibili", icon: <CustomerServiceOutlined />, label: "B站监控" },
    { key: "/douyu", icon: <VideoCameraOutlined />, label: "斗鱼监控" },
  ];

  // 动态插入管理员菜单
  if (user?.role === "admin") {
    items.push({
      key: "/admin",
      icon: <SafetyCertificateOutlined />,
      label: "管理后台",
    });
  }

  return (
    <Layout style={{ minHeight: "100vh", background: "#000" }}>
      {/* --- 顶部全局导航 --- */}
      <Header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 999,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#001529",
          borderBottom: "2px solid #1890ff",
          padding: "0 24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}
      >
        {/* 左侧：Logo + 菜单 */}
        <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginRight: 40,
              color: "#fff",
              fontSize: "20px",
              fontWeight: "bold",
              letterSpacing: "1px",
              cursor: "pointer",
            }}
            onClick={() => navigate("/")}
          >
            <CloudServerOutlined style={{ fontSize: "28px", color: "#1890ff", marginRight: 10 }} />
            HRBUST <span style={{ color: "#1890ff", marginLeft: 6 }}>MONITOR</span>
          </div>

          {/* 横向菜单 */}
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={items}
            onClick={(e) => navigate(e.key)}
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              fontSize: "16px",
              borderBottom: "none",
            }}
          />
        </div>

        {/* 右侧：用户信息 */}
        <Space size="large">
          {/* 用户下拉头像 */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                color: "#fff",
              }}
            >
              <Avatar style={{ backgroundColor: "#1890ff", marginRight: 8 }} icon={<UserOutlined />}>
                {user?.nickname ? user.nickname[0].toUpperCase() : null}
              </Avatar>
              <span style={{ fontSize: "14px", marginRight: 4 }}>
                {user?.nickname || "未登录"}
              </span>
              <DownOutlined style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }} />
            </div>
          </Dropdown>
        </Space>
      </Header>

      {/* --- 内容区域 --- */}
      <Content>
        <Outlet />
      </Content>
    </Layout>
  );
};

export default MainLayout;
