# Export DOCX Multi-Document Compatibility - Development Plan

## Overview
优化导出 DOCX 模块以支持多文档编辑器，使用当前活动文档而非传统的 currentLesson prop，并使用文档名称作为文件名。

## Task Breakdown

### Task 1: Update Word Export Function
- **ID**: task-1
- **type**: quick-fix
- **Description**: 修改 `runWordExport()` 函数以使用 `getActiveDocument()` 获取当前活动文档内容和名称，替代 `currentLesson` prop。如果没有活动文档，回退到 `currentLesson` 以保持向后兼容性。使用文档名称作为导出文件名，而非从 H1 标题推断。
- **File Scope**: `components/steam-agent/bottom-action-bar.tsx` (lines 85-108)
- **Dependencies**: None
- **Test Command**: `pnpm test -- --testPathPattern="bottom-action-bar" --coverage --coveragePathIgnorePatterns="node_modules"`
- **Test Focus**:
  - 有活动文档时使用文档内容和名称
  - 无活动文档时回退到 currentLesson
  - 文件名正确使用文档名称
  - 保持现有错误处理逻辑

### Task 2: Update PDF Export Function
- **ID**: task-2
- **type**: quick-fix
- **Description**: 修改 `runPdfExport()` 函数以使用 `getActiveDocument()` 获取当前活动文档内容和名称，保持与 Word 导出的一致性。如果没有活动文档，回退到 `currentLesson`。使用文档名称作为导出文件名。
- **File Scope**: `components/steam-agent/bottom-action-bar.tsx` (lines 60-83)
- **Dependencies**: None
- **Test Command**: `pnpm test -- --testPathPattern="bottom-action-bar" --coverage --coveragePathIgnorePatterns="node_modules"`
- **Test Focus**:
  - 有活动文档时使用文档内容和名称
  - 无活动文档时回退到 currentLesson
  - 文件名正确使用文档名称
  - 保持现有错误处理逻辑

## Acceptance Criteria
- [ ] Word 导出使用活动文档内容和名称（如果存在）
- [ ] PDF 导出使用活动文档内容和名称（如果存在）
- [ ] 无活动文档时回退到 currentLesson prop（向后兼容）
- [ ] 导出文件名使用文档名称而非从 H1 推断
- [ ] 保持现有的错误处理和加载状态逻辑
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%

## Technical Notes
- **Store Method**: 使用 `useEditorStore` 的 `getActiveDocument()` 方法获取活动文档
- **Document Structure**: `EditorDocument` 包含 `id`, `name`, `content`, `blocks`, `isDirty`, `createdAt`
- **Backward Compatibility**: 当 `getActiveDocument()` 返回 `null` 时，使用现有的 `currentLesson` prop 和 `inferLessonTitle()` 逻辑
- **Filename Strategy**: 优先使用 `document.name`，回退时使用 `inferLessonTitle(currentLesson)`
- **Minimal Changes**: 仅修改导出函数内部逻辑，不改变组件 props 或 API 调用
- **No API Changes**: 导出 API (`exportLessonWord`, `exportLessonPdf`) 保持不变，仅传入的内容来源改变
