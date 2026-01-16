# Diff Preview Highlight - Development Plan

## Overview
在课程预览区显示 diff 高亮，红色=删除，绿色=新增。AI 回复完成后自动显示。

## Task Breakdown

### Task 1: State Management - Pass diffs from ChatPanel to LessonPreview
- **ID**: task-1-state
- **Type**: default
- **File Scope**: `app/page.tsx`
- **Dependencies**: none
- **Description**:
  1. Add `pendingDiffs` state to page.tsx
  2. Pass `onDiffsChange` callback to ChatPanel
  3. Pass `pendingDiffs` prop to LessonPreview
- **Test Command**: `pnpm test -- --testPathPattern="page" --passWithNoTests`

### Task 2: ChatPanel - Emit diffs when AI response completes
- **ID**: task-2-chat
- **Type**: default
- **File Scope**: `components/steam-agent/chat-panel.tsx`
- **Dependencies**: task-1-state
- **Description**:
  1. Add `onDiffsChange?: (diffs: PendingDiff[]) => void` prop
  2. Call `onDiffsChange` when message with diffs is received (in handleSend done handler)
  3. Clear diffs when user sends new message
- **Test Command**: `pnpm test -- --testPathPattern="chat-panel" --passWithNoTests`

### Task 3: LessonPreview - Accept and display diffs with highlight
- **ID**: task-3-preview
- **Type**: ui
- **File Scope**: `components/steam-agent/lesson-preview.tsx`, `components/markdown-editor.tsx`
- **Dependencies**: task-1-state
- **Description**:
  1. Add `pendingDiffs?: PendingDiff[]` prop to LessonPreview
  2. Pass diffs to MarkdownEditor
  3. In MarkdownEditor, when diffs exist, render with inline diff highlighting
  4. Use existing `generateWordDiff` from `lib/editor/diff.ts`
  5. Style: green bg for additions, red bg + strikethrough for deletions
- **Test Command**: `pnpm test -- --testPathPattern="lesson-preview|markdown-editor" --passWithNoTests`

## Technical Notes
- Reuse existing `DiffItem.tsx` styling patterns (bg-green-100, bg-red-100, etc.)
- Reuse `generateWordDiff` from `lib/editor/diff.ts`
- PendingDiff type already defined in `lib/editor/types.ts`
