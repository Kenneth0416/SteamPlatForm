# Editor Agent Batch Tools - Development Plan

## Overview
为 Editor Agent 添加批量读写工具、待处理内容叠加层和上下文标记功能，提升多块编辑效率。

## Task Breakdown

### Task 1: 批量工具实现
- **ID**: task-1
- **type**: default
- **Description**: 在 lib/editor/tools/index.ts 中实现 read_blocks 和 edit_blocks 批量工具，支持多块同时读取和编辑，减少 Agent 调用次数
- **File Scope**: lib/editor/tools/index.ts, lib/editor/tools/types.ts
- **Dependencies**: None
- **Test Command**: `pnpm test tests/unit/editor/tools/batch-tools.test.ts --coverage --coveragePathIgnorePatterns="node_modules" --collectCoverageFrom="lib/editor/tools/index.ts"`
- **Test Focus**:
  - read_blocks 正确返回多个块内容
  - edit_blocks 批量应用编辑操作
  - 空数组和单块边界情况
  - 无效块 ID 错误处理
  - 批量操作的原子性（部分失败回滚）

### Task 2: 有效内容叠加层
- **ID**: task-2
- **type**: default
- **Description**: 在 lib/editor/block-index.ts 中实现待处理内容叠加机制，维护 pending overlay 状态，使 Agent 读取时能看到最新的待处理修改
- **File Scope**: lib/editor/block-index.ts, lib/editor/types.ts
- **Dependencies**: depends on task-1
- **Test Command**: `pnpm test tests/unit/editor/block-index.test.ts --coverage --coveragePathIgnorePatterns="node_modules" --collectCoverageFrom="lib/editor/block-index.ts"`
- **Test Focus**:
  - overlay 正确叠加待处理修改
  - 读取时返回 overlay 后的内容
  - 提交后清除 overlay
  - 回滚时恢复原始状态
  - 多层 overlay 的优先级处理

### Task 3: Guard 批量支持
- **ID**: task-3
- **type**: default
- **Description**: 更新 lib/editor/tools/middleware.ts 中的 guard 逻辑，支持批量工具的权限检查和参数验证
- **File Scope**: lib/editor/tools/middleware.ts
- **Dependencies**: depends on task-1
- **Test Command**: `pnpm test tests/unit/editor/tools/middleware.test.ts --coverage --coveragePathIgnorePatterns="node_modules" --collectCoverageFrom="lib/editor/tools/middleware.ts"`
- **Test Focus**:
  - 批量工具的权限验证
  - 批量参数的格式校验
  - 超出批量限制的拒绝
  - 单块和批量工具的统一处理
  - 错误消息的清晰度

### Task 4: Agent 提示词和流式输出
- **ID**: task-4
- **type**: default
- **Description**: 更新 lib/editor/agent.ts 中的系统提示词，引导 Agent 使用批量工具；实现流式 diff 输出，实时展示编辑进度
- **File Scope**: lib/editor/agent.ts, lib/editor/prompts.ts
- **Dependencies**: depends on task-1, task-2, task-3
- **Test Command**: `pnpm test tests/unit/editor/agent.test.ts --coverage --coveragePathIgnorePatterns="node_modules" --collectCoverageFrom="lib/editor/agent.ts"`
- **Test Focus**:
  - 提示词包含批量工具说明
  - Agent 优先使用批量工具
  - 流式输出正确解析 diff
  - 流式输出的错误恢复
  - 上下文标记的正确传递

## Acceptance Criteria
- [ ] read_blocks 和 edit_blocks 工具正常工作
- [ ] pending overlay 正确维护待处理状态
- [ ] guard 支持批量工具的验证
- [ ] Agent 提示词引导使用批量工具
- [ ] 流式 diff 输出实时展示编辑
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%

## Technical Notes
- 批量工具需要事务性保证，部分失败时回滚所有操作
- overlay 机制使用 Map<blockId, pendingContent> 存储待处理状态
- guard 需要配置批量操作的最大块数限制（建议 10-20）
- 流式输出使用 ReadableStream，每个 diff 块独立发送
- 允许 breaking changes，优先功能完整性
- 使用 Zod 进行批量参数的运行时验证
- 考虑并发编辑的冲突检测（version 字段）
