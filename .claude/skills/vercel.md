---
name: vercel
description: Vercel 平台部署配置和流程
---

# Vercel 部署

## 关键文件

- `vercel.json` - Vercel 构建配置
- `lib/prisma.ts` - Prisma 客户端（支持 Vercel serverless）
- `prisma.config.ts` - Prisma 配置（环境感知）
- `VERCEL_DEPLOY.md` - 完整部署指南

## 快速部署

```bash
# 1. 安装 CLI
npm i -g vercel

# 2. 登录并部署
vercel login
vercel

# 3. 配置环境变量（在 Dashboard）
# DATABASE_URL, NEXTAUTH_SECRET, DEEPSEEK_API_KEY
```

## Vercel 关键配置

**vercel.json**:
```json
{
  "buildCommand": "prisma generate && next build",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "nextjs"
}
```

**lib/prisma.ts**:
- 检测 `process.env.VERCEL`
- Serverless 环境跳过连接池
- 本地开发使用连接池优化

## 环境变量清单

| 变量 | 必需 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串 |
| `NEXTAUTH_SECRET` | ✅ | 随机 32 字符 |
| `NEXTAUTH_URL` | ✅ | Vercel 域名 |
| `AUTH_TRUST_HOST` | ✅ | 设置为 `1` |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API |
| `DEEPSEEK_MODEL` | ❌ | 默认 deepseek-chat |
| `DEEPSEEK_BASE_URL` | ❌ | 默认 api.deepseek.com |

## 数据库

**推荐**: Vercel Postgres
```bash
vercel postgres create
```

**备选**: Supabase, Neon, Railway

## 数据库迁移

```bash
# 部署后推送 schema
npx prisma db push --schema=prisma/schema.prisma
```

## 常见问题

**Prisma Client 未初始化**: 确保 `buildCommand` 包含 `prisma generate`

**数据库连接失败**: 检查 `DATABASE_URL` 格式，Vercel Postgres 需要 `?sslmode=require`

**构建超时**: 使用 Vercel Postgres 避免外部连接延迟

## 自动部署

配置后，每次 `git push origin main` 自动触发部署。
