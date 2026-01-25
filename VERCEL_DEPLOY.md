# Vercel 部署指南

## 🚀 快速部署（推荐）

### 步骤 1: 安装 Vercel CLI

```bash
npm i -g vercel
```

### 步骤 2: 登录并部署

```bash
vercel login
vercel
```

按提示操作：
- 选择 Set up and deploy → Continue
- 项目名称：`steam-platform`
- 范围：Yes
- 框架：Next.js
- 根目录：默认

### 步骤 3: 配置环境变量

在 [Vercel Dashboard](https://vercel.com/dashboard) 设置以下环境变量：

```bash
# 必需
DATABASE_URL=postgresql://user:password@host:5432/dbname
NEXTAUTH_SECRET=随机生成32字符密钥
NEXTAUTH_URL=https://your-domain.vercel.app

# DeepSeek API
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

### 步骤 4: 设置数据库

**选项 A: Vercel Postgres（推荐）**

1. 在 Vercel Dashboard → Storage → Create Database
2. 选择 Postgres
3. 选择区域（离用户最近）
4. Vercel 会自动设置 `DATABASE_URL`

**选项 B: 外部 PostgreSQL**

使用 Supabase、Neon、Railway 等服务。

---

## 🔧 Vercel Postgres 配置

### 创建数据库

```bash
# Vercel CLI
vercel postgres create
```

### 连接字符串格式

```
postgresql://[user]:[password]@[host]/[dbname]?sslmode=require
```

---

## 📋 部署检查清单

### 部署前

- [ ] `package.json` 中 `build` 脚本包含 `prisma generate`
- [ ] `next.config.mjs` 设置 `output: 'standalone'`
- [ ] `.gitignore` 不包含 `.env.local`（已验证✅）
- [ ] 项目使用 pnpm（已配置✅）

### 环境变量

- [ ] `DATABASE_URL` - PostgreSQL 连接字符串
- [ ] `NEXTAUTH_SECRET` - 随机生成
- [ ] `NEXTAUTH_URL` - Vercel 域名
- [ ] `AUTH_TRUST_HOST` - 设置为 `1`
- [ ] `DEEPSEEK_API_KEY` - DeepSeek API 密钥

### 数据库迁移

部署后运行：

```bash
# 在本地终端
npx prisma db push

# 或通过 Vercel CLI
vercel env pull
vercel env add POSTGRES_URL ...
```

---

## 🔄 自动部署

配置后，每次 `git push` 都会自动部署。

```bash
git add .
git commit -m "update"
git push origin main
```

---

## ❓ 常见问题

### Prisma Client 错误

```
Error: @prisma/client did not initialize yet
```

**解决**: 确保 `postinstall` 脚本包含 `prisma generate`

### 数据库连接失败

```
Error: Can't reach database server
```

**解决**: 检查 Vercel Postgres 已创建，`DATABASE_URL` 正确

### 构建失败

```
Error: Cannot find module '@prisma/client'
```

**解决**: 确保 `buildCommand` 以 `prisma generate` 开头

---

## 📚 参考

- [Prisma + Next.js 官方指南](https://www.prisma.io/docs/guides/nextjs)
- [Vercel KB: Next.js + Prisma](https://vercel.com/kb/guide/nextjs-prisma-postgres)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)
