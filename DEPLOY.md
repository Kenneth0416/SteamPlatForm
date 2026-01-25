# 部署指南 - 快速上手

## 🚀 最简单方案：Vercel（推荐）

### 步骤

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **登录并部署**
   ```bash
   vercel login
   vercel
   ```

3. **在 Vercel Dashboard 设置环境变量**
   ```
   DATABASE_URL=postgresql://...
   NEXTAUTH_SECRET=随机生成的密钥
   DEEPSEEK_API_KEY=你的API密钥
   ```

4. **之后每次更新只需**
   ```bash
   git push
   ```

---

## 🐳 Docker 本地部署

### 一键启动

```bash
./quick-deploy.sh
```

或手动操作：

```bash
# 1. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入必要配置

# 2. 启动服务
docker compose up -d --build

# 3. 查看日志
docker compose logs -f app
```

---

## 🌐 服务器部署

### 方式 1: GitHub Actions（自动化）

1. **配置 Secrets** (在 GitHub Repo Settings)
   - `SERVER_HOST`: 服务器 IP
   - `SERVER_USER`: SSH 用户名
   - `SSH_PRIVATE_KEY`: SSH 私钥

2. **推送代码自动部署**
   ```bash
   git push origin main
   ```

### 方式 2: 手动部署

```bash
# 1. 使用部署脚本
./deploy.sh root 207.148.118.198 /var/www/steam-lesson-agent

# 2. 或手动操作
ssh root@your-server
cd /var/www/steam-lesson-agent
pnpm install
pnpm build
npx prisma migrate deploy
pm2 restart steam-lesson-agent
```

---

## 🔧 常见问题

### 端口被占用
```bash
lsof -ti:3030 | xargs kill -9
```

### 数据库连接失败
```bash
# 重置数据库
docker compose down -v
docker compose up -d
```

### 容器不断重启
```bash
# 查看错误日志
docker logs steam-lesson-app

# 常见原因：环境变量缺失、数据库未就绪
```

---

## 📊 推荐方案对比

| 方案 | 难度 | 成本 | 自动化 | 适合场景 |
|------|------|------|--------|----------|
| **Vercel** | ⭐ | 免费 | ✅ | 快速开发/演示 |
| **Docker 本地** | ⭐⭐ | 0 | ❌ | 本地开发 |
| **GitHub Actions + Docker** | ⭐⭐⭐ | 服务器 | ✅ | 生产环境 |
| **传统 PM2** | ⭐⭐⭐⭐ | 服务器 | ❌ | 不推荐 |
