# Editor Agent Reflexion - Development Plan

## Overview
实现 Editor Agent 的遥测和卡住检测机制，通过环形缓冲区追踪工具调用、缓存读取结果、检测重复无效操作。

## Task Breakdown

### Task 1: 创建运行时工具类
- **ID**: task-1
- **type**: default
- **Description**: 实现 ToolTrace（环形缓冲区追踪最近 N 次工具调用）、ReadCache（缓存 read_block/read_blocks 结果）、stuckDetector（检测重复 list/read 调用且无进展的情况）
- **File Scope**: lib/editor/agent/runtime.ts
- **Dependencies**: None
- **Test Command**: `pnpm test __tests__/editor/agent-stuck.test.ts --coverage --coveragePathIgnorePatterns="node_modules" --collectCoverageFrom="lib/editor/agent/runtime.ts"`
- **Test Focus**:
  - ToolTrace 环形缓冲区正确存储和覆盖旧记录
  - ReadCache 正确缓存和返回读取结果
  - stuckDetector 检测重复 list_blocks 调用（≥3 次）
  - stuckDetector 检测重复 read_block 调用相同 blockId（≥3 次）
  - stuckDetector 检测无 edit/add/delete 操作的循环
  - 边界情况：空历史、单次调用、交替调用

### Task 2: 集成运行时状态到 Agent 循环
- **ID**: task-2
- **type**: default
- **Description**: 在 runEditorAgent 和 runEditorAgentStream 中注入 ToolTrace 和 ReadCache，在每次工具调用后记录到 ToolTrace，在读取工具中使用 ReadCache，在循环中调用 stuckDetector 检测卡住状态
- **File Scope**: lib/editor/agent.ts
- **Dependencies**: depends on task-1
- **Test Command**: `pnpm test __tests__/editor/agent.test.ts --coverage --coveragePathIgnorePatterns="node_modules" --collectCoverageFrom="lib/editor/agent.ts"`
- **Test Focus**:
  - ToolTrace 在 agent 循环中正确记录工具调用
  - ReadCache 在读取工具中被使用
  - stuckDetector 在检测到卡住时记录日志（不中断循环）
  - 现有 agent 测试仍然通过

### Task 3: 单元测试卡住检测逻辑
- **ID**: task-3
- **type**: default
- **Description**: 为 stuckDetector 编写全面的单元测试，覆盖所有卡住场景（重复 list、重复 read、无进展循环）和正常场景（有效操作序列）
- **File Scope**: __tests__/editor/agent-stuck.test.ts
- **Dependencies**: depends on task-1
- **Test Command**: `pnpm test __tests__/editor/agent-stuck.test.ts --coverage --coveragePathIgnorePatterns="node_modules" --collectCoverageFrom="lib/editor/agent/runtime.ts"`
- **Test Focus**:
  - 正常操作序列不触发卡住检测
  - 连续 3 次 list_blocks 触发卡住
  - 连续 3 次读取相同 blockId 触发卡住
  - 10 次调用无任何 edit/add/delete 触发卡住
  - 混合场景：list + read + list + read 触发卡住
  - 边界情况：恰好 2 次重复、恰好 9 次无进展

## Acceptance Criteria
- [ ] ToolTrace 正确实现环形缓冲区，存储最近 N 次工具调用
- [ ] ReadCache 正确缓存 read_block/read_blocks 结果
- [ ] stuckDetector 检测重复 list_blocks（≥3 次）
- [ ] stuckDetector 检测重复 read_block 相同 blockId（≥3 次）
- [ ] stuckDetector 检测无进展循环（≥10 次调用无 edit/add/delete）
- [ ] Agent 循环集成 ToolTrace、ReadCache 和 stuckDetector
- [ ] 检测到卡住时记录日志，不中断循环
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%

## Technical Notes
- **环形缓冲区大小**: 默认 30（与 maxIterations 一致）
- **卡住阈值**: 重复操作 ≥3 次，无进展 ≥10 次
- **缓存策略**: ReadCache 使用 Map<blockId, content>，仅缓存当前会话
- **日志级别**: 使用 console.warn 记录卡住检测，不抛出异常
- **向后兼容**: 不修改现有工具接口，仅在 agent.ts 中注入运行时状态
- **测试框架**: Jest 29，使用 @testing-library/jest-dom
- **覆盖率工具**: Jest 内置 coverage，目标 ≥90%
