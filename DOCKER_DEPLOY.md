# 🐳 STEAM Lesson Agent - Docker 部署指南

## 📋 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB 可用内存

## 🚀 快速开始

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp .env.docker .env.docker.local

# 编辑配置文件
nano .env.docker.local
```

**必须修改的配置：**

```bash
# 生成随机密钥
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# 修改为你的域名
NEXTAUTH_URL="https://yourdomain.com"

# 填入 DeepSeek API 密钥
DEEPSEEK_API_KEY="sk-your-api-key"
```

### 2. 构建并启动

```bash
# 构建镜像并启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f app
```

### 3. 访问应用

- 应用地址：http://localhost:3030
- 健康检查：http://localhost:3030/api/health

## 📦 Docker 镜像优化

### 镜像体积

- **基础镜像**: Node 20-alpine (~40MB)
- **构建后**: ~180MB（多阶段构建 + 生产依赖）
- **优化点**:
  - 利用层缓存（package.json 优先复制）
  - standalone 输出模式（仅包含必需文件）
  - 非 root 用户运行

### 构建性能

```bash
# 使用 BuildKit 加速构建
DOCKER_BUILDKIT=1 docker build -t steam-lesson-app .

# 查看镜像层级
docker history steam-lesson-app
```

## 🛠 常用命令

### 服务管理

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启应用（不影响数据库）
docker compose restart app

# 查看服务状态
docker compose ps

# 查看实时日志
docker compose logs -f app
```

### 数据库管理

```bash
# 进入数据库容器
docker compose exec postgres psql -U postgres -d steam_lesson

# 备份数据库
docker compose exec postgres pg_dump -U postgres steam_lesson > backup.sql

# 恢复数据库
docker compose exec -T postgres psql -U postgres steam_lesson < backup.sql

# 执行数据库迁移
docker compose exec app npx prisma migrate deploy
```

### 调试

```bash
# 进入应用容器
docker compose exec app sh

# 查看环境变量
docker compose exec app env | grep NEXTAUTH

# 检查数据库连接
docker compose exec app npx prisma db push --skip-generate
```

## 🔧 生产环境配置

### 1. 使用外部数据库

修改 `docker-compose.yml`，移除 postgres 服务，更新 `.env.docker.local`：

```bash
DATABASE_URL="postgresql://user:pass@external-db-host:5432/dbname?schema=public"
```

### 2. 反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. SSL 证书（Let's Encrypt）

```bash
# 安装 Certbot
apt install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d yourdomain.com
```

### 4. 资源限制

在 `docker-compose.yml` 的 app 服务添加：

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

## 🔐 安全最佳实践

1. **更新密钥**：定期轮换 `NEXTAUTH_SECRET`
2. **限制端口**：仅暴露必要端口（3030）
3. **防火墙配置**：
   ```bash
   ufw allow 3030/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ```
4. **定期更新镜像**：
   ```bash
   docker compose pull
   docker compose up -d
   ```

## 🩺 健康检查

Docker Compose 自动配置了健康检查：

- **数据库**: 每 10 秒检查 PostgreSQL 是否就绪
- **应用**: 每 30 秒访问 `/api/health` 端点
- **启动等待**: 应用启动后等待 60 秒才开始检查

### 手动检查

```bash
# 检查容器健康状态
docker compose ps

# 测试健康检查端点
curl http://localhost:3030/api/health
```

## 📊 监控和日志

### 查看日志

```bash
# 所有服务日志
docker compose logs -f

# 仅应用日志
docker compose logs -f app

# 最近 100 行
docker compose logs --tail=100 app
```

### 持久化日志

修改 `docker-compose.yml` 添加日志配置：

```yaml
app:
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

## 🔄 更新和维护

### 更新应用代码

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像
docker compose build app

# 3. 重启服务
docker compose up -d app

# 4. 检查日志
docker compose logs -f app
```

### 数据库迁移

```bash
# 应用会在启动时自动执行 prisma migrate deploy
# 手动执行：
docker compose exec app npx prisma migrate deploy
```

## ❓ 故障排查

### 应用无法启动

```bash
# 检查日志
docker compose logs app

# 常见问题：
# 1. 数据库未就绪 → 检查 postgres 服务状态
# 2. 环境变量缺失 → 验证 .env.docker.local
# 3. 端口被占用 → lsof -i :3030
```

### 数据库连接失败

```bash
# 测试数据库连接
docker compose exec postgres pg_isready -U postgres

# 检查网络
docker network inspect steamplatform-main_steam-network

# 验证环境变量
docker compose exec app env | grep DATABASE_URL
```

### 镜像构建失败

```bash
# 清理缓存重新构建
docker compose build --no-cache app

# 检查 Dockerfile
docker build -t test-build .
```

## 📝 注意事项

1. **首次启动较慢**：需要构建镜像和执行数据库迁移（~2-5 分钟）
2. **数据持久化**：数据库数据存储在 Docker volume `postgres_data`
3. **端口映射**：
   - 应用：3030（外部） → 3030（容器）
   - 数据库：5433（外部） → 5432（容器）
4. **环境变量优先级**：`.env.docker.local` > `.env.docker` > `.env`

## 🆚 对比传统部署

| 维度 | Docker 部署 | 传统部署 |
|------|------------|---------|
| 环境一致性 | ✅ 完全一致 | ⚠️ 易出差异 |
| 部署速度 | ✅ 一键启动 | ⚠️ 需配置环境 |
| 隔离性 | ✅ 容器隔离 | ❌ 共享宿主机 |
| 资源开销 | ⚠️ 额外容器开销 | ✅ 直接运行 |
| 维护成本 | ✅ 统一管理 | ⚠️ 分散配置 |

## 🔗 相关资源

- [Docker 官方文档](https://docs.docker.com/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma in Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)
