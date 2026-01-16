# Auto-Save P0 - Development Plan

## Overview
实现带故障恢复的自动保存机制，支持 5 秒防抖和网络恢复时重试。

## Task Breakdown

### Task 1: Create localStorage-backed save queue
- **ID**: task-1-save-queue
- **type**: default
- **Description**: 创建 `lib/autoSaveQueue.ts`，实现基于 localStorage 的失败保存队列。包含入队失败操作、成功时出队、监听 `online` 事件自动重放功能。
- **File Scope**: `lib/autoSaveQueue.ts` (new file)
- **Dependencies**: None
- **Test Command**: `pnpm test --testPathPattern="autoSaveQueue" --coverage --coveragePathIgnorePatterns="/node_modules/" --collectCoverageFrom="lib/autoSaveQueue.ts"`
- **Test Focus**:
  - 入队/出队操作正确性
  - localStorage 持久化和恢复
  - 网络恢复时自动重试逻辑
  - 边界情况：空队列、localStorage 满、无效数据

### Task 2: Implement useAutoSave hook
- **ID**: task-2-auto-save-hook
- **type**: default
- **Description**: 创建 `hooks/useAutoSave.ts` hook，实现 5 秒防抖自动保存。监听 lesson markdown 和 dirty documents，跳过 streaming/isSaving 状态，调用 saveLesson 和 updateDocument，静默处理错误（仅显示错误 toast），集成 save queue 处理失败。
- **File Scope**: `hooks/useAutoSave.ts` (new file)
- **Dependencies**: depends on task-1-save-queue
- **Test Command**: `pnpm test --testPathPattern="useAutoSave" --coverage --coveragePathIgnorePatterns="/node_modules/" --collectCoverageFrom="hooks/useAutoSave.ts"`
- **Test Focus**:
  - 5 秒防抖正确触发
  - streaming/isSaving 时跳过保存
  - 成功保存后清除 dirty 标记
  - 失败时入队并显示错误 toast
  - 多文档并发保存处理

### Task 3: Add store helper for marking docs clean
- **ID**: task-3-store-helper
- **type**: quick-fix
- **Description**: 在 `stores/editorStore.ts` 添加 `markDocumentsClean(docIds: string[])` action，用于批量设置指定文档的 `isDirty: false`。
- **File Scope**: `stores/editorStore.ts`
- **Dependencies**: None
- **Test Command**: `pnpm test --testPathPattern="editorStore|store" --coverage --coveragePathIgnorePatterns="/node_modules/" --collectCoverageFrom="stores/editorStore.ts"`
- **Test Focus**:
  - 正确更新指定文档的 isDirty 状态
  - 不影响其他文档
  - 空数组和不存在的 docId 处理

### Task 4: Integrate hook into pages
- **ID**: task-4-integrate-pages
- **type**: default
- **Description**: 将 `useAutoSave` hook 集成到 `app/page.tsx` 和 `app/editor/[lessonId]/page.tsx`。传递必需参数（currentLesson, currentRequirements, currentLessonId, streamingDocId）。确保 bottom-action-bar 的手动保存不与自动保存冲突。
- **File Scope**: `app/page.tsx`, `app/editor/[lessonId]/page.tsx`
- **Dependencies**: depends on task-2-auto-save-hook, depends on task-3-store-helper
- **Test Command**: `pnpm test --testPathPattern="page" --coverage --coveragePathIgnorePatterns="/node_modules/" --collectCoverageFrom="app/**/*.tsx"`
- **Test Focus**:
  - hook 正确初始化和传参
  - 手动保存与自动保存互不干扰
  - 页面卸载时清理定时器
  - 不同页面场景下的保存行为

## Acceptance Criteria
- [ ] 编辑内容 5 秒后自动保存
- [ ] 保存失败时缓存到 localStorage
- [ ] 网络恢复时自动重试失败的保存
- [ ] streaming 和 isSaving 状态下跳过自动保存
- [ ] 手动保存与自动保存无冲突
- [ ] 仅在保存失败时显示错误 toast，成功时静默
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%

## Technical Notes
- 使用 `lodash.debounce` 或自定义 debounce 实现 5 秒延迟
- localStorage key 使用 `steam-lesson-save-queue` 避免冲突
- 保存队列数据结构：`{ lessonId, type: 'lesson'|'document', payload, timestamp }`
- 监听 `window.addEventListener('online', ...)` 触发重试
- 使用 `useEffect` cleanup 清理 debounce 定时器和事件监听器
- 考虑 Zustand store 的 `isDirty` 标记作为保存触发条件
- 手动保存时应立即取消 pending 的 debounce 并执行保存
