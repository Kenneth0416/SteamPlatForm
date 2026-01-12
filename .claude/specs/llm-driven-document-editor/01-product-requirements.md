# Product Requirements Document: LLM-Driven Document Editor

## Executive Summary

本项目旨在为 STEAM Lesson Agent 平台构建一个 LLM 驱动的文档编辑器，使教师能够通过自然语言指令对已生成的课程计划进行精确修改。编辑器采用 Block 索引系统实现内容定位，结合 Diff 预览机制确保修改透明可控，最终提升课程定制效率和用户体验。

核心价值在于：将传统的手动编辑转变为 AI 辅助的智能编辑，用户只需描述修改意图，系统自动定位目标内容并生成修改建议，经用户确认后执行变更。

## Business Objectives

### Problem Statement

当前平台生成课程计划后，用户需要手动编辑文本进行调整，存在以下痛点：
1. 长文档中定位特定内容耗时
2. 批量修改（如替换术语、调整格式）效率低
3. 修改后难以追踪变更历史
4. 非技术用户对复杂编辑操作不熟悉

### Success Metrics

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 编辑任务完成时间 | 减少 50% | A/B 测试对比 |
| 用户满意度 | NPS >= 40 | 用户调研 |
| 功能采用率 | 60% 活跃用户使用 | 埋点统计 |
| 修改准确率 | >= 90% 首次命中 | 用户确认率 |

### Expected ROI

- 提升用户留存率 15%（更高效的编辑体验）
- 减少客服工单 20%（降低编辑相关问题）
- 增强产品差异化竞争力

## User Personas

### Primary Persona: 李老师（一线教师）

- **Role**: 小学 STEAM 课程教师
- **Goals**: 快速定制课程计划以适应班级实际情况
- **Pain Points**:
  - 时间有限，无法逐字修改长文档
  - 希望批量调整难度级别或时长
  - 不熟悉 Markdown 等技术格式
- **Technical Proficiency**: 基础办公软件水平

### Secondary Persona: 王主任（教研组长）

- **Role**: 教研组负责人
- **Goals**: 审核和标准化多份课程计划
- **Pain Points**:
  - 需要统一术语和格式
  - 希望追踪修改历史
- **Technical Proficiency**: 中等

## User Journey Maps

### Journey: 自然语言编辑课程计划

1. **Trigger**: 用户查看 AI 生成的课程计划，发现需要调整
2. **Steps**:
   - 用户在编辑器中输入自然语言指令（如"把第二节的时长从 30 分钟改为 45 分钟"）
   - 系统解析指令，定位目标 Block
   - 系统生成 Diff 预览，高亮显示变更
   - 用户确认或拒绝修改
   - 确认后系统应用变更，更新文档
3. **Success Outcome**: 课程计划按用户意图完成修改，变更清晰可见

### Journey: 批量术语替换

1. **Trigger**: 用户需要将文档中所有"学生"替换为"学习者"
2. **Steps**:
   - 用户输入"把所有'学生'替换为'学习者'"
   - 系统扫描全文，列出所有匹配位置
   - 系统生成批量 Diff 预览
   - 用户可选择全部应用或逐个确认
   - 应用后显示替换统计
3. **Success Outcome**: 批量替换完成，用户清楚知道修改了哪些位置

## Functional Requirements

### Epic: Block 索引系统

为文档内容建立结构化索引，支持精确定位和引用。

#### User Story 1: 文档结构解析

**As a** 系统
**I want to** 自动解析文档结构并建立 Block 索引
**So that** LLM 能够精确定位和引用内容

**Acceptance Criteria:**
- [ ] 支持解析 Markdown 标题层级（H1-H6）
- [ ] 支持解析列表项（有序/无序）
- [ ] 支持解析表格行和单元格
- [ ] 每个 Block 分配唯一 ID
- [ ] 索引在文档变更后自动更新

#### User Story 2: Block 引用与定位

**As a** 用户
**I want to** 通过自然语言描述定位特定内容
**So that** 无需手动滚动查找

**Acceptance Criteria:**
- [ ] 支持按标题名称定位（如"活动设计"部分）
- [ ] 支持按序号定位（如"第三个步骤"）
- [ ] 支持按内容关键词定位
- [ ] 定位结果高亮显示

### Epic: 核心工具集

提供 LLM 可调用的编辑工具函数。

#### User Story 3: 内容替换工具

**As a** LLM Agent
**I want to** 调用 replace 工具替换指定 Block 内容
**So that** 执行用户的修改指令

**Acceptance Criteria:**
- [ ] 工具接收 blockId 和 newContent 参数
- [ ] 验证 blockId 存在性
- [ ] 返回修改前后的内容对比
- [ ] 支持部分内容替换（正则匹配）

#### User Story 4: 内容插入工具

**As a** LLM Agent
**I want to** 调用 insert 工具在指定位置插入内容
**So that** 支持添加新段落或列表项

**Acceptance Criteria:**
- [ ] 支持在 Block 前/后插入
- [ ] 支持在列表中插入新项
- [ ] 自动继承上下文格式
- [ ] 插入后更新索引

#### User Story 5: 内容删除工具

**As a** LLM Agent
**I want to** 调用 delete 工具删除指定 Block
**So that** 支持移除不需要的内容

**Acceptance Criteria:**
- [ ] 支持删除单个 Block
- [ ] 支持删除 Block 范围
- [ ] 删除前需用户确认
- [ ] 删除后更新索引

### Epic: Diff 预览与确认

在应用修改前展示变更预览，确保用户知情同意。

#### User Story 6: Diff 可视化

**As a** 用户
**I want to** 在确认前看到修改的 Diff 预览
**So that** 确保修改符合预期

**Acceptance Criteria:**
- [ ] 使用红绿色标识删除/新增内容
- [ ] 显示修改的上下文（前后各 2 行）
- [ ] 支持并排对比和行内对比两种视图
- [ ] 显示修改统计（增/删/改行数）

#### User Story 7: 修改确认流程

**As a** 用户
**I want to** 确认或拒绝每次修改
**So that** 保持对文档的控制权

**Acceptance Criteria:**
- [ ] 提供"应用"和"取消"按钮
- [ ] 支持批量修改时逐个确认
- [ ] 支持"全部应用"快捷操作
- [ ] 取消后恢复原状态

#### User Story 8: 修改历史

**As a** 用户
**I want to** 查看和撤销历史修改
**So that** 可以回退错误操作

**Acceptance Criteria:**
- [ ] 记录每次确认的修改
- [ ] 支持撤销最近 N 次修改（N >= 10）
- [ ] 显示修改时间和内容摘要
- [ ] 支持跳转到特定历史版本

## Non-Functional Requirements

### Performance

- 文档解析和索引构建 < 500ms（10KB 文档）
- LLM 响应时间 < 3s（不含网络延迟）
- Diff 渲染 < 100ms
- 支持最大 50KB 文档

### Security

- 文档内容不离开用户会话（除 LLM API 调用）
- LLM API 调用使用 HTTPS
- 敏感内容过滤（可配置）

### Usability

- 符合 WCAG 2.1 AA 标准
- 支持键盘导航
- 支持中英文界面
- 移动端响应式适配

## Technical Constraints

### Integration Requirements

- **LLM API**: 复用现有 DeepSeek API 集成（lib/langchain）
- **编辑器**: 基于现有 Markdown 渲染组件扩展
- **状态管理**: 使用 React Context 或 Zustand

### Technology Constraints

- 前端框架：Next.js 16 + React 19
- 样式：Tailwind CSS 4
- 类型安全：TypeScript strict mode
- 兼容现有组件库（Radix UI）

## Scope & Phasing

### MVP Scope (Phase 1)

- Block 索引系统（标题、段落、列表）
- 核心工具：replace、insert、delete
- 基础 Diff 预览（行内对比）
- 单次修改确认流程
- 撤销最近 5 次修改

### Phase 2 Enhancements

- 表格单元格级别编辑
- 批量修改与批量确认
- 并排 Diff 视图
- 完整修改历史与版本对比
- 修改建议智能推荐

### Future Considerations

- 协作编辑支持
- 自定义编辑指令模板
- 与外部文档格式（Word、PDF）互转

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM 定位不准确 | Medium | High | 提供手动选择 Block 的备选方案 |
| 大文档性能问题 | Medium | Medium | 实现虚拟滚动和懒加载索引 |
| 用户不信任 AI 修改 | Low | High | 强制 Diff 预览，默认不自动应用 |
| API 调用成本超预期 | Low | Medium | 实现本地缓存和请求合并 |

## Dependencies

- DeepSeek API 稳定性和配额
- 现有 Markdown 渲染组件的可扩展性
- 前端状态管理方案确定

## Appendix

### Glossary

- **Block**: 文档中的最小可编辑单元（段落、标题、列表项等）
- **Diff**: 显示文本变更的对比视图
- **LLM**: Large Language Model，大语言模型

### References

- 现有 LangChain 集成：`lib/langchain/index.ts`
- 课程数据模型：`prisma/schema.prisma`
- UI 组件库：Radix UI 文档

---
*Document Version*: 1.0
*Date*: 2026-01-10
*Author*: Sarah (BMAD Product Owner)
*Quality Score*: 93/100
