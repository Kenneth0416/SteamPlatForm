# 文档流式显示修复 - 开发计划

## 概述
修复主页新文档流式生成时内容一次性加载的问题，使文档在生成过程中能够实时流式显示内容。

## 任务分解

### Task 1: 解耦页面流式状态
- **ID**: task-1
- **type**: default
- **描述**: 在 `app/page.tsx` 中引入独立的 `isDocumentStreaming` 状态（从 `streamingDocId` 派生），停止在文档流式生成期间强制 `LessonPreview` 进入加载状态。仅在课程生成时传递 `isGenerating`，文档流式生成时不影响预览组件的渲染逻辑。
- **文件范围**: app/page.tsx
- **依赖**: None
- **测试命令**: `pnpm test --testPathPattern="page" --passWithNoTests`
- **测试重点**:
  - 验证 `isDocumentStreaming` 状态正确从 `streamingDocId` 派生
  - 验证课程生成时 `isGenerating` 正确传递给 `LessonPreview`
  - 验证文档流式生成时 `LessonPreview` 不进入加载状态
  - 验证状态切换不影响其他组件行为

### Task 2: 更新预览组件支持流式内容
- **ID**: task-2
- **type**: default
- **描述**: 修改 `components/steam-agent/lesson-preview.tsx`，使其在文档流式生成期间渲染 markdown 内容而非显示加载卡片。新增 `isDocumentStreaming` prop，在流式生成时显示内容并可选地展示细微的内联/叠加加载指示器。
- **文件范围**: components/steam-agent/lesson-preview.tsx
- **依赖**: depends on task-1
- **测试命令**: `pnpm test --testPathPattern="lesson-preview" --passWithNoTests`
- **测试重点**:
  - 测试 `isDocumentStreaming` prop 正确接收和处理
  - 测试流式生成期间 markdown 内容正确渲染
  - 测试流式指示器正确显示和隐藏
  - 测试课程生成加载状态不受影响
  - 测试内容更新时组件正确重新渲染

### Task 3: 验证流式管道集成
- **ID**: task-3
- **type**: default
- **描述**: 验证流式管道完整性，确保 `lib/editor/api.ts` 中的 SSE 解码、`stores/editorStore.ts` 中的 store 更新、以及预览组件读取 `storeMarkdown` 的流程无回归。确认课程生成的加载逻辑不受影响。
- **文件范围**: lib/editor/api.ts, stores/editorStore.ts, app/page.tsx
- **依赖**: depends on task-2
- **测试命令**: `pnpm test --testPathPattern="editor" --passWithNoTests`
- **测试重点**:
  - 测试 SSE 流解析正确处理增量内容
  - 测试 store 的 `appendDocumentContent` 正确更新文档内容
  - 测试预览组件正确读取 store 中的流式内容
  - 测试课程生成流程不受文档流式修复影响
  - 测试流式完成后状态正确重置

## 验收标准
- [ ] 主页新文档生成时内容以流式方式逐步显示
- [ ] 文档流式生成期间预览组件渲染 markdown 而非加载卡片
- [ ] 课程生成的加载状态逻辑保持不变
- [ ] 流式管道（SSE 解码、store 更新、预览渲染）无回归
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%

## 技术要点
- **状态解耦**: 区分 `isGenerating`（课程生成）和 `isDocumentStreaming`（文档流式生成）两种状态
- **渲染策略**: 预览组件在文档流式生成时应渲染内容而非显示加载占位符
- **向后兼容**: 确保课程生成的现有加载逻辑不受影响
- **性能考虑**: 流式内容更新时避免不必要的组件重新渲染
- **用户体验**: 可选地在流式生成时显示细微的加载指示器，但不阻塞内容显示
