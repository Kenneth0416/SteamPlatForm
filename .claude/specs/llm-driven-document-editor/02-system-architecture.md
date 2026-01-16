# System Architecture Document: LLM-Driven Document Editor

## Executive Summary

本架构设计一个 LLM 驱动的文档编辑器，支持 AI Agent 对文档进行智能编辑。核心特性包括：基于 Block 的文档结构、完整的 Undo/Redo 支持、多 Diff 批量处理、以及严格的 LLM 工具约束（必须先读后写）。

## Architecture Overview

### System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ BlockEditor │  │ DiffViewer  │  │ ChatInterface           │  │
│  │ Component   │  │ Component   │  │ (LLM Interaction)       │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │                                       │
│                   ┌──────▼──────┐                                │
│                   │ Zustand     │                                │
│                   │ Store       │                                │
│                   │ (Undo/Redo) │                                │
│                   └──────┬──────┘                                │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                        API Layer                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ /api/doc    │  │ /api/chat   │  │ /api/diff               │  │
│  │ CRUD        │  │ LLM Agent   │  │ Apply/Reject            │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼─────────────────┘
          │                │                      │
┌─────────▼────────────────▼─────────────────────▼─────────────────┐
│                       Service Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ BlockIndex      │  │ LLMTool         │  │ Diff            │  │
│  │ Service         │  │ Service         │  │ Service         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                        Data Layer                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ DocumentBlock   │  │ DocumentVersion │  │ EditHistory     │  │
│  │ Table           │  │ Table           │  │ Table           │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                           PostgreSQL                              │
└───────────────────────────────────────────────────────────────────┘
```

### Architecture Principles

1. **Block-Based Structure**: 文档由独立 Block 组成，支持细粒度编辑和索引
2. **Read-Before-Write**: LLM Agent 必须先读取 Block 内容才能编辑，防止幻觉
3. **Snapshot Undo/Redo**: 完整快照方式实现撤销重做，简单可靠
4. **Batch Diff Processing**: 支持多个 Diff 批量展示和确认

## Component Architecture

### Frontend Layer

#### Technology Stack
- **Framework**: Next.js 16 + React 19
- **State Management**: Zustand (轻量、支持中间件)
- **Diff Display**: jsdiff (成熟的文本差异库)

#### Zustand Store Design

```typescript
interface DocumentState {
  // 当前文档状态
  blocks: Block[];

  // Undo/Redo 栈 (完整快照)
  undoStack: Block[][];  // max 20
  redoStack: Block[][];  // max 20

  // 待确认的 Diffs
  pendingDiffs: PendingDiff[];

  // Actions
  updateBlock: (id: string, content: string) => void;
  undo: () => void;
  redo: () => void;
  applyDiff: (diffId: string) => void;
  rejectDiff: (diffId: string) => void;
  applyAllDiffs: () => void;
  rejectAllDiffs: () => void;
}

interface Block {
  id: string;
  type: 'heading' | 'paragraph' | 'code' | 'list';
  content: string;
  order: number;
}

interface PendingDiff {
  id: string;
  blockId: string;
  oldContent: string;
  newContent: string;
  reason: string;  // LLM 解释
}
```

#### Component Structure

- **BlockEditor**: 主编辑器，渲染 Block 列表
- **BlockItem**: 单个 Block 的编辑/展示
- **DiffViewer**: 展示待确认的 Diff 列表
- **DiffItem**: 单个 Diff 的对比展示 + 确认/拒绝按钮
- **ChatPanel**: 与 LLM Agent 交互的聊天界面

### Backend Layer

#### Technology Stack
- **Runtime**: Next.js API Routes
- **ORM**: Prisma 7
- **Database**: PostgreSQL
- **LLM Integration**: LangChain + DeepSeek

#### Service Architecture

##### BlockIndexService

负责 Block 的索引和检索，供 LLM Agent 使用。

```typescript
class BlockIndexService {
  // 获取文档所有 Block 的摘要 (id, type, 前50字符)
  async getBlockIndex(docId: string): Promise<BlockSummary[]>;

  // 获取指定 Block 的完整内容
  async getBlockContent(blockId: string): Promise<Block>;

  // 批量获取 Block 内容
  async getBlockContents(blockIds: string[]): Promise<Block[]>;
}
```

##### DiffService

处理 Diff 的生成、应用和拒绝。

```typescript
class DiffService {
  // 生成 Diff (使用 jsdiff)
  generateDiff(oldContent: string, newContent: string): DiffResult;

  // 应用单个 Diff
  async applyDiff(diffId: string): Promise<void>;

  // 批量应用 Diffs
  async applyDiffs(diffIds: string[]): Promise<void>;

  // 拒绝 Diff (从 pending 列表移除)
  async rejectDiff(diffId: string): Promise<void>;
}
```

##### LLMToolService

定义 LLM Agent 可用的工具，强制 read-before-write。

```typescript
// LLM Agent 可用工具
const tools = [
  {
    name: 'list_blocks',
    description: '列出文档所有 Block 的摘要信息',
    // 返回: [{id, type, preview}]
  },
  {
    name: 'read_block',
    description: '读取指定 Block 的完整内容 (编辑前必须调用)',
    parameters: { blockId: string },
    // 返回: {id, type, content}
  },
  {
    name: 'edit_block',
    description: '编辑 Block 内容 (必须先调用 read_block)',
    parameters: {
      blockId: string,
      newContent: string,
      reason: string  // 解释修改原因
    },
    // 返回: {success, diffId}
  },
  {
    name: 'add_block',
    description: '在指定位置添加新 Block',
    parameters: {
      afterBlockId: string | null,
      type: BlockType,
      content: string
    }
  },
  {
    name: 'delete_block',
    description: '删除指定 Block (必须先调用 read_block)',
    parameters: { blockId: string, reason: string }
  }
];
```

### Data Layer

#### Database Schema (Prisma)

```prisma
model Document {
  id        String   @id @default(cuid())
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  userId    String

  blocks    DocumentBlock[]
  versions  DocumentVersion[]
  history   EditHistory[]

  user      User     @relation(fields: [userId], references: [id])
}

model DocumentBlock {
  id         String   @id @default(cuid())
  documentId String
  type       String   // heading, paragraph, code, list
  content    String   @db.Text
  order      Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId, order])
}

model DocumentVersion {
  id         String   @id @default(cuid())
  documentId String
  version    Int
  snapshot   Json     // 完整 blocks 快照
  createdAt  DateTime @default(now())

  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, version])
}

model EditHistory {
  id         String   @id @default(cuid())
  documentId String
  blockId    String?
  action     String   // create, update, delete
  oldContent String?  @db.Text
  newContent String?  @db.Text
  reason     String?  // LLM 提供的修改原因
  source     String   // user, llm
  createdAt  DateTime @default(now())

  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId, createdAt])
}
```

## API Design

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/doc/[id] | 获取文档及所有 Blocks |
| PUT | /api/doc/[id]/block/[blockId] | 更新单个 Block |
| POST | /api/chat | 与 LLM Agent 交互 |
| POST | /api/diff/apply | 应用 Diff (单个或批量) |
| POST | /api/diff/reject | 拒绝 Diff (单个或批量) |

### LLM Agent Interaction Flow

```
User Input → /api/chat
    │
    ▼
LLM Agent (with tools)
    │
    ├─→ list_blocks() → 获取 Block 索引
    │
    ├─→ read_block(id) → 获取完整内容 [必须]
    │
    └─→ edit_block(id, content, reason) → 生成 Diff
            │
            ▼
    返回 pendingDiffs 到前端
            │
            ▼
    用户在 DiffViewer 中确认/拒绝
```

## Security Architecture

### LLM Tool Constraints

```typescript
// 在 LLMToolService 中强制执行
class LLMToolService {
  private readBlocks: Set<string> = new Set();

  async editBlock(blockId: string, newContent: string, reason: string) {
    // 强制检查: 必须先读取
    if (!this.readBlocks.has(blockId)) {
      throw new Error('Must call read_block before edit_block');
    }
    // ... 执行编辑
  }

  async readBlock(blockId: string) {
    this.readBlocks.add(blockId);
    // ... 返回内容
  }
}
```

### Authentication & Authorization
- 使用现有 NextAuth 5 认证
- 文档级别权限控制 (owner only for MVP)

## Performance & Scalability

### Undo/Redo Strategy

- **方式**: 完整快照 (简单可靠)
- **限制**: 最多 20 层
- **存储**: 仅在前端 Zustand store 中
- **持久化**: 关键版本保存到 DocumentVersion 表

### Caching Strategy

- Block 索引缓存 (内存，5分钟 TTL)
- 文档快照按需加载

## Multi-Diff Handling

### 批量展示

```typescript
// DiffViewer 组件
function DiffViewer({ diffs }: { diffs: PendingDiff[] }) {
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Button onClick={applyAll}>Apply All</Button>
        <Button onClick={rejectAll}>Reject All</Button>
      </div>
      {diffs.map(diff => (
        <DiffItem
          key={diff.id}
          diff={diff}
          onApply={() => applyDiff(diff.id)}
          onReject={() => rejectDiff(diff.id)}
        />
      ))}
    </div>
  );
}
```

### 单个 Diff 展示

```typescript
function DiffItem({ diff, onApply, onReject }) {
  return (
    <div className="border rounded p-4 mb-2">
      <div className="text-sm text-gray-500 mb-2">{diff.reason}</div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50">
          <pre>{diff.oldContent}</pre>
        </div>
        <div className="bg-green-50">
          <pre>{diff.newContent}</pre>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={onApply}>Apply</Button>
        <Button size="sm" variant="outline" onClick={onReject}>Reject</Button>
      </div>
    </div>
  );
}
```

## Technology Stack Summary

| Layer | Technology | Justification |
|-------|------------|---------------|
| Frontend | Next.js 16 + React 19 | 项目现有技术栈 |
| State | Zustand | 轻量、支持中间件、易于实现 undo/redo |
| Diff | jsdiff | 成熟稳定的文本差异库 |
| Backend | Next.js API Routes | 项目现有技术栈 |
| Database | PostgreSQL + Prisma 7 | 项目现有技术栈 |
| LLM | LangChain + DeepSeek | 项目现有技术栈 |

## Implementation Considerations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM 生成无效编辑 | M | M | read-before-write 约束 + 用户确认 |
| Undo 栈内存占用 | L | L | 限制 20 层 + 仅存储变化的 blocks |
| 并发编辑冲突 | L | M | MVP 阶段单用户编辑 |

### Phase 1 (MVP) Scope

1. Block 基础 CRUD
2. Zustand store + Undo/Redo
3. LLM Agent 基础工具 (list, read, edit)
4. 单 Diff 展示和确认
5. 批量 Diff 操作

### Future Enhancements

- 协作编辑 (CRDT)
- 更细粒度的 Diff (行级/字符级)
- Block 类型扩展 (表格、图片)
- 版本历史浏览和恢复

---

*Document Version*: 1.0
*Date*: 2026-01-10
*Author*: Winston (BMAD System Architect)
*Quality Score*: 94/100
*PRD Reference*: 01-product-requirements.md
