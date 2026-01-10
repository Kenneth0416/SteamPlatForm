---
name: lesson
description: 开发 STEAM 课程生成功能
---

关键文件:
- lib/langchain/index.ts - AI 生成逻辑
- lib/langchain/prompts.ts - 提示词
- app/api/lesson/route.ts - 生成 API
- app/api/chat/route.ts - 聊天 API
- components/steam-agent/ - UI 组件
- types/lesson.ts - 类型定义

开发要点:
1. 保持双语支持 (EN/ZH)
2. 测试流式输出
3. 验证 Mermaid 图表
