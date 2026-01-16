# Middleware 到 Proxy 架构迁移 - 开发计划

## 概述
将 Next.js 15 的 middleware.ts 认证逻辑迁移到 Next.js 16 的 proxy.ts 架构，使用服务端 Layout Guard 和 API 路由级别的认证检查。

## 任务分解

### Task 1: 路由分类与保护策略映射
- **ID**: task-1
- **type**: default
- **Description**: 分析现有路由结构，明确公开路由（/auth/*、/api/auth/*、/api/export/*）与受保护路由（其他所有路由），为后续 Layout Guard 实现提供准确的路由映射表
- **File Scope**: app/**/*, middleware.ts
- **Dependencies**: None
- **Test Command**: `pnpm test -- tests/routing/route-classification.test.ts --coverage --coveragePathIgnorePatterns=/node_modules/`
- **Test Focus**:
  - 验证公开路由列表完整性（/auth/login、/auth/register、/api/auth/*、/api/export/*）
  - 验证受保护路由识别逻辑（排除静态资源、公开路由后的所有路由）
  - 边界情况：嵌套路由、动态路由段、路由组

### Task 2: 实现 Layout Guard 认证逻辑
- **ID**: task-2
- **type**: default
- **Description**: 在根 layout.tsx 中实现服务端认证守卫，使用 NextAuth 的 auth() 函数检查会话状态，未登录用户重定向到 /auth/login，已登录用户访问 /auth/* 时重定向到首页
- **File Scope**: app/layout.tsx, app/auth/layout.tsx, lib/auth.ts
- **Dependencies**: depends on task-1
- **Test Command**: `pnpm test -- tests/auth/layout-guard.test.ts --coverage --coveragePathIgnorePatterns=/node_modules/`
- **Test Focus**:
  - 未认证用户访问受保护路由时重定向到 /auth/login
  - 已认证用户访问 /auth/login 或 /auth/register 时重定向到 /
  - 已认证用户正常访问受保护路由（/、/library、/admin）
  - 公开路由（/auth/*）无需认证即可访问
  - 服务端 auth() 调用正确处理 session 为 null 的情况

### Task 3: 创建 proxy.ts 并移除 middleware.ts
- **ID**: task-3
- **type**: default
- **Description**: 在 app/proxy.ts 创建符合 Next.js 16 规范的最小化代理配置文件（仅处理静态资源路由，不包含认证逻辑），删除 middleware.ts 文件及其 matcher 配置
- **File Scope**: app/proxy.ts, middleware.ts
- **Dependencies**: depends on task-2
- **Test Command**: `pnpm test -- tests/proxy/proxy-config.test.ts --coverage --coveragePathIgnorePatterns=/node_modules/`
- **Test Focus**:
  - 验证 app/proxy.ts 存在且导出正确的配置结构
  - 验证 middleware.ts 已被删除
  - 验证静态资源路由（/_next/*, /favicon.ico, /*.png, /*.svg）正常访问
  - 验证 proxy.ts 不包含任何认证逻辑（无 cookie 检查、无重定向）

### Task 4: API 路由级别认证保护
- **ID**: task-4
- **type**: default
- **Description**: 为所有受保护的 API 路由（/api/lesson、/api/lessons、/api/chat、/api/admin/*、/api/editor/*、/api/apply-change）添加 auth() 检查，未认证请求返回 401 状态码，保持 /api/auth/* 和 /api/export/* 公开访问
- **File Scope**: app/api/lesson/route.ts, app/api/lessons/**, app/api/chat/route.ts, app/api/admin/**, app/api/editor/**, app/api/apply-change/route.ts
- **Dependencies**: depends on task-2
- **Test Command**: `pnpm test -- tests/api/auth-protection.test.ts --coverage --coveragePathIgnorePatterns=/node_modules/`
- **Test Focus**:
  - 未认证请求访问受保护 API 返回 401 状态码和错误消息
  - 已认证请求正常访问受保护 API（返回 200 或业务逻辑状态码）
  - 公开 API（/api/auth/*, /api/export/*）无需认证即可访问
  - 验证所有受保护 API 路由文件都包含 auth() 检查逻辑
  - 边界情况：无效 token、过期 session、缺失 Authorization header

### Task 5: 移除冗余客户端重定向逻辑
- **ID**: task-5
- **type**: quick-fix
- **Description**: 检查并移除客户端组件中与 middleware.ts 功能重复的认证重定向代码（如 useEffect 中的 session 检查和 router.push），保留必要的客户端状态管理
- **File Scope**: components/**, app/**/page.tsx
- **Dependencies**: depends on task-3
- **Test Command**: `pnpm test -- tests/client/redundant-redirects.test.ts --coverage --coveragePathIgnorePatterns=/node_modules/`
- **Test Focus**:
  - 验证客户端组件不包含基于 session 的 router.push 重定向逻辑
  - 验证客户端状态管理（如 useSession）仍正常工作
  - 验证 UI 根据认证状态正确显示（登录/登出按钮、用户信息）
  - 验证移除冗余代码后页面渲染和交互功能正常

## 验收标准
- [ ] 所有受保护路由在未认证时重定向到 /auth/login
- [ ] 已认证用户访问 /auth/* 时重定向到首页
- [ ] app/proxy.ts 存在且不包含认证逻辑
- [ ] middleware.ts 已被删除
- [ ] 所有受保护 API 路由返回 401 给未认证请求
- [ ] 公开路由（/auth/*、/api/auth/*、/api/export/*）无需认证即可访问
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%
- [ ] 无客户端冗余重定向逻辑
- [ ] 现有功能（登录、登出、课程生成、管理后台）正常工作

## 技术要点
- **认证策略转变**: 从 Edge Middleware cookie 检查迁移到服务端 Layout Guard + API 路由级别的 auth() 调用
- **Next.js 16 规范**: proxy.ts 仅用于静态资源和代理配置，不处理业务逻辑
- **性能考虑**: 服务端 auth() 调用会增加每个受保护路由的响应时间，需确保 JWT 验证高效
- **向后兼容**: 保持 NextAuth 5 配置不变，仅改变认证检查的位置和方式
- **测试框架**: 使用 Jest + @testing-library/react 进行单元测试，模拟 NextAuth auth() 函数返回值
- **覆盖率要求**: 所有新增认证逻辑必须达到 90% 以上的代码覆盖率
