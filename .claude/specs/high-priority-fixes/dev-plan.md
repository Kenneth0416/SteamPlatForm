# High Priority Fixes - Development Plan

## Overview
实现 LLM 客户端工厂模式、Zod 输入验证和重试机制，提升系统的稳定性、可维护性和错误处理能力。

## Task Breakdown

### Task 1: LLM 客户端工厂模式
- **ID**: task-1
- **type**: default
- **Description**: 创建统一的 LLM 客户端工厂，支持预设场景配置化，消除代码重复，集中管理 LLM 参数
- **File Scope**:
  - 新建: `lib/langchain/llm-factory.ts`
  - 修改: `lib/langchain/index.ts`, `lib/langchain/apply-change-agent.ts`, `lib/editor/agent.ts`
- **Dependencies**: None
- **Test Command**: `pnpm test:coverage -- --testPathPattern="llm-factory" --collectCoverageFrom="lib/langchain/llm-factory.ts" --collectCoverageFrom="lib/langchain/index.ts" --collectCoverageFrom="lib/langchain/apply-change-agent.ts" --collectCoverageFrom="lib/editor/agent.ts"`
- **Test Focus**:
  - 场景覆盖: lessonGeneration (temp: 0.7), documentEditing (temp: 0.2), 默认配置
  - 边界测试: 缺少环境变量、无效模型名称、自定义参数覆盖
  - 错误处理: API 配置错误、baseURL 格式验证
  - 集成测试: 验证替换现有 createDeepSeekClient() 后功能一致性

### Task 2: Zod 输入验证层
- **ID**: task-2
- **type**: default
- **Description**: 创建 Zod 验证模式，在 API 端点入口处验证 LessonRequirements 输入，防止非法数据和边界溢出
- **File Scope**:
  - 新建: `types/lesson.schema.ts`
  - 修改: `app/api/lesson/route.ts`
- **Dependencies**: None
- **Test Command**: `pnpm test:coverage -- --testPathPattern="lesson-schema" --collectCoverageFrom="types/lesson.schema.ts" --collectCoverageFrom="app/api/lesson/route.ts"`
- **Test Focus**:
  - 验证规则: numberOfSessions (1-20), durationPerSession (5-300), classSize (1-100)
  - 字符串长度: lessonTopic (≤200), teachingApproach (≤100), notes (≤1000)
  - 枚举验证: GradeLevel, STEAMDomain, TeachingApproach, DifficultyLevel
  - 边界值: 最小值、最大值、空数组、null/undefined 处理
  - 错误响应: 400 状态码和详细错误消息格式

### Task 3: 重试机制
- **ID**: task-3
- **type**: default
- **Description**: 实现指数退避重试包装器，自动处理 LLM API 调用的瞬时错误，提高系统可靠性
- **File Scope**:
  - 新建: `lib/langchain/retry.ts`
  - 修改: `lib/langchain/index.ts`, `lib/langchain/apply-change-agent.ts`, `lib/editor/agent.ts`
- **Dependencies**: depends on task-1
- **Test Command**: `pnpm test:coverage -- --testPathPattern="retry" --collectCoverageFrom="lib/langchain/retry.ts"`
- **Test Focus**:
  - 重试策略: 指数退避 (2^n 秒)，最多 3 次
  - 可重试错误: 网络超时、速率限制、5xx 错误
  - 不可重试错误: 4xx 错误、认证失败、无效请求
  - 边界测试: 第 3 次重试失败、重试间隔准确性
  - 性能测试: 确保重试不会阻塞超过预期时间

### Task 4: 单元测试套件
- **ID**: task-4
- **type**: default
- **Description**: 编写全面的单元测试和集成测试，确保所有新增功能达到 90% 覆盖率
- **File Scope**:
  - 新建: `__tests__/langchain/llm-factory.test.ts`, `__tests__/langchain/retry.test.ts`, `__tests__/types/lesson.schema.test.ts`, `__tests__/api/lesson-validation.test.ts`
- **Dependencies**: depends on task-1, task-2, task-3
- **Test Command**: `pnpm test:coverage -- --testPathPattern="(llm-factory|retry|lesson-schema|lesson-validation)" --collectCoverageFrom="lib/langchain/**/*.{ts,tsx}" --collectCoverageFrom="types/**/*.{ts,tsx}" --collectCoverageFrom="app/api/lesson/**/*.{ts,tsx}"`
- **Test Focus**:
  - 集成场景: 完整请求流程（验证 → LLM 调用 → 重试）
  - 端到端测试: 模拟真实 API 调用链路
  - 覆盖率目标: ≥90% 分支覆盖率、函数覆盖率、行覆盖率
  - Mock 策略: Mock LangChain ChatOpenAI，覆盖所有错误路径
  - 性能基准: 确保重试和验证不会引入显著延迟

### Task 5: 类型导出和文档更新
- **ID**: task-5
- **type**: quick-fix
- **Description**: 更新类型导出，完善内联注释和文档字符串，确保代码可维护性
- **File Scope**:
  - 修改: `types/lesson.ts`, `lib/langchain/llm-factory.ts`, `lib/langchain/retry.ts`
  - 新建 (如需要): `lib/langchain/README.md`
- **Dependencies**: depends on task-2
- **Test Command**: `pnpm test:coverage -- --testPathPattern="(types-exports|langchain-types)" --collectCoverageFrom="types/**/*.{ts,tsx}" --collectCoverageFrom="lib/langchain/**/*.{ts,tsx}"`
- **Test Focus**:
  - 类型导出: 验证 Zod schema 可以正确导出为 TypeScript 类型
  - 文档完整性: 所有公共 API 包含 JSDoc 注释
  - 使用示例: 内联代码示例展示工厂和验证的用法
  - 类型检查: 运行 `tsc --noEmit` 确保无类型错误

## Acceptance Criteria

- [ ] LLM 工厂支持至少 2 个预设场景 (lessonGeneration, documentEditing)
- [ ] 所有 API 端点在使用工厂方法后功能正常
- [ ] Zod 验证拦截所有非法输入，返回 400 错误和明确错误消息
- [ ] 重试机制在模拟网络故障时成功恢复 (3 次尝试内)
- [ ] 所有单元测试通过，覆盖率 ≥90% (分支、函数、行、语句)
- [ ] TypeScript 编译无错误 (`tsc --noEmit`)
- [ ] 代码审查通过，符合项目编码规范
- [ ] 现有功能回归测试通过 (无破坏性变更)

## Technical Notes

### 关键技术决策
1. **工厂模式设计**:
   - 使用预设场景枚举 `LessonGeneration | DocumentEditing | Default`
   - 支持运行时参数覆盖 (temperature, maxTokens)
   - 集中管理环境变量读取和错误处理

2. **Zod 验证策略**:
   - 在 API 路由入口处验证，尽早失败
   - 使用 `.safeParse()` 返回详细错误信息
   - 验证失败返回标准 HTTP 400 响应

3. **重试机制实现**:
   - 只重试幂等操作 (GET、生成类调用)
   - 使用 LangChain 内置的 `onFailedTry` 回调或自定义包装器
   - 记录重试日志用于监控

### 约束条件
- 不能修改前端代码，仅后端逻辑层变更
- 保持现有 API 接口签名不变
- 环境变量必须向后兼容 (DEEPSEEK_API_KEY, DEEPSEEK_MODEL, DEEPSEEK_BASE_URL)
- 性能影响 < 50ms 验证延迟，< 2s 总重试超时
- 必须兼容现有测试框架 (Jest + jsdom)

### 执行顺序
1. **并行**: Task 1 (LLM 工厂), Task 2 (Zod 验证)
2. **串行**: Task 3 (重试机制) 依赖 Task 1
3. **串行**: Task 4 (单元测试) 依赖 Task 1, 2, 3
4. **串行**: Task 5 (文档) 依赖 Task 2

### 风险提示
- LangChain 版本兼容性: 当前使用 `@langchain/openai@1.2.0`，确保新包装器与其兼容
- 测试 Mock 复杂度: LangChain 的 ChatOpenAI 需要谨慎 Mock，建议使用 `jest.mock()` + 自定义工厂
- 环境变量缺失: CI 环境需要配置测试用的 DeepSeek API key 或使用 Mock
