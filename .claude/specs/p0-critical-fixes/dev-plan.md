# P0 Critical Fixes - Development Plan

## Overview
修复文档编辑器的三个关键稳定性问题：文档切换竞态条件、离线队列数据丢失和内存泄漏。

## Task Breakdown

### Task 1: 文档切换锁机制
- **ID**: task-1-doc-switch-lock
- **type**: default
- **Description**: 在 editorStore 中添加文档切换锁，使 switchDocument 和 removeDocument 操作事务化，防止并发切换导致的状态不一致
- **File Scope**: stores/editorStore.ts, components/editor/document-tabs.tsx
- **Dependencies**: None
- **Test Command**: npm test -- editorStore --coverage --coverageReporters=text
- **Test Focus**:
  - 并发切换文档时锁机制正确阻塞
  - 切换完成后锁正确释放
  - 删除文档时锁机制生效
  - 锁超时处理（防止死锁）

### Task 2: IndexedDB 离线队列持久化
- **ID**: task-2-indexeddb-queue
- **type**: default
- **Description**: 将离线队列从内存迁移到 IndexedDB 持久化存储，添加 localStorage 数据迁移逻辑，确保页面刷新后队列不丢失
- **File Scope**: lib/autoSaveQueue.ts, hooks/useAutoSave.ts
- **Dependencies**: None
- **Test Command**: npm test -- autoSaveQueue --coverage --coverageReporters=text
- **Test Focus**:
  - IndexedDB 队列写入和读取
  - localStorage 旧数据迁移
  - 页面刷新后队列恢复
  - 离线状态下队列累积
  - 恢复在线后队列批量处理

### Task 3: pendingDiffs 内存泄漏清理
- **ID**: task-3-pendingdiffs-cleanup
- **type**: quick-fix
- **Description**: 在文档删除时清理对应的 pendingDiffs 条目，将 pendingDiffs 改为每文档独立同步，防止内存泄漏
- **File Scope**: stores/editorStore.ts
- **Dependencies**: depends on task-1-doc-switch-lock (共享文档删除事务逻辑)
- **Test Command**: npm test -- editorStore --coverage --coverageReporters=text
- **Test Focus**:
  - 删除文档时 pendingDiffs 正确清理
  - 每文档独立同步不影响其他文档
  - 长时间运行后内存不增长
  - 多文档并发编辑时 pendingDiffs 隔离

## Acceptance Criteria
- [ ] 文档切换时无竞态条件，状态一致性保证
- [ ] 离线队列持久化到 IndexedDB，页面刷新后数据不丢失
- [ ] 删除文档时 pendingDiffs 正确清理，无内存泄漏
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%

## Technical Notes
- **锁机制**: 使用简单的布尔标志 + Promise 队列实现，避免引入复杂的互斥库
- **IndexedDB**: 使用 idb 库简化操作，队列结构保持向后兼容
- **迁移策略**: localStorage → IndexedDB 迁移在首次加载时自动执行，迁移后清理旧数据
- **内存监控**: 建议在开发环境添加 pendingDiffs 大小监控，超过阈值时警告
- **测试隔离**: 每个任务的测试应独立运行，避免共享状态污染
