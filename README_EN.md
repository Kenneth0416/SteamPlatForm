# STEAM Lesson Agent

[中文](./README.md) | **English**

<div align="center">

![Version](https://img.shields.io/badge/version-v1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-20.x-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)

**AI-Powered STEAM Lesson Planning Platform**

[Features](#-core-features) • [Architecture](#-system-architecture) • [Quick Start](#-quick-start) • [Documentation](#-api-endpoints)

</div>

---

## Introduction

**STEAM Lesson Agent** is an intelligent lesson planning platform powered by AI technology, designed specifically for educators. By integrating DeepSeek AI and the LangChain framework, the platform can rapidly generate professional STEAM (Science, Technology, Engineering, Arts, Mathematics) lesson plans, significantly improving teachers' preparation efficiency.

### Core Value

- Rapid Generation: Create professional lesson plans in minutes
- Smart Optimization: AI-driven content optimization and conversational interaction
- Complete Management: Full workflow support from lesson creation to version control

---

## ✨ Core Features

- 🤖 **AI-Powered Lesson Generation** - Intelligent lesson planning based on DeepSeek + LangChain
- 📝 **Multi-Document Editor** - Support for multiple document types including Lesson Plan, Guide, and Worksheet
- 🔄 **Version Control & History Tracking** - Complete document version management and edit history
- 💬 **Smart Chat Optimization** - Optimize lesson content through conversational interaction
- 🔐 **Complete Authentication System** - Secure authentication mechanism based on NextAuth 5
- 📚 **Lesson Library Management** - Support for favorites, archiving, tag categorization, and more
- 📊 **Admin Dashboard** - User and lesson data management

---

## 🏗️ Technology Stack

### Frontend Technologies
- **Next.js 16** - React server-side rendering framework
- **React 19** - User interface library
- **TypeScript 5** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework

### Backend Technologies
- **Next.js API Routes** - Server-side API endpoints
- **Prisma 7** - Modern ORM framework
- **PostgreSQL** - Relational database

### AI Technologies
- **LangChain** - AI application development framework
- **DeepSeek API** - Large language model service

### Authentication & UI
- **NextAuth 5** - Authentication solution
- **Radix UI** - Accessible UI component library
- **React Hook Form** - Form management
- **Zod** - Schema validation

---

## 📐 System Architecture

### System Layer Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React 19 UI Components]
        Pages[Next.js 16 Pages]
    end

    subgraph "Business Logic Layer"
        Auth[NextAuth 5 Authentication]
        API[API Routes]
        LangChain[LangChain Agent]
    end

    subgraph "Data Layer"
        Prisma[Prisma 7 ORM]
        DB[(PostgreSQL)]
    end

    subgraph "External Services"
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

### Data Model ER Diagram

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

### AI Lesson Generation Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as API Routes
    participant LangChain
    participant DeepSeek as DeepSeek API
    participant DB as PostgreSQL

    User->>Frontend: Input lesson requirements
    Frontend->>API: POST /api/lesson
    API->>LangChain: Create Agent
    LangChain->>DeepSeek: Call AI model
    DeepSeek-->>LangChain: Return lesson content
    LangChain-->>API: Structured lesson plan
    API->>DB: Save Lesson
    API->>DB: Create DocumentBlocks
    API->>DB: Record EditHistory
    API-->>Frontend: Return lesson data
    Frontend-->>User: Display lesson
```

### d) **AI Agent Architecture Deep Dive**

**1. Three AI Agents Collaboration Architecture**

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[Frontend UI]
    end

    subgraph "AI Agent Layer"
        LessonAgent[Lesson Generation Agent<br/>generateLesson]
        ChatAgent[Chat Optimization Agent<br/>chatWithLesson]
        ApplyAgent[Change Application Agent<br/>applyChangeWithLLM]
    end

    subgraph "LangChain Core"
        Prompt[Prompt Template]
        LLM[DeepSeek LLM]
        Parser[Output Parser]
    end

    subgraph "Data Storage"
        DB[(PostgreSQL)]
    end

    UI -->|1. Submit Requirements| LessonAgent
    LessonAgent --> Prompt
    Prompt --> LLM
    LLM --> Parser
    Parser -->|Generate Lesson| DB
    DB -->|2. Load Lesson| UI

    UI -->|3. Send Optimization Request| ChatAgent
    ChatAgent --> Prompt
    Prompt --> LLM
    LLM --> Parser
    Parser -->|Suggest Changes| UI

    UI -->|4. Apply Changes| ApplyAgent
    ApplyAgent --> Prompt
    Prompt --> LLM
    LLM -->|JSON Edit Operations| ApplyAgent
    ApplyAgent -->|5. Update Lesson| DB

    style LessonAgent fill:#e1f5ff
    style ChatAgent fill:#fff4e1
    style ApplyAgent fill:#e8f5e9
```

**2. Editor Agent - LLM-Driven Document Editor (Core Innovation)**

This is the system's true core: an intelligent document editing Agent based on LangChain Tool Calling, enabling precise document operations through natural language instructions.

### Architecture Overview

```mermaid
graph TB
    User[User Natural Language Command] --> AgentLoop[Editor Agent Loop<br/>Max 30 iterations]

    AgentLoop --> SystemPrompt[System Prompt<br/>Define efficiency rules & workflow]
    SystemPrompt --> LLM[DeepSeek LLM<br/>temperature: 0.2]

    LLM --> Decision{Need to<br/>call tools?}

    Decision -->|Yes| ToolDispatch[Tool Dispatcher]
    Decision -->|No| Response[Return Final Response]

    ToolDispatch --> Tools[Five Core Tools]

    subgraph Tools[Five Core Tools]
        ListBlocks[list_blocks<br/>List document structure]
        ReadBlocks[read_blocks<br/>Batch read content]
        EditBlocks[edit_blocks<br/>Batch edit content]
        AddBlock[add_block<br/>Add new block]
        DeleteBlock[delete_block<br/>Delete block]
    end

    ListBlocks --> BlockIndex[BlockIndexService<br/>Document Index]
    ReadBlocks --> BlockIndex
    EditBlocks --> PendingDiffs[Pending Diffs<br/>Confirmation Queue]
    AddBlock --> PendingDiffs
    DeleteBlock --> PendingDiffs

    BlockIndex --> Guard[ReadWriteGuard<br/>Access Control]
    PendingDiffs --> Guard

    Guard --> ToolResult[Tool Execution Result]
    ToolResult --> ToolTrace[ToolTrace<br/>Call History Tracking]

    ToolTrace --> StuckDetector{Detect<br/>stuck loop?}
    StuckDetector -->|Normal| AgentLoop
    StuckDetector -->|Stuck| EarlyExit[Early Exit]

    PendingDiffs --> UserConfirm[User Confirms Changes]
    UserConfirm --> ApplyToDb[(Apply to Database)]

    style LLM fill:#c5e1a5
    style Tools fill:#e1f5ff
    style PendingDiffs fill:#fff4e1
    style Guard fill:#ffcdd2
    style StuckDetector fill:#ce93d8
```

### Workflow Deep Dive

```mermaid
sequenceDiagram
    participant U as User
    participant A as Editor Agent
    participant LLM as DeepSeek LLM
    participant T as Tool System
    participant D as Pending Diffs
    participant DB as Database

    U->>A: "Add group discussion after section 2"
    A->>LLM: System Prompt + User Message

    Note over LLM: Plan operations<br/>list → read → edit

    LLM->>T: tool_call: list_blocks()
    T->>T: BlockIndexService.getBlockIndex()
    T-->>LLM: Return structure + previews

    LLM->>T: tool_call: read_blocks([block_3, block_4])
    T->>T: Batch read specified blocks
    T-->>LLM: Return full content

    Note over LLM: Analyze content<br/>Generate edit plan

    LLM->>T: tool_call: add_block(afterBlockId: "block_3", ...)
    T->>D: Create PendingDiff
    D-->>T: diff_id: "diff-123"
    T-->>LLM: "Pending change created"

    LLM-->>A: Final response (no more tool_calls)
    A-->>U: "Group discussion added (pending confirmation)"

    U->>D: Click "Apply Changes"
    D->>DB: Execute diff
    DB-->>U: Update successful
```

### Five Core Tools

| Tool | Function | Batch Support | Permission Protection |
|------|----------|--------------|---------------------|
| **list_blocks** | List document structure & content previews | N/A | Mark as read |
| **read_blocks** | Batch read block content (with context) | ✅ Max 25 | ReadWriteGuard |
| **edit_blocks** | Batch edit block content | ✅ Max 25 | Must read first |
| **add_block** | Add new block after specified position | Single | Non-empty validation |
| **delete_block** | Delete specified block | Single | Must read first |

### Key Innovation Mechanisms

#### 1. **Pending Diffs Mechanism**
All edit operations first generate `PendingDiff` objects, applied to database only after user confirmation:
- **Safety**: Prevents LLM from directly modifying data by mistake
- **Traceability**: Complete change history recording (EditHistory table)
- **Reversibility**: Users can reject AI-suggested changes

```typescript
interface PendingDiff {
  id: string           // diff-timestamp-random
  blockId: string      // Target block ID
  action: 'update' | 'add' | 'delete'
  oldContent: string   // Original content
  newContent: string   // New content
  reason: string       // LLM-provided modification reason
}
```

#### 2. **ReadWriteGuard (Read-Write Protection)**
Prevents LLM "write-before-read" error patterns:
- **Rule**: Must call `read_blocks` before edit/delete
- **Detection**: `guard.canEdit(blockId)` returns `{allowed: false, error: "..."}`
- **Purpose**: Forces Agent to understand content before modification

#### 3. **Efficiency Rules (System Prompt Enforced)**
- Maximum 3-step workflow: `list_blocks` → `read_blocks` → `edit_blocks`
- Batch operations preferred: Process multiple blocks in one call
- Read-only queries in 2 steps: `list_blocks` → answer directly (skip unnecessary reads)

#### 4. **Stuck Detection Mechanism**
Detects three loop patterns:
- 3 consecutive `list_blocks` calls
- 3 consecutive `read_blocks` calls with identical parameters
- 10 consecutive calls without any edit operations

**Trigger mechanism**:
```typescript
detectStuck(toolTrace) → {
  isStuck: true,
  reason: "list_blocks called 3 times consecutively"
}
```

#### 5. **Multi-Document Support**
Two additional tools for multi-document editing:
- `list_documents` - List all open documents
- `switch_document(docId)` - Switch active document
- Auto-reset BlockIndex and Guard after switching

### Technical Architecture Highlights

1. **LangChain Tool Calling**: Native support for OpenAI-style function calling
2. **Streaming Output**: `runEditorAgentStream()` returns tool calls and content in real-time
3. **Context Management**: `BlockIndexService` provides efficient block indexing and search
4. **State Tracking**: `ToolTrace` ring buffer records last 30 calls
5. **Error Recovery**: Tool execution failures don't interrupt loop, return error info to LLM for retry

### Implementation Files

- **lib/editor/agent.ts** - Agent main loop and streaming output
- **lib/editor/tools/index.ts** - Five core tools implementation
- **lib/editor/tools/document-tools.ts** - Multi-document tools
- **lib/editor/agent/runtime.ts** - ToolTrace and detectStuck
- **lib/editor/block-index.ts** - BlockIndexService
- **lib/editor/tools/middleware.ts** - ReadWriteGuard

**3. Apply Change Agent Edit Operation Flow**

```mermaid
stateDiagram-v2
    [*] --> ReceiveChangeRequest
    ReceiveChangeRequest --> InvokeLLM: Receive Change Request
    InvokeLLM --> ParseJSON: Invoke LLM Generate Edit Ops

    ParseJSON --> ValidateAction: Parse JSON Instructions

    ValidateAction --> Replace: action=replace
    ValidateAction --> Delete: action=delete
    ValidateAction --> InsertAfter: action=insert_after
    ValidateAction --> InsertBefore: action=insert_before

    Replace --> FuzzyMatchOld: Fuzzy Match old_text
    Delete --> FuzzyMatchOld
    InsertAfter --> FuzzyMatchAnchor: Fuzzy Match anchor
    InsertBefore --> FuzzyMatchAnchor

    FuzzyMatchOld --> ExecuteReplace: Execute Replacement
    FuzzyMatchAnchor --> ExecuteInsert: Execute Insertion

    ExecuteReplace --> ReturnDocument: Return Updated Document
    ExecuteInsert --> ReturnDocument

    ReturnDocument --> [*]

    note right of FuzzyMatchOld
        Smart Matching:
        - Ignore markdown markers
        - Ignore whitespace diffs
        - Sliding window scan
    end note
```

---

## 🚀 Quick Start

### Requirements

- Node.js 20.x
- pnpm 10.28.1+
- PostgreSQL 14+
- Docker (optional)

### Installation Steps

1. **Clone the repository**

```bash
git clone https://github.com/your-username/steam-lesson-agent.git
cd SteamPlatForm-main
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Start the database**

```bash
docker compose up -d
```

4. **Configure environment variables**

```bash
cp .env.example .env
```

Edit the `.env` file and fill in the necessary configuration information.

5. **Initialize the database**

```bash
npx prisma migrate dev
npx prisma generate
```

6. **Start the development server**

```bash
pnpm dev
```

7. **Access the application**

Open [http://localhost:3030](http://localhost:3030) in your browser

---

## 📁 Project Structure

```
SteamPlatForm-main/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   ├── lesson/        # Lesson generation
│   │   ├── chat/          # Chat optimization
│   │   ├── lessons/       # Lesson CRUD
│   │   └── auth/          # Authentication
│   ├── auth/              # Authentication pages
│   ├── admin/             # Admin dashboard
│   └── library/           # Lesson library
│
├── components/            # React components
│   ├── steam-agent/       # Core feature components
│   ├── ui/                # Base UI components (Radix UI)
│   └── layout/            # Layout components
│
├── lib/                   # Business logic
│   ├── langchain/         # AI integration
│   │   ├── index.ts       # LangChain Agent core
│   │   └── prompts.ts     # AI prompt templates
│   ├── api.ts             # Client-side API wrapper
│   ├── auth.ts            # NextAuth configuration
│   └── prisma.ts          # Prisma client
│
├── prisma/                # Database
│   └── schema.prisma      # Data model definition
│
├── types/                 # TypeScript type definitions
│
├── docker-compose.yml     # Docker configuration
├── next.config.mjs        # Next.js configuration
└── package.json           # Project dependencies
```

---

## 🔑 Environment Variables Configuration

Create a `.env` file and configure the following variables:

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

### Environment Variables Explanation

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL database connection string | ✅ |
| `DEEPSEEK_API_KEY` | DeepSeek AI API key | ✅ |
| `DEEPSEEK_MODEL` | AI model name to use | ✅ |
| `DEEPSEEK_BASE_URL` | DeepSeek API endpoint | ✅ |
| `NEXTAUTH_SECRET` | NextAuth session encryption key | ✅ |
| `NEXTAUTH_URL` | Application access URL | ✅ |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (rate limiting) | ⬜️ |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis Token | ⬜️ |

---

## 📖 API Endpoints

### Lesson Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/lesson` | Generate new lesson | ✅ |
| GET | `/api/lessons` | Get lesson list | ✅ |
| GET | `/api/lessons/[id]` | Get single lesson | ✅ |
| PUT | `/api/lessons/[id]` | Update lesson | ✅ |
| DELETE | `/api/lessons/[id]` | Delete lesson | ✅ |

### AI Chat

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/chat` | AI chat lesson optimization | ✅ |

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | User registration | ⬜️ |
| POST | `/api/auth/signin` | User login | ⬜️ |
| POST | `/api/auth/signout` | User logout | ✅ |

### Request Examples

**Generate New Lesson**

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

**AI Chat Optimization**

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

## 🛠️ Development Guide

### Code Standards

- **TypeScript Strict Mode** - Enable strict type checking, avoid using `any`
- **ESLint** - Follow project-configured ESLint rules
- **Prettier** - Code formatting (if configured)

### Component Development

- **Function Components First** - Use React Hooks instead of Class components
- **Component Separation** - Keep components single-responsibility, avoid oversized components
- **Props Type Definition** - Define TypeScript interfaces for all Props

```typescript
// Example: Function component
interface LessonCardProps {
  lesson: Lesson;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function LessonCard({ lesson, onEdit, onDelete }: LessonCardProps) {
  // Component implementation
}
```

### Style Development

- **Tailwind CSS First** - Use Tailwind utility classes
- **Component Styles** - Use `clsx` or `cn` function to merge class names
- **Responsive Design** - Use Tailwind breakpoints (sm, md, lg, xl)

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

### Database Operations

- **Prisma Client** - Use the singleton instance from `lib/prisma.ts`
- **Transaction Handling** - Use Prisma transactions for multi-step operations
- **Error Handling** - Catch and properly handle database errors

```typescript
import { prisma } from "@/lib/prisma";

// Using transactions
await prisma.$transaction(async (tx) => {
  const lesson = await tx.lesson.create({ data: lessonData });
  await tx.documentBlock.createMany({ data: blocks });
  return lesson;
});
```

### Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

### Code Linting

```bash
# Run ESLint
pnpm lint
```

---

## 🚢 Deployment Guide

### Vercel Deployment (Recommended)

1. **Install Vercel CLI**

```bash
npm i -g vercel
```

2. **Login to Vercel**

```bash
vercel login
```

3. **Deploy to production**

```bash
vercel --prod
```

4. **Configure environment variables**

Configure all required environment variables in the Vercel Dashboard.

### Docker Deployment

1. **Build the image**

```bash
docker build -t steam-lesson-agent .
```

2. **Use Docker Compose**

```bash
docker compose -f docker-compose.prod.yml up -d
```

3. **View logs**

```bash
docker compose logs -f app
```

### Environment Variables Configuration

Ensure all environment variables are properly configured in the deployment environment, especially:
- Production database connection string
- Correct `NEXTAUTH_URL`
- Secure `NEXTAUTH_SECRET`

---

## 🤝 Contributing

We welcome all forms of contributions!

### Contribution Workflow

1. **Fork the project** - Click the Fork button in the upper right corner of the GitHub page

2. **Clone the repository**

```bash
git clone https://github.com/your-username/steam-lesson-agent.git
cd steam-lesson-agent
```

3. **Create a feature branch**

```bash
git checkout -b feature/your-feature-name
```

4. **Commit changes**

```bash
git add .
git commit -m "feat: add your feature description"
```

5. **Push to GitHub**

```bash
git push origin feature/your-feature-name
```

6. **Create a Pull Request** - Create a PR on GitHub and describe your changes

### Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation update
- `style:` - Code formatting (no functional impact)
- `refactor:` - Refactoring (neither new feature nor bug fix)
- `test:` - Add tests
- `chore:` - Build process or auxiliary tool changes

### Development Recommendations

- Ensure code passes ESLint checks
- Add tests for new features
- Update relevant documentation
- Keep PRs focused on a single feature

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 📞 Contact

If you have questions or suggestions, feel free to contact us through:

- Submit an [Issue](https://github.com/your-username/steam-lesson-agent/issues)
- Start a [Discussion](https://github.com/your-username/steam-lesson-agent/discussions)

---

<div align="center">

**[⬆ Back to Top](#steam-lesson-agent)**

Made with ❤️ by the STEAM Lesson Agent Team

</div>
