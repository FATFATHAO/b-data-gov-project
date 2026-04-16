/**
 * Ant Design 主题配置
 * 提供两套主题：深色科技风 & 浅色清爽风
 */

import type { ThemeConfig } from 'antd';

// ============================================================
// 主题一：黑色科技风（Cyber Dark）
// ============================================================
export const cyberDarkTheme: ThemeConfig = {
  token: {
    // 主色 - 科技紫
    colorPrimary: '#8B5CF6',
    colorInfo: '#8B5CF6',

    // 背景 - 层次分明的深色
    colorBgContainer: '#1a1a2e',   // 卡片/容器背景（比layout稍亮）
    colorBgElevated: '#252540',     // 浮层/下拉背景
    colorBgLayout: '#0f0f1a',       // 页面/侧边栏背景
    colorBgSpotlight: '#1e1e32',    // 斑马纹/特殊区域

    // 文字 - 确保对比度
    colorText: '#FFFFFF',           // 主要文字（纯白）
    colorTextSecondary: '#B8B8D1',  // 次要文字（浅紫灰）
    colorTextTertiary: '#8888A8',   // 辅助文字（中等灰紫）
    colorTextQuaternary: '#5C5C7A',

    // 边框
    colorBorder: '#3a3a5C',
    colorBorderSecondary: '#2a2a42',

    // 成功/警告/错误
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#60A5FA',

    // 圆角
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // 字体
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: 14,

    // 阴影
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
    boxShadowSecondary: '0 2px 8px rgba(0, 0, 0, 0.4)',
  },
  components: {
    Layout: {
      siderBg: '#0f0f1a',
      headerBg: '#1a1a2e',
      bodyBg: '#0f0f1a',
      triggerBg: '#252540',
    },
    Menu: {
      darkItemBg: '#0f0f1a',
      darkItemSelectedBg: 'rgba(139, 92, 246, 0.25)',
      darkItemHoverBg: 'rgba(139, 92, 246, 0.15)',
      darkItemColor: '#B8B8D1',
      darkItemSelectedColor: '#FFFFFF',
    },
    Card: {
      colorBgContainer: '#1a1a2e',
      colorBorderSecondary: '#3a3a5C',
    },
    Table: {
      colorBgContainer: '#1a1a2e',
      headerBg: '#252540',
      rowHoverBg: 'rgba(139, 92, 246, 0.1)',
      colorBorderSecondary: '#3a3a5C',
      headerColor: '#FFFFFF',
      colorText: '#FFFFFF',
    },
    Input: {
      colorBgContainer: '#252540',
      colorBorder: '#3a3a5C',
      activeBorderColor: '#8B5CF6',
      hoverBorderColor: '#A78BFA',
      colorText: '#FFFFFF',
    },
    Select: {
      colorBgContainer: '#252540',
      colorBgElevated: '#252540',
      colorBorder: '#3a3a5C',
      colorText: '#FFFFFF',
      optionSelectedBg: 'rgba(139, 92, 246, 0.25)',
      selectorBg: '#252540',
    },
    InputNumber: {
      colorBgContainer: '#252540',
      colorBorder: '#3a3a5C',
      colorText: '#FFFFFF',
    },
    Button: {
      primaryShadow: '0 2px 8px rgba(139, 92, 246, 0.4)',
      defaultBg: '#252540',
      defaultColor: '#FFFFFF',
      defaultBorderColor: '#3a3a5C',
    },
    Statistic: {
      colorTextDescription: '#8888A8',
      colorText: '#FFFFFF',
    },
    Tag: {
      defaultBg: '#252540',
      defaultColor: '#B8B8D1',
    },
    Divider: {
      colorSplit: '#3a3a5C',
    },
    Alert: {
      colorInfoBg: 'rgba(96, 165, 250, 0.15)',
      colorInfoBorder: 'rgba(96, 165, 250, 0.4)',
      colorInfo: '#60A5FA',
    },
    Spin: {
      colorBg: '#252540',
      colorPrimary: '#8B5CF6',
    },
    Tooltip: {
      colorBgSpotlight: '#252540',
      colorText: '#FFFFFF',
    },
    Message: {
      contentBg: '#252540',
    },
  },
};

// ============================================================
// 主题二：浅色清爽风（Clean Light）
// ============================================================
export const cleanLightTheme: ThemeConfig = {
  token: {
    // 主色 - 经典蓝
    colorPrimary: '#1677FF',
    colorInfo: '#1677FF',

    // 背景
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f0f2f5',
    colorBgSpotlight: '#fafafa',

    // 文字
    colorText: '#262626',
    colorTextSecondary: '#595959',
    colorTextTertiary: '#8c8c8c',
    colorTextQuaternary: '#bfbfbf',

    // 边框
    colorBorder: '#d9d9d9',
    colorBorderSecondary: '#f0f0f0',

    // 成功/警告/错误
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',

    // 圆角
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,

    // 字体
    fontFamily: "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    fontSize: 14,

    // 阴影
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
    boxShadowSecondary: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
  },
  components: {
    Layout: {
      siderBg: '#001529',
      headerBg: '#ffffff',
      bodyBg: '#f0f2f5',
      triggerBg: '#001529',
    },
    Menu: {
      darkItemBg: '#001529',
      darkItemSelectedBg: '#1677FF',
      darkItemHoverBg: '#1677FF',
      darkItemColor: 'rgba(255, 255, 255, 0.75)',
      darkItemSelectedColor: '#ffffff',
    },
    Card: {
      colorBgContainer: '#ffffff',
      colorBorderSecondary: '#f0f0f0',
    },
    Table: {
      colorBgContainer: '#ffffff',
      headerBg: '#fafafa',
      rowHoverBg: '#f5f5f5',
      colorBorderSecondary: '#f0f0f0',
    },
    Input: {
      colorBgContainer: '#ffffff',
      colorBorder: '#d9d9d9',
      activeBorderColor: '#1677FF',
      hoverBorderColor: '#40a9ff',
    },
    Select: {
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorBorder: '#d9d9d9',
      optionSelectedBg: '#e6f4ff',
    },
    Button: {
      primaryShadow: '0 2px 0 rgba(0, 0, 0, 0.02)',
    },
    Statistic: {
      colorTextDescription: '#8c8c8c',
    },
    Tag: {
      defaultBg: '#f5f5f5',
      defaultColor: '#595959',
    },
    Divider: {
      colorSplit: '#f0f0f0',
    },
    Alert: {
      colorInfoBg: '#e6f4ff',
      colorInfoBorder: '#91caff',
    },
  },
};

// ============================================================
// 主题类型
// ============================================================
export type ThemeName = 'cyber' | 'clean';

export const themeConfig: Record<ThemeName, { label: string; theme: ThemeConfig }> = {
  cyber: {
    label: '黑色科技风',
    theme: cyberDarkTheme,
  },
  clean: {
    label: '清爽管理风',
    theme: cleanLightTheme,
  },
};
