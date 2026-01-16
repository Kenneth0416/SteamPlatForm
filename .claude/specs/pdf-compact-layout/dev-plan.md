# PDF 图文并排紧凑排版 - Development Plan

## Overview
实现 PDF 导出时图片与文字并排显示的紧凑排版布局，图片在右侧，文字在左侧。

## Task Breakdown

### Task 1: PDF 样式扩展
- **ID**: task-1
- **type**: default
- **Description**: 在 styles.ts 中添加双栏布局样式，包括行容器、左栏文字区域、右栏图片区域的样式定义
- **File Scope**: lib/export/pdf/styles.ts
- **Dependencies**: None
- **Test Command**: pnpm test -- --testPathPattern="pdf" --coverage --coveragePathPattern="lib/export/pdf/styles"
- **Test Focus**:
  - 验证新增样式对象结构完整
  - 确保样式属性符合 react-pdf 规范
  - 检查与现有样式无冲突

### Task 2: Section 渲染逻辑重构
- **ID**: task-2
- **type**: default
- **Description**: 重构 renderSection 函数，实现 section 级别的图文并排布局。当 section 包含图片时，将图片放置在右侧栏，文字内容放置在左侧栏；无图片时保持原有单栏布局
- **File Scope**: lib/export/pdf/generator.tsx
- **Dependencies**: depends on task-1
- **Test Command**: pnpm test -- --testPathPattern="pdf" --coverage --coveragePathPattern="lib/export/pdf/generator"
- **Test Focus**:
  - 有图片的 section 正确渲染双栏布局
  - 无图片的 section 保持单栏布局
  - 图片尺寸自适应处理
  - 文字内容正确流动到左栏
  - 多个 section 混合场景

### Task 3: 布局集成测试
- **ID**: task-3
- **type**: default
- **Description**: 创建端到端测试，验证完整的 PDF 生成流程中图文并排布局的正确性，覆盖各种边界情况
- **File Scope**: __tests__/export-pdf-layout.test.ts
- **Dependencies**: depends on task-2
- **Test Command**: pnpm test -- --testPathPattern="pdf-layout" --coverage --coveragePathPattern="__tests__/export-pdf-layout"
- **Test Focus**:
  - 单图片 section 布局
  - 多图片 section 布局
  - 大尺寸图片处理
  - 小尺寸图片处理
  - 长文本与图片并排
  - 混合有图/无图 section 的完整文档
  - 边界情况：空 section、纯图片 section

## Acceptance Criteria
- [ ] 图片在右侧，文字在左侧并排显示
- [ ] Section 级别的图文并排布局正确实现
- [ ] 支持各种图片尺寸的自适应
- [ ] 无图片的 section 保持原有布局
- [ ] 现有 PDF 导出功能不受影响
- [ ] All unit tests pass
- [ ] Code coverage ≥90%

## Technical Notes
- 使用 react-pdf 的 View 组件实现 flexDirection: 'row' 布局
- 图片栏宽度固定或按比例分配（如 40%），文字栏占据剩余空间
- 需要处理图片高度超过文字内容的情况，避免布局错位
- 保持现有的分页逻辑和样式继承机制
- 考虑 section 内多个图片的堆叠或网格布局
