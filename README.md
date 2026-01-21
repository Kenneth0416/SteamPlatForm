**中文** | [English](./README_EN.md)

# STEAM Lesson Agent

<div align="center">

![Version](https://img.shields.io/badge/version-v1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-20.x-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)

**AI-Powered STEAM Lesson Planning Platform**

[Features](#-核心特性) • [Architecture](#-系统架构) • [Quick Start](#-快速开始) • [Documentation](#-api-端点说明)

</div>

---

## 项目简介

**STEAM Lesson Agent** 是一个基于 AI 技术的智能课程生成平台，专为教育工作者设计。通过集成 DeepSeek AI 和 LangChain 框架，平台能够快速生成专业的 STEAM（科学、技术、工程、艺术、数学）课程计划，大幅提升教师的备课效率。

### 核心价值

- 快速生成：几分钟内完成专业课程计划创建
- 智能优化：AI 驱动的内容优化和聊天式交互
- 完整管理：从课程创建到版本控制的全流程支持

---

## ✨ 核心特性

- 🤖 **AI 智能课程生成** - 基于 DeepSeek + LangChain 的智能课程计划生成
- 📝 **多文档编辑器** - 支持 Lesson Plan、Guide、Worksheet 等多种文档类型
- 🔄 **版本控制和历史追踪** - 完整的文档版本管理和编辑历史记录
- 💬 **智能聊天优化** - 通过对话式交互优化课程内容
- 🔐 **完整用户认证系统** - 基于 NextAuth 5 的安全认证机制
- 📚 **课程库管理** - 支持收藏、归档、标签分类等功能
- 📊 **管理后台** - 用户和课程数据管理

---

## 🏗️ 技术栈

### 前端技术
- **Next.js 16** - React 服务端渲染框架
- **React 19** - 用户界面库
- **TypeScript 5** - 类型安全的 JavaScript
- **Tailwind CSS 4** - 实用优先的 CSS 框架

### 后端技术
- **Next.js API Routes** - 服务端 API 端点
- **Prisma 7** - 现代化 ORM 框架
- **PostgreSQL** - 关系型数据库

### AI 技术
- **LangChain** - AI 应用开发框架
- **DeepSeek API** - 大语言模型服务

### 认证和 UI
- **NextAuth 5** - 认证解决方案
- **Radix UI** - 无障碍 UI 组件库
- **React Hook Form** - 表单管理
- **Zod** - 模式验证

---

## 📐 系统架构

### 系统分层架构图

```mermaid
graph TB
    subgraph "前端层 - Frontend"
        UI[React 19 UI Components]
        Pages[Next.js 16 Pages]
    end

    subgraph "业务逻辑层 - Business Logic"
        Auth[NextAuth 5 Authentication]
        API[API Routes]
        LangChain[LangChain Agent]
    end

    subgraph "数据层 - Data Layer"
        Prisma[Prisma 7 ORM]
        DB[(PostgreSQL)]
    end

    subgraph "外部服务 - External Services"
        DeepSeek[DeepSeek API]
    end

    UI --> Pages
    Pages --> API
    API --> Auth
    API --> LangChain
    LangChain --> DeepSeek
    API --> Prisma
    Prisma --> DB
```

### 数据模型 ER 图

```mermaid
erDiagram
    User ||--o{ Lesson : creates
    Lesson ||--o{ DocumentBlock : contains
    Lesson ||--o{ DocumentVersion : tracks
    Lesson ||--o{ EditHistory : records
    Lesson ||--o{ EditorDocument : includes

    User {
        string id PK
        string email UK
        string name
        string password
        string role
        datetime createdAt
        datetime updatedAt
    }

    Lesson {
        string id PK
        string userId FK
        string title
        json lessonPlan
        json requirements
        json chatHistory
        string[] tags
        boolean isFavorite
        boolean isArchived
        datetime createdAt
        datetime updatedAt
    }

    DocumentBlock {
        string id PK
        string lessonId FK
        string type
        string content
        int order
        int level
        datetime createdAt
        datetime updatedAt
    }

    DocumentVersion {
        string id PK
        string lessonId FK
        int version
        json snapshot
        string summary
        datetime createdAt
    }

    EditHistory {
        string id PK
        string lessonId FK
        string blockId
        string action
        string oldContent
        string newContent
        string reason
        string source
        datetime createdAt
    }

    EditorDocument {
        string id PK
        string lessonId FK
        string name
        string type
        string content
        int order
        datetime createdAt
        datetime updatedAt
    }
```

### AI 课程生成流程图

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as API Routes
    participant LangChain
    participant DeepSeek as DeepSeek API
    participant DB as PostgreSQL

    User->>Frontend: 输入课程需求
    Frontend->>API: POST /api/lesson
    API->>LangChain: 创建 Agent
    LangChain->>DeepSeek: 调用 AI 模型
    DeepSeek-->>LangChain: 返回课程内容
    LangChain-->>API: 结构化课程计划
    API->>DB: 保存 Lesson
    API->>DB: 创建 DocumentBlocks
    API->>DB: 记录 EditHistory
    API-->>Frontend: 返回课程数据
    Frontend-->>User: 显示课程
```

### AI Agent 架构详解

#### 1. 三大 AI Agent 协作架构

```mermaid
graph TB
    subgraph "用户交互层"
        UI[前端界面]
    end

    subgraph "AI Agent 层"
        LessonAgent[课程生成 Agent<br/>generateLesson]
        ChatAgent[对话优化 Agent<br/>chatWithLesson]
        ApplyAgent[变更应用 Agent<br/>applyChangeWithLLM]
    end

    subgraph "LangChain 核心"
        Prompt[Prompt Template]
        LLM[DeepSeek LLM]
        Parser[Output Parser]
    end

    subgraph "数据存储"
        DB[(PostgreSQL)]
    end

    UI -->|1. 提交需求| LessonAgent
    LessonAgent --> Prompt
    Prompt --> LLM
    LLM --> Parser
    Parser -->|生成课程| DB
    DB -->|2. 加载课程| UI

    UI -->|3. 发送优化请求| ChatAgent
    ChatAgent --> Prompt
    Prompt --> LLM
    LLM --> Parser
    Parser -->|建议变更| UI

    UI -->|4. 应用变更| ApplyAgent
    ApplyAgent --> Prompt
    Prompt --> LLM
    LLM -->|JSON 编辑操作| ApplyAgent
    ApplyAgent -->|5. 更新课程| DB

    style LessonAgent fill:#e1f5ff
    style ChatAgent fill:#fff4e1
    style ApplyAgent fill:#e8f5e9
```

#### 2. Editor Agent - LLM-Driven Document Editor（核心创新）

这是系统真正的核心：基于 LangChain Tool Calling 的智能文档编辑 Agent，通过自然语言指令实现精确的文档操作。

##### 架构概览

```mermaid
graph TB
    User[用户自然语言指令] --> AgentLoop[Editor Agent Loop<br/>最多 30 轮]

    AgentLoop --> SystemPrompt[System Prompt<br/>定义效率规则和工作流程]
    SystemPrompt --> LLM[DeepSeek LLM<br/>temperature: 0.2]

    LLM --> Decision{是否需要<br/>调用工具?}

    Decision -->|是| ToolDispatch[工具分发器]
    Decision -->|否| Response[返回最终回复]

    ToolDispatch --> Tools[五大核心工具]

    subgraph Tools[五大核心工具]
        ListBlocks[list_blocks<br/>列出文档结构]
        ReadBlocks[read_blocks<br/>批量读取内容]
        EditBlocks[edit_blocks<br/>批量编辑内容]
        AddBlock[add_block<br/>添加新块]
        DeleteBlock[delete_block<br/>删除块]
    end

    ListBlocks --> BlockIndex[BlockIndexService<br/>文档索引]
    ReadBlocks --> BlockIndex
    EditBlocks --> PendingDiffs[Pending Diffs<br/>待确认变更队列]
    AddBlock --> PendingDiffs
    DeleteBlock --> PendingDiffs

    BlockIndex --> Guard[ReadWriteGuard<br/>读写权限保护]
    PendingDiffs --> Guard

    Guard --> ToolResult[工具执行结果]
    ToolResult --> ToolTrace[ToolTrace<br/>调用历史追踪]

    ToolTrace --> StuckDetector{检测循环<br/>卡死?}
    StuckDetector -->|正常| AgentLoop
    StuckDetector -->|卡死| EarlyExit[提前退出]

    PendingDiffs --> UserConfirm[用户确认变更]
    UserConfirm --> ApplyToDb[(应用到数据库)]

    style LLM fill:#c5e1a5
    style Tools fill:#e1f5ff
    style PendingDiffs fill:#fff4e1
    style Guard fill:#ffcdd2
    style StuckDetector fill:#ce93d8
```

##### 工作流程详解

```mermaid
sequenceDiagram
    participant U as 用户
    participant A as Editor Agent
    participant LLM as DeepSeek LLM
    participant T as Tool System
    participant D as Pending Diffs
    participant DB as Database

    U->>A: "在第二节后添加小组讨论环节"
    A->>LLM: System Prompt + 用户消息

    Note over LLM: 规划操作步骤<br/>list → read → edit

    LLM->>T: tool_call: list_blocks()
    T->>T: BlockIndexService.getBlockIndex()
    T-->>LLM: 返回文档结构 + 预览

    LLM->>T: tool_call: read_blocks([block_3, block_4])
    T->>T: 批量读取指定块
    T-->>LLM: 返回完整内容

    Note over LLM: 分析内容<br/>生成编辑方案

    LLM->>T: tool_call: add_block(afterBlockId: "block_3", ...)
    T->>D: 创建 PendingDiff
    D-->>T: diff_id: "diff-123"
    T-->>LLM: "已创建待确认变更"

    LLM-->>A: 最终回复（无更多 tool_calls）
    A-->>U: "已添加小组讨论环节（待确认）"

    U->>D: 点击"应用变更"
    D->>DB: 执行 diff
    DB-->>U: 更新成功
```

##### 五大核心工具

| 工具 | 功能 | 批量支持 | 权限保护 |
|------|------|---------|---------|
| **list_blocks** | 列出文档结构和内容预览 | N/A | 标记为已读 |
| **read_blocks** | 批量读取块内容（含上下文） | ✅ 最多 25 | ReadWriteGuard |
| **edit_blocks** | 批量编辑块内容 | ✅ 最多 25 | 必须先读取 |
| **add_block** | 在指定位置后添加新块 | 单个 | 内容非空校验 |
| **delete_block** | 删除指定块 | 单个 | 必须先读取 |

##### 关键创新机制

**1. Pending Diffs 机制**

所有编辑操作先生成 `PendingDiff` 对象，用户确认后才应用到数据库：
- **安全性**：防止 LLM 误操作直接修改数据
- **可追溯**：完整记录变更历史（EditHistory 表）
- **可撤销**：用户可拒绝 AI 建议的变更

```typescript
interface PendingDiff {
  id: string           // diff-timestamp-random
  blockId: string      // 目标块 ID
  action: 'update' | 'add' | 'delete'
  oldContent: string   // 原内容
  newContent: string   // 新内容
  reason: string       // LLM 提供的修改原因
}
```

**2. ReadWriteGuard（读写保护）**

防止 LLM 未读先写的错误模式：
- **规则**：编辑/删除前必须先调用 `read_blocks`
- **检测**：`guard.canEdit(blockId)` 返回 `{allowed: false, error: "..."}`
- **作用**：强制 Agent 理解内容后再修改

**3. 效率规则（System Prompt 强制）**

- 最多 3 步工作流：`list_blocks` → `read_blocks` → `edit_blocks`
- 批量操作优先：一次调用处理多个块
- 只读查询 2 步：`list_blocks` → 直接回答（跳过不必要的 read）

**4. 防卡死机制（Stuck Detection）**

检测三种循环模式：
- 连续 3 次调用 `list_blocks`
- 连续 3 次调用 `read_blocks` 且参数相同
- 连续 10 次调用无任何编辑操作

**触发机制**：
```typescript
detectStuck(toolTrace) → {
  isStuck: true,
  reason: "list_blocks called 3 times consecutively"
}
```

**5. 多文档支持**

额外两个工具用于多文档编辑：
- `list_documents` - 列出所有打开的文档
- `switch_document(docId)` - 切换活动文档
- 切换后自动重置 BlockIndex 和 Guard

##### 技术架构亮点

1. **LangChain Tool Calling**：原生支持 OpenAI-style function calling
2. **流式输出**：`runEditorAgentStream()` 实时返回工具调用和内容
3. **上下文管理**：`BlockIndexService` 提供高效的块索引和搜索
4. **状态追踪**：`ToolTrace` 环形缓冲区记录最近 30 次调用
5. **错误恢复**：工具执行失败不中断循环，返回错误信息给 LLM 重试

##### 实现文件

- **lib/editor/agent.ts** - Agent 主循环和流式输出
- **lib/editor/tools/index.ts** - 五大核心工具实现
- **lib/editor/tools/document-tools.ts** - 多文档工具
- **lib/editor/agent/runtime.ts** - ToolTrace 和 detectStuck
- **lib/editor/block-index.ts** - BlockIndexService
- **lib/editor/tools/middleware.ts** - ReadWriteGuard

#### 3. Apply Change Agent 编辑操作流程

```mermaid
stateDiagram-v2
    [*] --> 接收变更请求
    接收变更请求 --> 调用LLM生成编辑操作
    调用LLM生成编辑操作 --> 解析JSON编辑指令

    解析JSON编辑指令 --> 验证操作类型

    验证操作类型 --> Replace: action=replace
    验证操作类型 --> Delete: action=delete
    验证操作类型 --> InsertAfter: action=insert_after
    验证操作类型 --> InsertBefore: action=insert_before

    Replace --> Fuzzy匹配old_text
    Delete --> Fuzzy匹配old_text
    InsertAfter --> Fuzzy匹配anchor
    InsertBefore --> Fuzzy匹配anchor

    Fuzzy匹配old_text --> 执行替换
    Fuzzy匹配anchor --> 执行插入

    执行替换 --> 返回更新文档
    执行插入 --> 返回更新文档

    返回更新文档 --> [*]

    note right of Fuzzy匹配old_text
        智能匹配：
        - 忽略 markdown 标记
        - 处理空白符差异
        - 滑动窗口扫描
    end note
```

---

## 🚀 快速开始

### 环境要求

- Node.js 20.x
- pnpm 10.28.1+
- PostgreSQL 14+
- Docker (可选)

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/your-username/steam-lesson-agent.git
cd SteamPlatForm-main
```

2. **安装依赖**

```bash
pnpm install
```

3. **启动数据库**

```bash
docker compose up -d
```

4. **配置环境变量**

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入必要的配置信息。

5. **初始化数据库**

```bash
npx prisma migrate dev
npx prisma generate
```

6. **启动开发服务器**

```bash
pnpm dev
```

7. **访问应用**

在浏览器中打开 [http://localhost:3030](http://localhost:3030)

---

## 📁 项目结构

```
SteamPlatForm-main/
├── app/                    # Next.js App Router
│   ├── api/               # API 端点
│   │   ├── lesson/        # 课程生成
│   │   ├── chat/          # 聊天优化
│   │   ├── lessons/       # 课程 CRUD
│   │   └── auth/          # 认证
│   ├── auth/              # 认证页面
│   ├── admin/             # 管理后台
│   └── library/           # 课程库
│
├── components/            # React 组件
│   ├── steam-agent/       # 核心功能组件
│   ├── ui/                # 基础 UI 组件 (Radix UI)
│   └── layout/            # 布局组件
│
├── lib/                   # 业务逻辑
│   ├── langchain/         # AI 集成
│   │   ├── index.ts       # LangChain Agent 核心
│   │   └── prompts.ts     # AI 提示词模板
│   ├── api.ts             # 客户端 API 封装
│   ├── auth.ts            # NextAuth 配置
│   └── prisma.ts          # Prisma 客户端
│
├── prisma/                # 数据库
│   └── schema.prisma      # 数据模型定义
│
├── types/                 # TypeScript 类型定义
│
├── docker-compose.yml     # Docker 配置
├── next.config.mjs        # Next.js 配置
└── package.json           # 项目依赖
```

---

## 🔑 环境变量配置

创建 `.env` 文件并配置以下变量：

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/steam_db

# DeepSeek API
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Authentication
NEXTAUTH_SECRET=your_secret_key_here
NEXTAUTH_URL=http://localhost:3030

# Optional: Rate Limiting (Upstash)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

### 环境变量说明

| 变量 | 说明 | 必需 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 数据库连接字符串 | ✅ |
| `DEEPSEEK_API_KEY` | DeepSeek AI API 密钥 | ✅ |
| `DEEPSEEK_MODEL` | 使用的 AI 模型名称 | ✅ |
| `DEEPSEEK_BASE_URL` | DeepSeek API 端点 | ✅ |
| `NEXTAUTH_SECRET` | NextAuth 会话加密密钥 | ✅ |
| `NEXTAUTH_URL` | 应用访问 URL | ✅ |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL（限流） | ⬜️ |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis Token | ⬜️ |

---

## 📖 API 端点说明

### 课程管理

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/lesson` | 生成新课程 | ✅ |
| GET | `/api/lessons` | 获取课程列表 | ✅ |
| GET | `/api/lessons/[id]` | 获取单个课程 | ✅ |
| PUT | `/api/lessons/[id]` | 更新课程 | ✅ |
| DELETE | `/api/lessons/[id]` | 删除课程 | ✅ |

### AI 聊天

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/chat` | AI 聊天优化课程 | ✅ |

### 认证

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 用户注册 | ⬜️ |
| POST | `/api/auth/signin` | 用户登录 | ⬜️ |
| POST | `/api/auth/signout` | 用户登出 | ✅ |

### 请求示例

**生成新课程**

```bash
curl -X POST http://localhost:3030/api/lesson \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subject": "Physics",
    "grade": "Grade 9",
    "topic": "Newton'\''s Laws of Motion",
    "duration": 45,
    "objectives": [
      "Understand the three laws of motion",
      "Apply laws to real-world scenarios"
    ]
  }'
```

**AI 聊天优化**

```bash
curl -X POST http://localhost:3030/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "lessonId": "lesson_id_here",
    "message": "Add more interactive activities",
    "chatHistory": []
  }'
```

---

## 🛠️ 开发指南

### 代码规范

- **TypeScript 严格模式** - 启用严格类型检查，避免使用 `any`
- **ESLint** - 遵循项目配置的 ESLint 规则
- **Prettier** - 代码格式化（如已配置）

### 组件开发

- **函数组件优先** - 使用 React Hooks 而非 Class 组件
- **组件拆分** - 保持组件单一职责，避免过大组件
- **Props 类型定义** - 为所有 Props 定义 TypeScript 接口

```typescript
// 示例：函数组件
interface LessonCardProps {
  lesson: Lesson;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function LessonCard({ lesson, onEdit, onDelete }: LessonCardProps) {
  // 组件实现
}
```

### 样式开发

- **Tailwind CSS 优先** - 使用 Tailwind 实用类
- **组件样式** - 使用 `clsx` 或 `cn` 函数合并类名
- **响应式设计** - 使用 Tailwind 断点（sm, md, lg, xl）

```typescript
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-lg bg-primary text-white",
        className
      )}
      {...props}
    />
  );
}
```

### 数据库操作

- **Prisma Client** - 使用 `lib/prisma.ts` 中的单例实例
- **事务处理** - 对于多步骤操作使用 Prisma 事务
- **错误处理** - 捕获并适当处理数据库错误

```typescript
import { prisma } from "@/lib/prisma";

// 使用事务
await prisma.$transaction(async (tx) => {
  const lesson = await tx.lesson.create({ data: lessonData });
  await tx.documentBlock.createMany({ data: blocks });
  return lesson;
});
```

### 测试

```bash
# 运行测试
pnpm test

# 监听模式
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage
```

### 代码检查

```bash
# 运行 ESLint
pnpm lint
```

---

## 🚢 部署说明

### Vercel 部署（推荐）

1. **安装 Vercel CLI**

```bash
npm i -g vercel
```

2. **登录 Vercel**

```bash
vercel login
```

3. **部署到生产环境**

```bash
vercel --prod
```

4. **配置环境变量**

在 Vercel Dashboard 中配置所有必需的环境变量。

### Docker 部署

1. **构建镜像**

```bash
docker build -t steam-lesson-agent .
```

2. **使用 Docker Compose**

```bash
docker compose -f docker-compose.prod.yml up -d
```

3. **查看日志**

```bash
docker compose logs -f app
```

### 环境变量配置

确保在部署环境中正确配置所有环境变量，特别是：
- 生产数据库连接字符串
- 正确的 `NEXTAUTH_URL`
- 安全的 `NEXTAUTH_SECRET`

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 贡献流程

1. **Fork 项目** - 点击 GitHub 页面右上角的 Fork 按钮

2. **克隆仓库**

```bash
git clone https://github.com/your-username/steam-lesson-agent.git
cd steam-lesson-agent
```

3. **创建特性分支**

```bash
git checkout -b feature/your-feature-name
```

4. **提交更改**

```bash
git add .
git commit -m "feat: add your feature description"
```

5. **推送到 GitHub**

```bash
git push origin feature/your-feature-name
```

6. **创建 Pull Request** - 在 GitHub 上创建 PR 并描述你的更改

### Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` - 新功能
- `fix:` - 修复 bug
- `docs:` - 文档更新
- `style:` - 代码格式（不影响功能）
- `refactor:` - 重构（既不是新功能也不是修复）
- `test:` - 添加测试
- `chore:` - 构建过程或辅助工具的变动

### 开发建议

- 确保代码通过 ESLint 检查
- 为新功能添加测试
- 更新相关文档
- 保持 PR 聚焦单一功能

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 📞 联系方式

如有问题或建议，欢迎通过以下方式联系：

- 提交 [Issue](https://github.com/your-username/steam-lesson-agent/issues)
- 发起 [Discussion](https://github.com/your-username/steam-lesson-agent/discussions)

---

<div align="center">

**[⬆ 返回顶部](#steam-lesson-agent)**

Made with ❤️ by the STEAM Lesson Agent Team

</div>
