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
