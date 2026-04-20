# AGENTS.md

## Project Overview

B-DataGov 是一个 B站数据治理与可视化平台，包含实时弹幕监控、数据分析和数据治理功能。

项目分为两个主要部分：

- **前端** (`/frontend`): React + Vite + TypeScript，使用 Tailwind CSS、Ant Design、shadcn/ui
- **后端** (`/backend`): FastAPI + Python，使用 DuckDB、Spark Structured Streaming、PostgreSQL

## Frontend Workflow

- 阅读 `frontend/AGENTS.md` 获取前端开发规范
- 使用 `pnpm` 作为包管理器
- 运行开发服务器: `cd frontend && pnpm dev`

## Backend Workflow

- 阅读 `backend/AGENTS.md` 获取后端开发规范
- 使用 `uv` 进行 Python 包管理
- 实时处理使用 Spark Structured Streaming

## Testing & Quality Practices

- 使用 TDD 开发流程: red → green → refactor
- 前端使用 ESLint 和 TypeScript 严格模式
- 后端使用 Pydantic v2 进行数据验证
- 保持类型注解，避免使用 `Any`

## Language Style

- **Python**: 使用类型提示，遵循 PEP 8，使用 `TypedDict` 代替 dict 以获得类型安全
- **TypeScript**: 使用 strict 模式，避免使用 `any` 类型

## General Practices

- 优先编辑现有文件，只有在必要时才创建新文件
- 通过构造函数注入依赖，保持清晰的架构边界
- 在正确的层处理错误，使用领域特定的异常
- 前端用户可见的字符串使用 i18n，避免硬编码文本

## Architecture

### Frontend

- React Router v7 进行路由管理
- 双重布局系统: AppShell (侧边栏) 和 MainLayout (顶部导航)
- Ant Design 组件用于 HRBUST 风格页面
- shadcn/ui + Tailwind CSS 用于治理页面

### Backend

- FastAPI 提供 REST API
- DuckDB 用于数据存储和 OLAP 查询
- Spark Structured Streaming 用于实时弹幕处理
- PostgreSQL 用于用户认证数据
