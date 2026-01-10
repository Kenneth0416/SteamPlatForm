# Mermaid PDF 导出文字缺失修复 - 开发计划

## 概述
修复 PDF 导出时 Mermaid 图表文字缺失问题，通过捆绑跨平台字体并在 Resvg 中注册，确保 SVG→PNG 转换在所有环境下保留文字内容。

## 任务分解

### Task 1: 捆绑并注册 Resvg 回退字体
- **ID**: task-1
- **type**: default
- **Description**: 在项目中捆绑跨平台字体（Noto Sans 或 DejaVu），并在 Resvg 初始化时注册该字体，替换硬编码的 macOS 系统字体路径
- **File Scope**: `lib/export/svg-to-png.ts`, `public/fonts/` 或 `lib/fonts/`
- **Dependencies**: None
- **Test Command**: `pnpm test --coverage`
- **Test Focus**:
  - 验证字体文件正确加载
  - 验证 Resvg 初始化时字体注册成功
  - 验证 SVG 转 PNG 时文字渲染正常（包含中英文字符）
  - 测试在无系统字体环境下的降级行为

### Task 2: 对齐 Mermaid 导出主题字体配置
- **ID**: task-2
- **type**: default
- **Description**: 更新 `lib/api.ts` 中的 `replaceMermaidBlocksWithImages` 函数，在 mermaid 的 themeVariables 中指定使用捆绑的回退字体
- **File Scope**: `lib/api.ts`
- **Dependencies**: depends on task-1
- **Test Command**: `pnpm test --coverage`
- **Test Focus**:
  - 验证 mermaid 配置正确应用字体
  - 验证生成的 SVG 包含正确的字体引用
  - 测试不同类型的 mermaid 图表（流程图、序列图、类图）

### Task 3: 添加 Mermaid 块 PDF 导出测试
- **ID**: task-3
- **type**: default
- **Description**: 在测试套件中添加包含 mermaid 块的 PDF 导出测试用例，验证图片生成正确且文字完整
- **File Scope**: `__tests__/export-pdf*.test.ts` 或新建 `__tests__/mermaid-export.test.ts`
- **Dependencies**: depends on task-1, task-2
- **Test Command**: `pnpm test --coverage`
- **Test Focus**:
  - 端到端测试：从 markdown 输入到 PDF 输出
  - 验证 PDF 中 mermaid 图片存在且文字清晰
  - 测试多个 mermaid 块的场景
  - 测试包含中文字符的 mermaid 图表
  - 验证错误处理（无效 mermaid 语法）

## 验收标准
- [ ] Resvg 成功注册跨平台字体，不依赖系统字体路径
- [ ] Mermaid 图表在 PDF 导出中文字完整显示（中英文）
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%
- [ ] 在 Linux/Docker 环境下验证通过
- [ ] 不影响现有 PDF 导出功能

## 技术要点
- **字体选择**: 优先使用 Noto Sans（支持多语言）或 DejaVu Sans（轻量级）
- **字体路径**: 使用相对路径或 `path.resolve(__dirname, ...)` 确保跨环境兼容
- **Resvg API**: 使用 `fontFiles` 或 `fontDirs` 参数注册字体
- **Mermaid 配置**: 通过 `themeVariables.fontFamily` 指定字体
- **错误处理**: 字体加载失败时提供清晰的错误信息
- **性能**: 字体文件大小控制在 1MB 以内，考虑仅包含常用字符子集
