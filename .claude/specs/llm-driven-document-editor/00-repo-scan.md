# Repository Scan Report: STEAM Lesson Agent v1

## Project Overview

**Type**: Full-stack Web Application (AI-powered STEAM education curriculum generator)
**Purpose**: Help teachers create STEAM lesson plans via AI-driven generation and iterative chat refinement

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, TypeScript, Tailwind CSS 4 |
| UI Components | Radix UI, Lucide Icons |
| State | React hooks (useState, useRef, useCallback) |
| Forms | React Hook Form + Zod validation |
| Markdown | react-markdown, remark-gfm, rehype-raw, Vditor (WYSIWYG) |
| Diagrams | Mermaid.js |
| Backend | Next.js API Routes |
| Database | PostgreSQL via Prisma 7 |
| AI | LangChain + DeepSeek API (OpenAI-compatible) |
| Auth | NextAuth 5 (beta), bcryptjs |
| Testing | Jest + React Testing Library |

## Directory Structure

```
app/
├── api/
│   ├── chat/route.ts          # Chat streaming endpoint
│   ├── apply-change/route.ts  # Document edit endpoint
│   ├── lesson/route.ts        # Lesson generation
│   ├── lessons/[id]/route.ts  # CRUD operations
│   └── auth/                   # Authentication
├── page.tsx                    # Main app entry
└── library/                    # Saved lessons

components/
├── steam-agent/
│   ├── chat-panel.tsx         # Chat UI with streaming
│   ├── lesson-preview.tsx     # Markdown preview/edit
│   └── lesson-requirements-form.tsx
├── markdown-editor.tsx        # Section-based markdown viewer
├── wysiwyg-editor.tsx         # Vditor integration
└── ui/                        # Radix-based components

lib/
├── langchain/
│   ├── index.ts               # LLM client, streaming generators
│   ├── prompts.ts             # System/human prompts
│   └── apply-change-agent.ts  # Edit operation logic
├── api.ts                     # Client-side API helpers
└── auth.ts                    # NextAuth config

types/
├── lesson.ts                  # Core domain types
└── settings.ts                # User preferences
```

## Key Integration Points for LLM-driven Document Editor

### 1. Chat API (`/api/chat/route.ts`)
- SSE streaming via `ReadableStream`
- Chunk format: `data: {"type":"content"|"suggested_change"|"done", "content":"..."}`
- Detects `[NEEDS_CHANGE]` marker to trigger apply-change flow

### 2. Apply-Change API (`/api/apply-change/route.ts`)
- Input: `{ currentLesson, suggestedChange, lang }`
- Output: `{ updatedLesson, summary }`
- Uses `applyChangeWithLLM()` from `lib/langchain/apply-change-agent.ts`

### 3. Apply-Change Agent (`lib/langchain/apply-change-agent.ts`)
**Current Implementation**:
- LLM returns JSON with edit operations: `replace`, `delete`, `insert_after`, `insert_before`
- `applyEdits()` applies operations sequentially with fuzzy matching
- `fuzzyFind()` handles whitespace/markdown normalization

**Edit Operation Types**:
```typescript
type EditOperation =
  | { action: "replace"; old_text: string; new_text: string }
  | { action: "delete"; old_text: string }
  | { action: "insert_after"; anchor: string; new_text: string }
  | { action: "insert_before"; anchor: string; new_text: string }
```

### 4. Chat Panel (`components/steam-agent/chat-panel.tsx`)
- Manages message state with streaming support
- `handleApplyChanges()` calls `/api/apply-change` and updates lesson via `onLessonUpdate`
- Shows "Apply Changes" button when `suggestedChange` is present

### 5. Lesson Preview (`components/steam-agent/lesson-preview.tsx`)
- Toggle between preview (ReactMarkdown) and edit (WysiwygEditor) modes
- `onLessonUpdate` callback propagates changes to parent

### 6. Markdown Editor (`components/markdown-editor.tsx`)
- Parses markdown into collapsible sections by `## ` headers
- Renders mermaid code blocks via `MermaidDiagram` component

## Data Models

### ChatMessage
```typescript
interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  text: string
  suggestedChange?: string
  isThinking?: boolean
  isStreaming?: boolean
}
```

### Lesson (Prisma)
```prisma
model Lesson {
  id           String   @id @default(cuid())
  userId       String
  title        String
  lessonPlan   Json     // Markdown content
  requirements Json
  chatHistory  Json     @default("[]")
  tags         String[]
  isFavorite   Boolean
  isArchived   Boolean
}
```

## Conventions to Follow

1. **API Routes**: Use Next.js App Router conventions (`route.ts` exports)
2. **Streaming**: SSE format with `data: JSON\n\n` chunks, `[DONE]` terminator
3. **LangChain**: Use `ChatOpenAI` with DeepSeek config, `ChatPromptTemplate` for prompts
4. **Components**: Functional components with TypeScript, Tailwind for styling
5. **State**: Lift state to page level, pass via props
6. **i18n**: Support `en`/`zh` via `lang` parameter throughout

## Constraints & Considerations

1. **Document Size**: Max 50,000 chars for lesson, 10,000 chars for change request
2. **Edit Reliability**: Fuzzy matching may fail on ambiguous anchors
3. **No Block IDs**: Current markdown has no unique identifiers for sections
4. **Single-turn Apply**: Current flow is single-turn (chat suggests, user clicks apply)
5. **No Diff Preview**: Changes applied directly without showing diff

## Potential Enhancement Areas for Route B

1. **Multi-turn Search/Read**: LLM iteratively searches document sections before proposing edits
2. **Block-based Addressing**: Add unique IDs to markdown sections for precise targeting
3. **Streaming Edits**: Stream edit operations as they're generated
4. **Diff Preview**: Show proposed changes before applying
5. **Undo/Redo**: Track edit history for rollback

---
*Generated: 2026-01-10*
