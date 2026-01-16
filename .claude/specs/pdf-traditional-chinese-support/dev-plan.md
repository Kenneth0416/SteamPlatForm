# PDF 繁体中文支持 - 开发计划

## 概述
为 PDF 导出功能添加繁体中文字体支持，确保繁体中文字符正确渲染。

## 任务分解

### Task 1: 添加繁体中文字体资源并集成到 React-PDF
- **ID**: task-1
- **type**: default
- **Description**: 下载并添加 Noto Sans TC 或 Source Han Sans TC 字体文件到 public/fonts/ 目录，在 lib/export/pdf/generator.tsx 中使用 Font.register() 注册字体，更新 lib/export/pdf/styles.ts 中的字体族配置以使用新字体
- **File Scope**: lib/export/pdf/generator.tsx, lib/export/pdf/styles.ts, public/fonts/
- **Dependencies**: None
- **Test Command**: npm test -- export-pdf
- **Test Focus**: 验证字体注册成功，PDF 生成不报错，繁体中文字符在 PDF 中正确显示

### Task 2: 添加繁体中文渲染单元测试
- **ID**: task-2
- **type**: default
- **Description**: 在 __tests__/export-pdf-generator.test.ts 中添加测试用例，覆盖繁体中文字符渲染场景（包括标题、正文、列表等），验证字体加载和字符显示正确性，确保测试覆盖率 ≥90%
- **File Scope**: __tests__/export-pdf-generator.test.ts
- **Dependencies**: depends on task-1
- **Test Command**: npm test -- export-pdf-generator --coverage
- **Test Focus**:
  - 繁体中文标题渲染
  - 繁体中文正文段落渲染
  - 繁体中文列表项渲染
  - 混合简繁体字符渲染
  - 字体回退机制（如果字体加载失败）

## 验收标准
- [ ] 繁体中文字体文件已添加到 public/fonts/ 目录
- [ ] 字体已在 React-PDF 中正确注册
- [ ] PDF 样式配置已更新为使用繁体中文字体
- [ ] 繁体中文字符在导出的 PDF 中正确显示（无乱码或方框）
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%

## 技术要点
- 当前 PDF 使用 Helvetica/Courier 字体，不支持 CJK 字符
- React-PDF 需要通过 Font.register() 显式注册字体文件路径
- 字体文件建议使用 Noto Sans TC 或 Source Han Sans TC（开源且支持完整繁体字符集）
- 已存在 SourceHanSansCN-Regular.ttf（简体），可参考其集成方式
- Fallback builder 限制已知（可选修复，不影响核心功能）
