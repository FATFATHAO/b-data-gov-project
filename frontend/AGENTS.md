# Frontend Agent Guide

## 项目结构

```
frontend/
├── src/
│   ├── app/                 # 应用入口和全局配置
│   ├── components/
│   │   ├── ui/             # shadcn/ui 组件
│   │   ├── layout/         # 布局组件 (AppShell, Sidebar, Header)
│   │   └── charts/         # 图表组件 (Dashboard 相关)
│   ├── contexts/           # React Context (AuthContext, ThemeContext)
│   ├── lib/                # 工具函数 (utils)
│   ├── pages/
│   │   ├── auth/          # 登录注册页面
│   │   ├── dashboard/      # Dashboard 页面 (HRBUST)
│   │   ├── monitor/        # 监控页面 (HRBUST)
│   │   ├── admin/          # 管理后台 (HRBUST)
│   │   └── governance/     # 数据治理页面 (shadcn)
│   └── main.tsx            # 应用入口
├── public/                 # 静态资源
└── package.json
```

## 布局系统

### AppShell (侧边栏布局)

用于数据治理页面 (Dashboard, Catalog, Quality 等)

- 侧边栏使用 Zustand store (`sidebar-store.ts`) 管理展开/收起状态
- 侧边栏宽度: 展开 240px，收起 64px (w-16)
- 内容区域自适应: `ml-[240px]` / `ml-16`
- 键盘快捷键: `Ctrl+B` 切换展开/收起

### MainLayout (顶部导航布局)

用于 HRBUST 风格页面 (旧版 Dashboard, PlatformMonitor)

- Ant Design 顶部导航
- 水平菜单
- 用户下拉菜单

## 技术栈

- **框架**: React 18 + Vite
- **语言**: TypeScript (strict 模式)
- **样式**: Tailwind CSS v4 + shadcn/ui
- **UI 组件**: Ant Design v6 (HRBUST 页面)
- **路由**: React Router v7
- **图表**: ECharts (echarts-for-react)
- **图标**: Lucide React, Ant Design Icons

## 开发规范

### 组件开发

1. 优先使用 shadcn/ui 组件
2. HRBUST 风格页面使用 Ant Design
3. 组件文件放在 `components/` 对应目录下
4. 页面组件放在 `pages/` 对应目录下

### 样式规范

1. 使用 Tailwind CSS 类名
2. 避免使用内联样式（除非动态值）
3. 颜色使用 CSS 变量: `var(--color-*)`
4. 使用 `cn()` 函数合并类名

```typescript
import { cn } from "@/lib/utils";

const className = cn(
  "flex items-center px-4",
  isActive && "bg-primary/10"
);
```

### 路由规范

1. 使用 React Router v7 的嵌套路由
2. 公开路由: `/login`, `/register`
3. 受保护路由通过 `AuthGuard` 组件包裹
4. 路由配置在 `App.tsx`

### 状态管理

1. 组件状态: `useState`
2. 全局状态: React Context
3. 侧边栏状态: Zustand store

## 组件清单

### shadcn/ui 组件 (`components/ui/`)

- Button
- DropdownMenu
- Avatar
- Input
- Card
- Table
- Tabs

### 布局组件 (`components/layout/`)

- AppShell - 侧边栏布局容器
- Sidebar - 可折叠侧边栏
- Header - 顶部导航栏

### 图表组件 (`components/charts/`)

- MonitorChart - 监控图表
- WordCloudChart - 词云图
- SentimentChart - 情感分析图
- HotWordsRank - 热门词汇排行
- SurgeDanmakuList - 弹幕风暴列表
- TaskControl - 任务控制面板

## 环境变量

```env
VITE_API_BASE_URL=http://localhost:8000
```

## 常用命令

```bash
# 安装依赖
pnpm install

# 开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 类型检查
pnpm type-check

# 代码格式化和检查
pnpm lint
```

## API 调用

API 请求通过 Fetch 或 Axios，封装在 `lib/api.ts` 中。

```typescript
// 示例 API 调用
const response = await fetch('/api/dashboard/stats');
const data = await response.json();
```

## 注意事项

1. HRBUST 页面使用 Ant Design，需要 `AntDProvider` 提供主题配置
2. 侧边栏收起时宽度为 64px (w-16)，内容区使用 ml-16
3. 展开时宽度为 240px，内容区使用 ml-[240px]
4. 使用 `lucide-react` 图标库，与 Ant Design Icons 区分使用
