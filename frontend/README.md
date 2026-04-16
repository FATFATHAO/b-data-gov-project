# B-DataGov Lite — 前端接口文档

> B站数据治理与可视化平台 · Phase 2 & 3 & 4 前端实现
> 更新时间：2026/04/15

---

## 一、项目结构

```
frontend/
├── src/
│   ├── api/
│   │   ├── index.ts       # API 调用函数（统一封装）
│   │   ├── request.ts     # Axios 实例（baseURL: localhost:8000）
│   │   └── types.ts       # TypeScript 类型定义（对齐后端 Pydantic schema）
│   ├── layouts/
│   │   └── MainLayout.tsx  # 页面整体布局（侧边栏 + 顶栏）
│   ├── pages/
│   │   ├── Catalog/       # 数据资产目录
│   │   │   └── index.tsx
│   │   ├── Quality/       # 质量监控大屏（含爬虫健康度，Phase 4）
│   │   │   └── index.tsx
│   │   ├── Lineage/       # 数据血缘追踪
│   │   │   └── index.tsx
│   │   └── ROI/           # 治理成效分析
│   │       └── index.tsx
│   ├── App.tsx            # 路由配置
│   ├── main.tsx           # 入口文件
│   └── index.css          # 全局重置样式
├── vite.config.ts         # Vite 配置（含 /api Proxy
├── package.json
└── index.html
```

---

## 二、技术栈

| 组件 | 技术选型 | 版本 |
|---|---|---|
| 构建工具 | Vite | ^8.0.0 |
| 框架 | React + TypeScript | React ^19.0 |
| 路由 | React Router DOM | ^7.14.1 |
| UI 组件库 | Ant Design | ^6.3.5 |
| 图表库 | ECharts + echarts-for-react | ^6.0.0 |
| 流程图/DAG | ReactFlow | ^11.11.4 |
| 网络请求 | Axios | ^1.15.0 |
| 包管理器 | pnpm | ^10.27.0 |

---

## 三、API 层

### 3.1 Axios 实例 (`src/api/request.ts`)

- `baseURL`: `http://localhost:8000`
- `timeout`: 10000ms
- 响应拦截器：自动返回 `response.data`
- 类型标注使用 `import type`，满足 `verbatimModuleSyntax`

### 3.2 类型定义 (`src/api/types.ts`)

所有类型与后端 Pydantic schema 一一对应：

```typescript
// Catalog
TableInfo       { name: string, layer: string, row_count: number }
ColumnInfo      { name: string, type: string }
TableSchema     { table_name: string, columns: ColumnInfo[], row_count: number }

// Quality
QualityMetrics  { total_records, dirty_records, clean_records,
                  field_missing_rate, dirty_rate }
DailyTrendItem  { date: string, dirty_count: number, clean_count: number }
DailyTrend      { items: DailyTrendItem[] }
CrawlHealth     { run_id, run_time, up_name, videos_fetched, comments_fetched,
                  dirty_filtered, spam_truncated, api_success_rate, status }
                  // api_success_rate: 0.0 ~ 1.0
                  // status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'UNKNOWN'

// Lineage
LineageNode     { id: string, name: string, layer: string, description: string }
LineageEdge     { source: string, target: string, label: string }
LineageGraph    { nodes: LineageNode[], edges: LineageEdge[] }

// ROI
StorageStats    { ods_size_mb, dwd_size_mb, dws_size_mb, total_size_mb, compression_ratio }
```

### 3.3 API 调用函数 (`src/api/index.ts`)

| 函数 | 方法 | 路径 | 返回类型 | Phase |
|---|---|---|---|---|
| `fetchTables()` | GET | `/api/catalog/tables` | `TableInfo[]` | P1 |
| `fetchTableSchema(name)` | GET | `/api/catalog/schema/{name}` | `TableSchema` | P1 |
| `fetchQualityMetrics()` | GET | `/api/quality/metrics` | `QualityMetrics` | P1 |
| `fetchDailyTrend()` | GET | `/api/quality/daily-trend` | `DailyTrend` | P1 |
| `fetchCrawlHealth()` | GET | `/api/quality/crawl-health` | `CrawlHealth` | **P4** |
| `fetchLineageGraph()` | GET | `/api/lineage/graph` | `LineageGraph` | P1 |
| `fetchStorageStats()` | GET | `/api/roi/storage` | `StorageStats` | P1 |

所有函数返回 `Promise<T>`，可直接在 `useEffect` 中调用。

---

## 四、页面详解

### 4.1 资产目录 (Catalog)

**路由**: `/catalog`

**API**: `fetchTables()` + `fetchTableSchema(tableName)`

```
┌─────────────────────────────────────────────────────────┐
│  [总表数: 3]        [总行数: 1342]      [层级: 3层]    │
├───────────────┬─────────────────────────────────────────┤
│ 表列表        │  选中表字段结构                          │
│ ods_raw_*  ←───→  id        VARCHAR                    │
│ dwd_clean_*    video_id   VARCHAR                    │
│ dws_up_stats   content    VARCHAR                    │
└───────────────┴─────────────────────────────────────────┘
```

- **顶部**: `Statistic` 卡片展示总表数/总行数/层级数
- **左侧**: Ant Design `Table`，层级着色（橙 ODS / 绿 DWD / 紫 DWS）
- **右侧**: 点击表名后加载字段 `Table`，字段名 monospace + 类型 Tag
- **加载状态**: `Spin` + `message.error`

---

### 4.2 质量监控大屏 (Quality)

**路由**: `/quality`

**API**: `fetchQualityMetrics()` + `fetchDailyTrend()` + `fetchCrawlHealth()`（Phase 4）

```
┌──────────────────────────────────────────────────────────────────┐
│ [总处理量] [拦截脏数据] [质量评分] [数据集成健康度: 暂无运行记录] │
│                                        ↗ api_success_rate      │
│                                        ↗ last_updated_at 时效性 │
├─────────────────────┬────────────────────────────────────────────┤
│  饼图               │  折线图                                     │
│  脏数据类型分布      │  近7天拦截趋势                             │
└─────────────────────┴────────────────────────────────────────────┘
│  [字段缺失率]   [脏数据率]   [有效数据]                          │
│  （Phase 4 新增 ↓）                                            │
│  [爬虫运行详情] run_id / 评论数 / 拦截量 / API成功率 / 更新时间  │
```

**顶部 4 张卡片**（Phase 4 新增第4张）：

| 卡片 | 数据来源 | 颜色规则 |
|---|---|---|
| 总处理数据量 | `metrics.total_records` | 蓝色 |
| 累计拦截脏数据 | `metrics.dirty_records` | 红色 |
| 全局数据质量评分 | `metrics` 计算 | ≥80绿 / 60-80黄 / <60红 |
| **数据集成健康度** | `crawlHealth.api_success_rate` | ≥90%绿 / ≥70%黄 / <70%红 |

**数据集成健康度卡片**（Phase 4）：
- `api_success_rate` 百分比大字显示
- `status` 状态 Tag（SUCCESS 绿 / PARTIAL 橙 / FAILED 红）
- 时效性颜色：<1小时最新（绿）/ 1-24小时较旧（黄）/ >24小时过期（红）

**底部爬虫运行详情**（仅在有 ETL 数据时显示）：
- `run_id`（monospace）、抓取评论数、空内容拦截数、刷屏截断数、API成功率、最后更新时间

**兜底数据**：Quality/ROI 页面的兜底数据保证 API 失败时页面仍可渲染。

---

### 4.3 数据血缘追踪 (Lineage)

**路由**: `/lineage`

**API**: `fetchLineageGraph()`

```
┌──────────────────────────────────────────────────────────┐
│  数据血缘追踪 · 点击节点查看详情                           │
├──────────────────────────────────────────────────────────┤
│  [ODS灰色节点] ──动画虚线── [DWD蓝色节点] ──动画虚线── [DWS绿色节点] │
│                    ReactFlow 画布                          │
├──────────────────────────────────────────────────────────┤
│  ■ ODS 原始层   ■ DWD 明细层   ■ DWS 汇总层   虚线=数据流向│
└──────────────────────────────────────────────────────────┘
         ↗ 点击节点 → 右侧 Drawer（表名 / 层级 / 描述）
```

**ReactFlow 关键实现**:

| 特性 | 实现 |
|---|---|
| 自定义节点 | `CustomNode` + `nodeTypes` 注册 |
| 节点样式 | ODS 灰底 / DWD 蓝底 / DWS 绿底，通过 `layerNodeStyles` 映射 |
| 层级布局 | ODS→x:50, DWD→x:400, DWS→x:750，同层垂直分布 |
| 连线动画 | `animated: true` + `type: 'smoothstep'` |
| 节点点击 | `onNodeClick` → 右侧 `Drawer` |
| DAG 属性 | `sourcePosition: Right`, `targetPosition: Left` |

---

### 4.4 治理成效分析 (ROI)

**路由**: `/roi`

**API**: `fetchStorageStats()` + `fetchTables()`

```
┌──────────────────────────────────────────────────────────┐
│  [节省存储 58%]    [清洗脏数据 79条]   [性能提升 ~3x]    │
├─────────────────────────────┬────────────────────────────┤
│  ODS vs DWD 柱状对比图       │  治理前后 Tag 词云对比       │
│  灰色=ODS / 绿色=DWD         │  红色Tags   vs   绿色Tags  │
└─────────────────────────────┴────────────────────────────┘
│  ODS: 0.0954MB  DWD: 0.0401MB  DWS: 0.0257MB  压缩比: 0.42│
```

- **顶部大字报**: 渐变色 Card，`valueStyle: { fontSize: 36 }`
- **柱状图**: ODS 灰 / DWD 绿，`barWidth: 32`，圆角顶部
- **词云模拟**: 左右分栏 Tag 渲染
  - 治理前: `'哈哈哈哈哈哈哈'`, `'<script>'`, `'11111111'`, `'ټ ټ ټ'` 等（红色）
  - 治理后: `'UP主加油'`, `'干货满满'`, `'先码后看'`, `'Respect'` 等（绿色）

---

## 五、MainLayout 布局组件

**文件**: `src/layouts/MainLayout.tsx`

```
┌────────────────────────────────────────────────────┐
│  Sider (深色 #001529, 220px)  │  Header + Content   │
│                               │                     │
│  [B-DataGov Lite]             │  B站数据治理...     │
│                               │                     │
│  ■ 数据资产目录 (/catalog)     │    <Routes>         │
│  ■ 质量监控大屏 (/quality)     │    {children}       │
│  ■ 数据血缘追踪 (/lineage)     │                     │
│  ■ 治理成效分析 (/roi)         │                     │
└───────────────────────────────┴─────────────────────┘
```

- `Sider`: `collapsible` 可折叠，`Menu` theme="dark"
- 路由高亮: `selectedKeys={[location.pathname]}` + `onClick` 导航
- 图标: Ant Design Icons（`DatabaseOutlined`/`DashboardOutlined`/`ShareAltOutlined`/`RiseOutlined`）

---

## 六、路由配置

**文件**: `src/App.tsx`

```tsx
<BrowserRouter>
  <MainLayout>
    <Routes>
      <Route path="/" element={<Navigate to="/catalog" replace />} />
      <Route path="/catalog" element={<Catalog />} />
      <Route path="/quality" element={<Quality />} />
      <Route path="/lineage" element={<Lineage />} />
      <Route path="/roi" element={<ROI />} />
    </Routes>
  </MainLayout>
</BrowserRouter>
```

---

## 七、TypeScript 注意事项

### 7.1 `verbatimModuleSyntax` 约束

所有类型导入必须使用 `import type`：

```typescript
// ✅ 正确
import type { Node, Edge } from 'reactflow';
import type { CrawlHealth } from './types';

// ❌ 错误 — TS1484 Error
import { Node } from 'reactflow';
```

### 7.2 Axios 拦截器与 TS 类型桥接

响应拦截器返回 `response.data`，TS 泛型无法自动推导。API 函数需显式声明返回类型并用 `as unknown as T` 桥接：

```typescript
export const fetchCrawlHealth = (): Promise<CrawlHealth> =>
  request.get<CrawlHealth>('/api/quality/crawl-health') as unknown as Promise<CrawlHealth>;
```

---

## 八、启动与构建

### 8.1 一键启动（推荐）

```bash
./start.sh
# 后端 → http://localhost:8000
# 前端 → http://localhost:5173（/api/* 自动代理到 8000）
```

### 8.2 分别启动（调试用）

```bash
# 终端 1 — 后端
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000

# 终端 2 — 前端
cd frontend && pnpm dev
```

### 8.3 生产构建

```bash
cd frontend && pnpm run build
```

**构建产物**:

| 文件 | 大小 | gzip |
|---|---|---|
| JS bundle | 2.28 MB | 740 KB |
| CSS | 7.07 KB | 1.54 KB |

> 注：echarts + reactflow + antd 体积较大，后续可做 code splitting 优化

---

## 九、Vite Proxy 配置

`vite.config.ts` 已配置开发代理，前端只需访问 `localhost:5173`：

```typescript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
},
```

---

## 十、已完成 vs 待实现

### ✅ 已完成

| 功能 | Phase | 说明 |
|---|---|---|
| Vite + React + TypeScript 项目初始化 | P2 | |
| pnpm 包管理器配置 | P2 | |
| Ant Design 主题 + MainLayout | P2 | |
| Axios 封装 + 类型定义 | P2 | 含 `CrawlHealth` 类型（P4） |
| 数据资产目录页面 (Catalog) | P2 | 左侧表列表 + 右侧字段 Table |
| 质量监控大屏 (Quality) | P3/P4 | 卡片+饼图+折线图，**新增爬虫健康度卡片**（P4） |
| 数据血缘追踪 DAG (Lineage) | P3 | ReactFlow 自定义节点+动画边 |
| 治理成效分析 (ROI) | P3 | 柱状图+Tag词云模拟 |
| 四个页面路由串联 | P2 | |
| ECharts 图表 (饼图/折线图/柱状图) | P3 | |
| ReactFlow DAG 可视化 | P3 | |
| API 兜底 Fallback 数据 | P3 | Quality 页面 fallback |
| 一键启动脚本 + Vite Proxy | P3 | `start.sh` |
| TypeScript 零错误编译 | All | |
| bilibili-api-python 爬虫接入 | P4 | ETL 脚本 `bili_spider_etl.py` |

### 🔄 待实现 / 优化项

| 功能 | 优先级 | 说明 |
|---|---|---|
| Code Splitting | 中 | echarts/reactflow 按需加载，减小首屏 JS |
| 响应式布局 | 中 | 适配移动端，当前主要为桌面端设计 |
| 词云组件 | 中 | ROI 词云用真实 echarts-wordcloud 替代 Tag 模拟 |
| 增量 ETL | 高 | 每次只抓新增评论，非全量重复抓取 |
| 实时数据刷新 | 中 | Polling / WebSocket 定时拉取质量数据 |
| 血缘字段级 | 中 | 当前为表级血缘，扩展到字段级 |
| 暗黑模式 | 低 | 跟随 Ant Design 主题配置 |
| 全局状态管理 | 低 | 页面内 useState，复杂后引入 Zustand |
| 错误边界 | 低 | React ErrorBoundary 捕获组件异常 |
| E2E 测试 | 低 | Playwright 覆盖核心交互 |
