# STEAM Lesson Agent - Claude Code 配置

## 项目概述

STEAM Lesson Agent v1 是一个 AI 驱动的教育课程生成平台，帮助教师快速创建 STEAM 课程计划。

## 技术栈

- **前端**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **后端**: Next.js API Routes, Prisma 7, PostgreSQL
- **AI**: LangChain, DeepSeek API
- **认证**: NextAuth 5, JWT, bcryptjs
- **UI**: Radix UI, React Hook Form, Zod

## 项目结构

```
app/                    # Next.js App Router
├── api/               # API 端点
│   ├── lesson/        # 课程生成
│   ├── chat/          # 聊天优化
│   ├── lessons/       # 课程 CRUD
│   └── auth/          # 认证
├── auth/              # 认证页面
├── admin/             # 管理后台
└── library/           # 课程库

components/            # React 组件
├── steam-agent/       # 核心功能组件
├── ui/                # 基础 UI 组件
└── layout/            # 布局组件

lib/                   # 业务逻辑
├── langchain/         # AI 集成
├── api.ts             # 客户端 API
├── auth.ts            # 认证配置
└── prisma.ts          # 数据库客户端

prisma/                # 数据库
└── schema.prisma      # 数据模型

types/                 # TypeScript 类型
```

## 开发命令

```bash
# 启动开发
pnpm dev

# 数据库
docker compose up -d
npx prisma generate
npx prisma migrate dev

# 构建
pnpm build
```

## 编码规范

1. **TypeScript**: 严格类型，避免 any
2. **组件**: 函数组件 + Hooks
3. **样式**: Tailwind CSS 优先
4. **国际化**: 支持 EN/ZH 双语
5. **错误处理**: 完善的 try-catch

## 关键文件

- `lib/langchain/index.ts` - AI 生成核心
- `lib/langchain/prompts.ts` - 提示词模板
- `app/api/lesson/route.ts` - 课程生成 API
- `prisma/schema.prisma` - 数据模型
- `lib/auth.ts` - 认证配置

## 环境变量

```
DATABASE_URL          # PostgreSQL 连接
DEEPSEEK_API_KEY      # AI API 密钥
DEEPSEEK_MODEL        # 模型名称
DEEPSEEK_BASE_URL     # API 端点
NEXTAUTH_SECRET       # 认证密钥
NEXTAUTH_URL          # 应用 URL
```

## Swarm Protocol

### Triggers

- "启动 Swarm 模式"
- "Activate Swarm Mode"
- 涉及 3+ 文件变更的功能开发任务自动建议启用

### Roles

- **Manager (Scrum Master)**: 负责任务拆解、分配和协调，不直接写代码。审查各 Agent 产出，确保一致性。
- **Frontend Builder**: 专注 UI 组件和页面开发。工作范围：`components/`, `app/(auth|admin|library)/`, 样式和布局。
- **Backend Builder**: 专注 API、数据库和业务逻辑。工作范围：`app/api/`, `lib/(api|auth|prisma).ts`, `prisma/schema.prisma`, `middleware.ts`。
- **AI Engineer**: 专注 LangChain 集成和 AI Agent 逻辑。工作范围：`lib/langchain/`, `lib/editor/agent*`, `lib/editor/tools/`。
- **QA Engineer**: 专注测试编写和质量保证。工作范围：`__tests__/`, `jest.config.ts`。要求覆盖 happy path、边界值、错误处理。

### Rules

1. 使用 Task 工具生成 Agent，每个 Agent 以 `run_in_background: true` 并行执行
2. 每个 Agent 在独立 Git Worktree 中工作，避免代码冲突
3. 代码必须通过测试后才能合并到主分支
4. Agent 间通过 TaskCreate/TaskUpdate 共享任务状态
5. Manager 负责最终审查和合并决策
6. 遵循项目编码规范：TypeScript 严格类型、Tailwind CSS、EN/ZH 双语支持

### Agent Scope Boundaries

```
Frontend Builder  → components/**  app/auth/**  app/admin/**  app/library/**
Backend Builder   → app/api/**  lib/api.ts  lib/auth.ts  lib/prisma.ts  prisma/**  middleware.ts
AI Engineer       → lib/langchain/**  lib/editor/**  types/**
QA Engineer       → __tests__/**  jest.config.ts
Shared (需协调)    → types/  package.json  CLAUDE.md
```

### Workflow

1. Manager 分析需求 → 拆解为子任务并分配给对应 Agent
2. 各 Agent 在独立 Worktree 并行开发
3. QA Agent 为每个功能编写测试用例
4. 测试通过后 Manager 审查并合并
5. 完成后执行 cleanup 清理资源
