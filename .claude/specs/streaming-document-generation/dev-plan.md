# 流式文档生成显示 - 开发计划

## 概述
在用户点击文档标签页的"+"按钮时，通过流式传输生成文档内容并实时显示在预览区域。

## 任务分解

### Task 1: 流式 API 端点转换
- **ID**: task-1
- **type**: default
- **描述**: 将 `/api/editor/documents/generate` 端点从一次性响应改为 SSE 流式响应，参考 `/api/lesson/route.ts` 的流式实现模式
- **文件范围**: app/api/editor/documents/generate/route.ts
- **依赖**: None
- **测试命令**: `curl -N -H "Content-Type: application/json" -d '{"templateKey":"lesson","existingDocuments":[]}' http://localhost:3030/api/editor/documents/generate`
- **测试重点**:
  - 验证 SSE 格式正确（`data: {...}\n\n`）
  - 验证流式输出逐步返回内容
  - 验证结束标记 `[DONE]` 正确发送
  - 验证错误处理返回错误消息

### Task 2: Store 流式状态管理
- **ID**: task-2
- **type**: default
- **描述**: 在 editorStore 中添加流式文档状态管理，包括 `streamingDocId` 字段和 `appendDocumentContent` 方法用于增量更新文档内容
- **文件范围**: stores/editorStore.ts
- **依赖**: None
- **测试命令**: `npm test __tests__/editor/streaming-store.test.ts -- --coverage --coveragePathIgnorePatterns=node_modules`
- **测试重点**:
  - 测试 `appendDocumentContent` 正确追加内容到指定文档
  - 测试流式状态标记（streamingDocId）正确设置和清除
  - 测试流式期间文档内容实时更新
  - 测试流式完成后状态正确重置

### Task 3: 流式获取工具函数
- **ID**: task-3
- **type**: default
- **描述**: 在 `lib/editor/api.ts` 中创建 `generateDocumentStream()` 函数，消费 SSE 流并通过回调函数返回增量内容
- **文件范围**: lib/editor/api.ts
- **依赖**: depends on task-1
- **测试命令**: `npm test __tests__/editor/streaming-api.test.ts -- --coverage --coveragePathIgnorePatterns=node_modules`
- **测试重点**:
  - 测试 SSE 流解析正确（解析 `data:` 前缀）
  - 测试增量内容通过回调正确传递
  - 测试 `[DONE]` 标记触发完成回调
  - 测试网络错误和解析错误正确处理
  - 测试流中断时的清理逻辑

### Task 4: UI 流式集成
- **ID**: task-4
- **type**: default
- **描述**: 在编辑器页面组件中集成流式文档生成，调用流式 API 并通过 store 实时更新文档内容，在预览区域显示流式内容
- **文件范围**: app/editor/[lessonId]/page.tsx, components/editor/new-document-dialog.tsx
- **依赖**: depends on task-1, task-2, task-3
- **测试命令**: `npm test __tests__/editor/streaming-integration.test.ts -- --coverage --coveragePathIgnorePatterns=node_modules`
- **测试重点**:
  - 测试点击"+"按钮触发流式生成
  - 测试文档立即创建并切换为活动文档
  - 测试流式内容逐步显示在预览区域
  - 测试流式完成后文档状态正确
  - 测试流式期间用户可以切换到其他文档
  - 测试流式错误时的用户提示

## 验收标准
- [ ] 用户点击"+"按钮后，文档立即创建并显示在标签页
- [ ] 文档内容通过流式传输逐步显示在预览区域
- [ ] 流式传输期间用户可以正常切换文档
- [ ] 流式完成后文档状态正确（isDirty 标记、内容完整）
- [ ] 流式错误时显示友好的错误提示
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%

## 技术要点
- **SSE 格式**: 使用 `data: {JSON}\n\n` 格式，结束标记为 `data: [DONE]\n\n`
- **流式响应头**: 必须设置 `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- **增量更新策略**: 文档创建时内容为空，流式过程中通过 `appendDocumentContent` 追加内容
- **状态同步**: 流式期间 `streamingDocId` 标记正在生成的文档，防止用户误操作
- **错误恢复**: 流式中断时保留已生成的部分内容，允许用户重试或手动编辑
- **LangChain 流式**: 使用 LangChain 的 `.stream()` 方法替代 `.invoke()` 获取流式输出
