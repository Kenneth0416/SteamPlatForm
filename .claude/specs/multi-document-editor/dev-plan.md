# Multi-Document Editor (方案 A) Development Plan

## Overview
Implement multi-document editing with context switching for the Editor Agent.

## Requirements
- DocumentManager class for managing multiple documents
- New tools: list_documents, switch_document
- Extended ToolContext for multi-document operations
- Frontend DocumentTabs UI with dynamic add/remove
- Zustand store for multi-document state
- Database persistence (Prisma)
- PendingDiff with docId field
- Unit tests ≥90% coverage

## Task Breakdown

### Task 1: Core Types & DocumentManager
- **ID**: task-1-core
- **Type**: default
- **Dependencies**: none
- **File Scope**:
  - `lib/editor/types.ts` - extend with Document, MultiDocState types
  - `lib/editor/document-manager.ts` - new DocumentManager class
  - `__tests__/editor/document-manager.test.ts` - unit tests
- **Test Command**: `pnpm test __tests__/editor/document-manager.test.ts`
- **Deliverables**:
  ```typescript
  // types.ts additions
  interface Document {
    id: string
    name: string
    type: 'lesson' | 'guide' | 'worksheet' | 'custom'
    content: string
    blocks: Block[]
    isDirty: boolean
    createdAt: Date
  }

  // document-manager.ts
  class DocumentManager {
    constructor(documents: Document[], activeDocId: string)
    getAllDocuments(): Document[]
    getDocument(docId: string): Document | null
    getActiveDocument(): Document | null
    getActiveDocId(): string
    setActiveDocument(docId: string): void
    addDocument(doc: Omit<Document, 'id' | 'blocks'>): string
    removeDocument(docId: string): void
    updateDocumentBlocks(docId: string, blocks: Block[]): void
  }
  ```

### Task 2: Document Tools
- **ID**: task-2-tools
- **Type**: default
- **Dependencies**: task-1-core
- **File Scope**:
  - `lib/editor/tools/document-tools.ts` - list_documents, switch_document
  - `lib/editor/tools/index.ts` - extend createEditorTools
  - `__tests__/editor/document-tools.test.ts` - unit tests
- **Test Command**: `pnpm test __tests__/editor/document-tools.test.ts`
- **Deliverables**:
  ```typescript
  // document-tools.ts
  createListDocumentsTool(ctx: MultiDocToolContext)
  createSwitchDocumentTool(ctx: MultiDocToolContext)

  // index.ts - extend ToolContext
  interface MultiDocToolContext extends ToolContext {
    documentManager: DocumentManager
  }
  ```

### Task 3: Agent Integration
- **ID**: task-3-agent
- **Type**: default
- **Dependencies**: task-2-tools
- **File Scope**:
  - `lib/editor/agent.ts` - update runEditorAgentStream for multi-doc
  - `lib/editor/types.ts` - extend PendingDiff with docId
- **Test Command**: `pnpm test __tests__/editor/`
- **Deliverables**:
  - Update SYSTEM_PROMPT for multi-document workflow
  - Modify runEditorAgentStream to accept Document[] and activeDocId
  - PendingDiff includes docId field
  - pendingDiffsByDoc Map for per-document diffs

### Task 4: Database Schema & API
- **ID**: task-4-database
- **Type**: default
- **Dependencies**: task-1-core
- **File Scope**:
  - `prisma/schema.prisma` - EditorDocument model
  - `app/api/editor/documents/route.ts` - CRUD endpoints
  - `lib/editor/api.ts` - client API functions
- **Test Command**: `pnpm test __tests__/api/editor-documents.test.ts`
- **Deliverables**:
  ```prisma
  model EditorDocument {
    id        String   @id @default(cuid())
    name      String
    type      String   @default("custom")
    content   String   @db.Text
    lessonId  String?
    userId    String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    lesson    Lesson?  @relation(fields: [lessonId], references: [id])
    user      User     @relation(fields: [userId], references: [id])
  }
  ```
  - GET /api/editor/documents - list user's documents
  - POST /api/editor/documents - create document
  - PUT /api/editor/documents/[id] - update document
  - DELETE /api/editor/documents/[id] - delete document

### Task 5: Frontend UI
- **ID**: task-5-ui
- **Type**: ui
- **Dependencies**: task-3-agent, task-4-database
- **File Scope**:
  - `stores/multi-doc-store.ts` - Zustand store
  - `components/editor/document-tabs.tsx` - tab UI component
  - `app/editor/page.tsx` - integrate multi-doc editor
- **Test Command**: `pnpm test __tests__/components/document-tabs.test.tsx`
- **Deliverables**:
  - MultiDocStore with documents Map, activeDocId, CRUD actions
  - DocumentTabs component with add/remove/switch functionality
  - Integration with existing MarkdownEditor and ChatPanel

## Architecture Decisions
1. **Context Switching**: Agent operates on one document at a time via switch_document
2. **Isolated Diffs**: PendingDiffs stored per-document in Map<docId, PendingDiff[]>
3. **Lazy Loading**: Documents loaded on-demand, blocks parsed when switched to
4. **Optimistic UI**: Frontend updates immediately, syncs with backend async

## UI Determination
- needs_ui: true
- evidence: Task 5 creates DocumentTabs component (.tsx), integrates with Zustand store
