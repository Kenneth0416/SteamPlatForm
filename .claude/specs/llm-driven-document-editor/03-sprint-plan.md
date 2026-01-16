# Sprint Planning Document: LLM-Driven Document Editor

## Executive Summary
- **Total Scope**: 89 story points
- **Estimated Duration**: 2 sprints (4 weeks)
- **Team Size Assumption**: 2 developers
- **Sprint Length**: 2 weeks
- **Velocity Assumption**: 45-50 points/sprint

## User Preferences Applied
- 支持任意 Markdown 文档（不限于课程）
- 列表项独立处理（每个 `- item` 为独立 Block）
- 自动版本创建（确认编辑时自动保存版本）
- 独立编辑器页面（`/editor/[lessonId]`）

---

## Epic Breakdown

### Epic 1: Block 索引系统
**Business Value**: 为 LLM 提供精确的文档定位能力，支持细粒度编辑
**Total Points**: 21
**Priority**: High

#### User Stories:
1. **BLOCK-01**: Markdown 解析与 Block 生成 (8 points)
2. **BLOCK-02**: Block 定位与索引查询 (8 points)
3. **BLOCK-03**: 列表项独立处理 (5 points)

### Epic 2: 核心工具集
**Business Value**: 提供 LLM 可调用的文档操作工具，实现安全的编辑流程
**Total Points**: 26
**Priority**: High

#### User Stories:
1. **TOOL-01**: read_document 工具 (5 points)
2. **TOOL-02**: edit_block 工具 (8 points)
3. **TOOL-03**: add_block 工具 (5 points)
4. **TOOL-04**: delete_block 工具 (5 points)
5. **TOOL-05**: Read-Before-Write 约束机制 (3 points)

### Epic 3: Diff 预览与版本管理
**Business Value**: 让用户清晰看到变更并可回溯历史版本
**Total Points**: 21
**Priority**: High

#### User Stories:
1. **DIFF-01**: Diff 可视化组件 (8 points)
2. **DIFF-02**: 确认/拒绝流程 (5 points)
3. **DIFF-03**: 自动版本创建 (8 points)

### Epic 4: 编辑器页面
**Business Value**: 提供完整的用户交互界面
**Total Points**: 21
**Priority**: High

#### User Stories:
1. **PAGE-01**: /editor/[lessonId] 页面布局 (8 points)
2. **PAGE-02**: Zustand Store 状态管理 (5 points)
3. **PAGE-03**: ChatPanel 集成 (8 points)

---

## Detailed User Stories

### BLOCK-01: Markdown 解析与 Block 生成
**Epic**: Block 索引系统
**Points**: 8
**Priority**: High

**User Story**:
As a developer
I want to parse Markdown into indexed blocks
So that LLM can reference specific document sections

**Acceptance Criteria**:
- [ ] 解析标准 Markdown 元素（标题、段落、代码块、列表）
- [ ] 每个 Block 分配唯一 ID（格式：`block-{index}`）
- [ ] 保留原始行号信息
- [ ] 支持嵌套结构（列表内代码块）

**Technical Notes**:
- 使用 `unified` + `remark-parse` 解析 Markdown AST
- 遍历 AST 生成 Block 数组
- 文件位置：`lib/editor/parser.ts`

**Tasks**:
1. **BLOCK-01-T1**: 安装依赖并创建解析器骨架 (2h)
2. **BLOCK-01-T2**: 实现 AST 遍历与 Block 生成 (4h)
3. **BLOCK-01-T3**: 处理嵌套结构与边界情况 (3h)
4. **BLOCK-01-T4**: 单元测试 (3h)

**Definition of Done**:
- [ ] 代码通过 TypeScript 类型检查
- [ ] 单元测试覆盖主要场景
- [ ] 支持常见 Markdown 元素

---

### BLOCK-02: Block 定位与索引查询
**Epic**: Block 索引系统
**Points**: 8
**Priority**: High

**User Story**:
As a LLM tool
I want to query blocks by ID or content pattern
So that I can locate the correct section to edit

**Acceptance Criteria**:
- [ ] 通过 Block ID 精确查询
- [ ] 通过内容关键词模糊查询
- [ ] 返回 Block 及其上下文（前后各 1 个 Block）
- [ ] 查询结果包含行号范围

**Technical Notes**:
- 实现 `BlockIndex` 类管理索引
- 支持 `getById()`, `search()` 方法
- 文件位置：`lib/editor/block-index.ts`

**Tasks**:
1. **BLOCK-02-T1**: 设计 BlockIndex 接口 (2h)
2. **BLOCK-02-T2**: 实现精确查询 (2h)
3. **BLOCK-02-T3**: 实现模糊搜索 (3h)
4. **BLOCK-02-T4**: 上下文获取逻辑 (2h)
5. **BLOCK-02-T5**: 单元测试 (3h)

**Definition of Done**:
- [ ] 查询性能 < 10ms（1000 Blocks）
- [ ] 测试覆盖精确/模糊查询

---

### BLOCK-03: 列表项独立处理
**Epic**: Block 索引系统
**Points**: 5
**Priority**: High

**User Story**:
As a user
I want each list item treated as independent block
So that LLM can edit individual items precisely

**Acceptance Criteria**:
- [ ] 每个 `- item` 生成独立 Block
- [ ] 嵌套列表保持层级关系
- [ ] 编辑单个列表项不影响其他项
- [ ] 重建 Markdown 时保持原格式

**Technical Notes**:
- 修改解析器处理 `listItem` 节点
- Block 类型增加 `list-item`
- 文件位置：`lib/editor/parser.ts`

**Tasks**:
1. **BLOCK-03-T1**: 修改解析器拆分列表项 (3h)
2. **BLOCK-03-T2**: 实现列表重建逻辑 (2h)
3. **BLOCK-03-T3**: 测试嵌套列表场景 (2h)

**Definition of Done**:
- [ ] 列表项可独立编辑
- [ ] 重建后格式与原文一致

---

### TOOL-01: read_document 工具
**Epic**: 核心工具集
**Points**: 5
**Priority**: High

**User Story**:
As a LLM
I want to read document content with block indices
So that I can understand the document structure

**Acceptance Criteria**:
- [ ] 返回完整文档内容
- [ ] 每个 Block 标注 ID 和行号
- [ ] 支持指定范围读取（可选）
- [ ] 输出格式适合 LLM 理解

**Technical Notes**:
- LangChain Tool 定义
- 调用 BlockIndex 获取结构化内容
- 文件位置：`lib/editor/tools/read-document.ts`

**Tasks**:
1. **TOOL-01-T1**: 定义 Tool Schema (1h)
2. **TOOL-01-T2**: 实现读取逻辑 (2h)
3. **TOOL-01-T3**: 格式化输出 (2h)
4. **TOOL-01-T4**: 集成测试 (2h)

**Definition of Done**:
- [ ] LLM 可正确调用工具
- [ ] 输出包含 Block 索引信息

---

### TOOL-02: edit_block 工具
**Epic**: 核心工具集
**Points**: 8
**Priority**: High

**User Story**:
As a LLM
I want to edit a specific block by ID
So that I can make precise document changes

**Acceptance Criteria**:
- [ ] 通过 Block ID 定位目标
- [ ] 替换 Block 内容
- [ ] 生成 Diff 预览（不立即应用）
- [ ] 验证 Block ID 存在性

**Technical Notes**:
- 返回 `PendingEdit` 对象
- 使用 `diff` 库生成差异
- 文件位置：`lib/editor/tools/edit-block.ts`

**Tasks**:
1. **TOOL-02-T1**: 定义 Tool Schema 与参数验证 (2h)
2. **TOOL-02-T2**: 实现 Block 替换逻辑 (3h)
3. **TOOL-02-T3**: 生成 Diff 输出 (2h)
4. **TOOL-02-T4**: 错误处理（ID 不存在等）(2h)
5. **TOOL-02-T5**: 单元测试 (3h)

**Definition of Done**:
- [ ] 编辑不立即生效，需用户确认
- [ ] Diff 清晰显示变更

---

### TOOL-03: add_block 工具
**Epic**: 核心工具集
**Points**: 5
**Priority**: High

**User Story**:
As a LLM
I want to add new content after a specific block
So that I can expand the document

**Acceptance Criteria**:
- [ ] 指定 `afterBlockId` 插入位置
- [ ] 支持插入到文档开头（`afterBlockId: null`）
- [ ] 自动分配新 Block ID
- [ ] 生成 Diff 预览

**Technical Notes**:
- 文件位置：`lib/editor/tools/add-block.ts`

**Tasks**:
1. **TOOL-03-T1**: 定义 Tool Schema (1h)
2. **TOOL-03-T2**: 实现插入逻辑 (3h)
3. **TOOL-03-T3**: 更新索引 (2h)
4. **TOOL-03-T4**: 测试 (2h)

**Definition of Done**:
- [ ] 插入位置正确
- [ ] 索引自动更新

---

### TOOL-04: delete_block 工具
**Epic**: 核心工具集
**Points**: 5
**Priority**: High

**User Story**:
As a LLM
I want to delete a specific block
So that I can remove unwanted content

**Acceptance Criteria**:
- [ ] 通过 Block ID 删除
- [ ] 生成 Diff 预览（显示删除内容）
- [ ] 处理删除后的索引重建

**Technical Notes**:
- 文件位置：`lib/editor/tools/delete-block.ts`

**Tasks**:
1. **TOOL-04-T1**: 定义 Tool Schema (1h)
2. **TOOL-04-T2**: 实现删除逻辑 (2h)
3. **TOOL-04-T3**: 索引重建 (2h)
4. **TOOL-04-T4**: 测试 (2h)

**Definition of Done**:
- [ ] 删除不立即生效
- [ ] Diff 显示被删除内容

---

### TOOL-05: Read-Before-Write 约束机制
**Epic**: 核心工具集
**Points**: 3
**Priority**: High

**User Story**:
As a system
I want to enforce read before write
So that LLM always has current document state

**Acceptance Criteria**:
- [ ] 编辑工具调用前检查是否已读取
- [ ] 未读取时返回错误提示
- [ ] 文档变更后重置读取状态

**Technical Notes**:
- 在 Tool 执行层添加中间件
- 维护 `hasRead` 状态
- 文件位置：`lib/editor/tools/middleware.ts`

**Tasks**:
1. **TOOL-05-T1**: 实现状态追踪 (1h)
2. **TOOL-05-T2**: 添加检查中间件 (2h)
3. **TOOL-05-T3**: 测试约束生效 (1h)

**Definition of Done**:
- [ ] 未读取时编辑被拒绝
- [ ] 错误信息清晰

---

### DIFF-01: Diff 可视化组件
**Epic**: Diff 预览与版本管理
**Points**: 8
**Priority**: High

**User Story**:
As a user
I want to see visual diff of proposed changes
So that I can understand what will be modified

**Acceptance Criteria**:
- [ ] 并排显示原文/修改后
- [ ] 高亮添加（绿色）/删除（红色）/修改（黄色）
- [ ] 显示行号
- [ ] 支持多个 Block 变更

**Technical Notes**:
- 使用 `react-diff-viewer` 或自定义组件
- 文件位置：`components/editor/DiffViewer.tsx`

**Tasks**:
1. **DIFF-01-T1**: 组件骨架与样式 (2h)
2. **DIFF-01-T2**: Diff 算法集成 (3h)
3. **DIFF-01-T3**: 多 Block 变更展示 (2h)
4. **DIFF-01-T4**: 响应式布局 (2h)
5. **DIFF-01-T5**: 测试 (3h)

**Definition of Done**:
- [ ] 变更清晰可见
- [ ] 移动端可用

---

### DIFF-02: 确认/拒绝流程
**Epic**: Diff 预览与版本管理
**Points**: 5
**Priority**: High

**User Story**:
As a user
I want to confirm or reject proposed changes
So that I have control over document modifications

**Acceptance Criteria**:
- [ ] 显示「确认」「拒绝」按钮
- [ ] 确认后应用变更到文档
- [ ] 拒绝后丢弃变更
- [ ] 支持部分确认（多个变更时）

**Technical Notes**:
- 文件位置：`components/editor/DiffActions.tsx`

**Tasks**:
1. **DIFF-02-T1**: UI 组件 (2h)
2. **DIFF-02-T2**: 确认逻辑 (2h)
3. **DIFF-02-T3**: 部分确认支持 (2h)
4. **DIFF-02-T4**: 测试 (2h)

**Definition of Done**:
- [ ] 用户可控制每个变更
- [ ] 状态正确更新

---

### DIFF-03: 自动版本创建
**Epic**: Diff 预览与版本管理
**Points**: 8
**Priority**: High

**User Story**:
As a user
I want automatic version snapshots on confirm
So that I can revert to previous states

**Acceptance Criteria**:
- [ ] 确认编辑时自动保存版本
- [ ] 版本包含时间戳和变更摘要
- [ ] 支持查看版本历史
- [ ] 支持恢复到指定版本

**Technical Notes**:
- 数据库增加 `DocumentVersion` 表
- 文件位置：`lib/editor/version.ts`

**Tasks**:
1. **DIFF-03-T1**: 数据库 Schema 设计 (2h)
2. **DIFF-03-T2**: 版本创建逻辑 (3h)
3. **DIFF-03-T3**: 版本列表 API (2h)
4. **DIFF-03-T4**: 恢复功能 (2h)
5. **DIFF-03-T5**: 测试 (3h)

**Definition of Done**:
- [ ] 每次确认创建版本
- [ ] 可恢复历史版本

---

### PAGE-01: /editor/[lessonId] 页面布局
**Epic**: 编辑器页面
**Points**: 8
**Priority**: High

**User Story**:
As a user
I want a dedicated editor page
So that I can focus on document editing

**Acceptance Criteria**:
- [ ] 左侧：Markdown 编辑器（可编辑）
- [ ] 右侧：Chat Panel
- [ ] 顶部：工具栏（保存、版本历史）
- [ ] 响应式布局

**Technical Notes**:
- 使用 `@uiw/react-md-editor` 或 `monaco-editor`
- 文件位置：`app/editor/[lessonId]/page.tsx`

**Tasks**:
1. **PAGE-01-T1**: 页面路由与布局 (2h)
2. **PAGE-01-T2**: Markdown 编辑器集成 (3h)
3. **PAGE-01-T3**: 工具栏组件 (2h)
4. **PAGE-01-T4**: 响应式适配 (2h)
5. **PAGE-01-T5**: 测试 (3h)

**Definition of Done**:
- [ ] 页面可访问
- [ ] 编辑器可正常使用

---

### PAGE-02: Zustand Store 状态管理
**Epic**: 编辑器页面
**Points**: 5
**Priority**: High

**User Story**:
As a developer
I want centralized state management
So that components can share editor state

**Acceptance Criteria**:
- [ ] 管理文档内容状态
- [ ] 管理 Block 索引状态
- [ ] 管理 Pending Edits 状态
- [ ] 管理版本历史状态

**Technical Notes**:
- 文件位置：`lib/editor/store.ts`

**Tasks**:
1. **PAGE-02-T1**: Store 设计与类型定义 (2h)
2. **PAGE-02-T2**: 实现 Actions (3h)
3. **PAGE-02-T3**: 组件集成 (2h)
4. **PAGE-02-T4**: 测试 (2h)

**Definition of Done**:
- [ ] 状态同步正确
- [ ] 无不必要的重渲染

---

### PAGE-03: ChatPanel 集成
**Epic**: 编辑器页面
**Points**: 8
**Priority**: High

**User Story**:
As a user
I want to chat with AI to edit document
So that I can make changes through natural language

**Acceptance Criteria**:
- [ ] 聊天界面集成到编辑器页面
- [ ] AI 响应显示 Diff 预览
- [ ] 支持流式输出
- [ ] 工具调用结果可视化

**Technical Notes**:
- 复用现有 ChatPanel 组件
- 集成 LangChain Agent
- 文件位置：`components/editor/EditorChatPanel.tsx`

**Tasks**:
1. **PAGE-03-T1**: ChatPanel 适配 (2h)
2. **PAGE-03-T2**: Agent 集成 (3h)
3. **PAGE-03-T3**: 工具调用 UI (3h)
4. **PAGE-03-T4**: 流式输出处理 (2h)
5. **PAGE-03-T5**: 测试 (2h)

**Definition of Done**:
- [ ] 可通过聊天编辑文档
- [ ] Diff 正确显示

---

## Sprint Plan

### Sprint 1 (Weeks 1-2)
**Sprint Goal**: 完成 Block 索引系统和核心工具集，实现 LLM 可调用的文档编辑能力
**Planned Velocity**: 47 points

#### Committed Stories:
| Story ID | Title | Points | Priority |
|----------|-------|--------|----------|
| BLOCK-01 | Markdown 解析与 Block 生成 | 8 | High |
| BLOCK-02 | Block 定位与索引查询 | 8 | High |
| BLOCK-03 | 列表项独立处理 | 5 | High |
| TOOL-01 | read_document 工具 | 5 | High |
| TOOL-02 | edit_block 工具 | 8 | High |
| TOOL-03 | add_block 工具 | 5 | High |
| TOOL-04 | delete_block 工具 | 5 | High |
| TOOL-05 | Read-Before-Write 约束 | 3 | High |

#### Key Deliverables:
- Block 索引系统完整实现
- 4 个 LangChain Tools 可用
- Read-Before-Write 约束生效

#### Dependencies:
- BLOCK-01 → BLOCK-02 → BLOCK-03
- BLOCK-02 → TOOL-01 → TOOL-02/03/04
- TOOL-01 → TOOL-05

#### Risks:
- Markdown 解析复杂度可能超预期
- 列表嵌套处理边界情况多

---

### Sprint 2 (Weeks 3-4)
**Sprint Goal**: 完成 Diff 预览、版本管理和编辑器页面，交付完整用户体验
**Planned Velocity**: 42 points

#### Committed Stories:
| Story ID | Title | Points | Priority |
|----------|-------|--------|----------|
| DIFF-01 | Diff 可视化组件 | 8 | High |
| DIFF-02 | 确认/拒绝流程 | 5 | High |
| DIFF-03 | 自动版本创建 | 8 | High |
| PAGE-01 | /editor/[lessonId] 页面布局 | 8 | High |
| PAGE-02 | Zustand Store 状态管理 | 5 | High |
| PAGE-03 | ChatPanel 集成 | 8 | High |

#### Key Deliverables:
- Diff 预览与确认流程
- 自动版本管理
- 完整编辑器页面

#### Dependencies:
- Sprint 1 全部完成
- DIFF-01 → DIFF-02 → DIFF-03
- PAGE-02 → PAGE-01 → PAGE-03

#### Risks:
- Diff 组件性能（大文档）
- 版本存储空间增长

---

## Critical Path

### Sequence of Critical Tasks:
1. BLOCK-01 (Markdown 解析) →
2. BLOCK-02 (Block 索引) →
3. TOOL-01 (read_document) →
4. TOOL-02 (edit_block) →
5. DIFF-01 (Diff 可视化) →
6. PAGE-03 (ChatPanel 集成)

### Potential Bottlenecks:
- **Markdown 解析复杂度**: 提前调研 remark 插件生态
- **Diff 性能**: 大文档使用虚拟滚动

---

## Risk Register

| Risk | Probability | Impact | Mitigation Strategy | Owner |
|------|------------|--------|-------------------|--------|
| Markdown 解析边界情况多 | M | M | 增加测试用例覆盖 | Dev |
| Diff 组件性能问题 | L | M | 虚拟滚动 + 分块渲染 | Dev |
| 版本存储空间增长 | M | L | 定期清理 + 压缩存储 | Dev |
| LLM 工具调用不稳定 | L | H | 重试机制 + 错误处理 | Dev |

---

## Dependencies

### Internal Dependencies:
- Block 索引系统必须先于工具集完成
- Diff 组件必须先于确认流程完成
- Zustand Store 必须先于页面组件完成

### External Dependencies:
- `unified` / `remark-parse` 库
- `diff` 库
- Markdown 编辑器组件库

---

## Technical Debt Allocation

### Planned Technical Debt:
- Sprint 2: 性能优化（大文档处理）(5 points buffer)
- Sprint 2: 错误边界完善 (3 points buffer)

---

## Testing Strategy

### Test Coverage by Sprint:
- **Sprint 1**: Block 解析单元测试、Tool 集成测试
- **Sprint 2**: Diff 组件测试、E2E 编辑流程测试

### Test Automation Plan:
- 单元测试: Jest + React Testing Library
- E2E 测试: Playwright（Sprint 2 末）

---

## Success Metrics

### Sprint Success Criteria:
- Sprint goal 达成率 > 90%
- 无 P0 Bug 遗留
- 代码覆盖率 > 70%

### Feature Success Criteria:
- 用户可通过聊天编辑任意 Markdown
- 每次编辑有 Diff 预览
- 版本可回溯

---

## Recommendations

### For Development Team:
- Sprint 1 前两天完成 BLOCK-01，为后续任务解锁
- 工具开发可并行（TOOL-02/03/04）
- 提前调研 Markdown 编辑器组件

### For Product Owner:
- Sprint 1 结束后可演示工具调用能力
- Sprint 2 中期可演示 Diff 预览

---

## Appendix

### Estimation Guidelines Used:
- **1 point**: Trivial change, <2 hours
- **2 points**: Simple feature, well understood
- **3 points**: Moderate complexity, some unknowns
- **5 points**: Complex feature, multiple components
- **8 points**: Very complex, significant unknowns
- **13 points**: Should be broken down further

### File Structure:
```
lib/editor/
├── parser.ts           # BLOCK-01/03
├── block-index.ts      # BLOCK-02
├── tools/
│   ├── read-document.ts    # TOOL-01
│   ├── edit-block.ts       # TOOL-02
│   ├── add-block.ts        # TOOL-03
│   ├── delete-block.ts     # TOOL-04
│   └── middleware.ts       # TOOL-05
├── version.ts          # DIFF-03
└── store.ts            # PAGE-02

components/editor/
├── DiffViewer.tsx      # DIFF-01
├── DiffActions.tsx     # DIFF-02
└── EditorChatPanel.tsx # PAGE-03

app/editor/
└── [lessonId]/
    └── page.tsx        # PAGE-01
```

---
*Document Version*: 1.0
*Date*: 2026-01-10
*Author*: BMAD Scrum Master (Automated)
*Based on*:
  - PRD v1.0
  - Architecture v1.0
