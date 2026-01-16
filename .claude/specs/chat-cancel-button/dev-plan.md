# 聊天取消按钮 - 开发计划

## 概述
在主页 chatbot 对话过程中，允许用户点击取消按钮中断流式响应，同时保留已生成的部分内容。

## 任务分解

### Task 1: 添加 AbortController 和信号传递
- **ID**: task-1
- **type**: default
- **Description**: 在 chat-panel.tsx 中引入 AbortController 机制，通过 useRef 管理控制器实例，在 fetch 请求时传递 signal 参数，并实现 handleCancel 函数调用 abort() 方法中断请求
- **File Scope**: components/steam-agent/chat-panel.tsx
- **Dependencies**: None
- **Test Command**: npm test -- chat-panel --coverage --coverageReporters=text
- **Test Focus**:
  - AbortController 实例正确创建和清理
  - fetch 请求携带 signal 参数
  - handleCancel 调用 abort() 方法

### Task 2: 处理 AbortError 保留已生成内容
- **ID**: task-2
- **type**: default
- **Description**: 在流式响应读取的异常处理分支中捕获 AbortError，终止读取循环但保留已拼接的消息内容，将 AI 消息标记为完成状态并重置 isSending 标志
- **File Scope**: components/steam-agent/chat-panel.tsx
- **Dependencies**: depends on task-1
- **Test Command**: npm test -- chat-panel --coverage --coverageReporters=text
- **Test Focus**:
  - AbortError 被正确捕获而不抛出
  - 已生成的部分内容保留在消息列表中
  - isSending 状态正确重置
  - 用户可以继续发送新消息

### Task 3: 发送按钮切换为取消按钮
- **ID**: task-3
- **type**: ui
- **Description**: 根据 isSending 状态动态切换按钮显示，发送中时显示取消图标（X 或 Stop）和"取消"文案，绑定 handleCancel 事件；非发送中时显示发送图标和"发送"文案
- **File Scope**: components/steam-agent/chat-panel.tsx
- **Dependencies**: depends on task-1
- **Test Command**: npm test -- chat-panel --coverage --coverageReporters=text
- **Test Focus**:
  - isSending=true 时按钮显示取消图标和文案
  - isSending=false 时按钮显示发送图标和文案
  - 点击取消按钮触发 handleCancel
  - 按钮样式和交互符合 UI 规范

## 验收标准
- [ ] 发送消息时按钮自动切换为取消按钮
- [ ] 点击取消按钮立即停止流式响应
- [ ] 已生成的部分内容保留在对话中
- [ ] 取消后可以继续发送新消息
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%

## 技术要点
- 参考 EditorChatPanel.tsx 的 AbortController 实现模式
- 使用 useRef 管理 AbortController 避免重渲染问题
- AbortError 的 name 属性为 "AbortError"，需精确匹配
- 流式响应中断时需确保 reader 正确释放
- 按钮状态切换需考虑国际化（EN/ZH）
