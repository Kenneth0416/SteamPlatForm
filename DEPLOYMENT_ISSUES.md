# Docker 部署问题记录

## 已修复的问题

### 1. Prisma CLI 路径问题
**错误：** `node_modules/.bin/prisma: not found`

**原因：** Docker standalone 模式下，node_modules 结构不同

**解决：** 使用 `npx prisma` 替代直接调用

```bash
# ❌ 错误
node_modules/.bin/prisma db push

# ✅ 正确
npx prisma db push
```

### 2. Prisma --skip-generate 选项不支持
**错误：** `unknown or unexpected option: --skip-generate`

**原因：** Prisma 7.2.0 移除了该选项

**解决：** 移除该选项，首次部署使用 `--accept-data-loss`

```bash
# ❌ 错误
npx prisma db push --skip-generate

# ✅ 正确
npx prisma db push --accept-data-loss
```

### 3. Prisma 无法读取 DATABASE_URL
**错误：** `The datasource.url property is required in your Prisma config file`

**原因：** prisma.config.ts 加载 .env.local，但 Docker 容器中不存在

**解决：** 使用 `--url` 参数直接传递环境变量

```bash
# ✅ 正确
npx prisma db push --accept-data-loss --url "$DATABASE_URL"
```

### 4. 用户角色大小写问题
**现象：** 管理员登录后看不到管理界面

**原因：** 代码检查 `role === "admin"`（小写），数据库设置的是 `"ADMIN"`（大写）

**解决：** 数据库使用小写 `admin`，与代码一致

```sql
-- 设置管理员角色（小写）
UPDATE "User" SET role = 'admin' WHERE email = 'admin@admin.com';
```

## 部署环境要求

### 最低配置
- **内存：** 2GB（1GB 会在 Next.js 构建时 OOM）
- **CPU：** 1 核
- **磁盘：** 10GB 可用空间
- **系统：** Linux (推荐 Ubuntu/Debian/Alpine)

### 软件依赖
- Docker 24.0+
- Docker Compose v5.0+

## 快速部署步骤

```bash
# 1. 上传项目文件
tar czf steamplatform.tar.gz steamplatform/
scp steamplatform.tar.gz root@your-server:/root/
ssh root@your-server "tar xzf steamplatform.tar.gz && cd steamplatform"

# 2. 配置环境变量
cat > .env.docker.local << EOF
NODE_ENV=production
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/steam_lesson?schema=public"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://your-server-ip:3030"
AUTH_TRUST_HOST=true
DEEPSEEK_API_KEY="your_api_key_here"
EOF

# 3. 构建并启动
docker compose build
docker compose up -d

# 4. 检查状态
docker ps
docker logs steam-lesson-app

# 5. 使用默认管理员登录
# Email: admin@admin.com
# Password: admin123456
# ⚠️  首次登录后请立即修改密码！
```

## 常用运维命令

```bash
# 查看日志
docker logs steam-lesson-app -f

# 重启应用
docker compose restart app

# 查看资源占用
docker stats steam-lesson-app steam-lesson-db

# 进入容器调试
docker exec -it steam-lesson-app sh

# 数据库备份
docker exec steam-lesson-db pg_dump -U postgres steam_lesson > backup.sql

# 手动运行数据库种子（如果需要）
docker exec steam-lesson-app npx prisma db seed --url "$DATABASE_URL"

# 手动创建管理员（如果自动创建失败）
docker exec steam-lesson-app npx tsxE prisma/seed.ts
```

## 健康检查

```bash
# 应用健康检查
curl http://localhost:3030/api/health

# 应返回
# {"status":"ok","timestamp":"...","service":"steam-lesson-agent"}
```

## 防火墙配置

```bash
# 开放端口
iptables -I INPUT -p tcp --dport 3030 -j ACCEPT

# 保存规则（根据系统选择）
# Debian/Ubuntu
iptables-save > /etc/iptables/rules.v4

# RHEL/CentOS
service iptables save
```

## 自动创建管理员

### 默认管理员账户

首次部署时，系统会自动创建默认管理员账户：

```
Email: admin@admin.com
Password: admin123456
Role: admin
```

**安全提示：** 首次登录后请立即修改密码！

### 工作原理

1. **初始化脚本**：`prisma/seed.ts` 在容器启动时自动运行
2. **幂等性设计**：如果管理员已存在，脚本会跳过创建
3. **执行时机**：在 `docker-entrypoint.sh` 中数据库初始化后执行

### 查看日志

```bash
# 查看种子执行日志
docker logs steam-lesson-app | grep -A 5 "Seeding database"

# 成功输出示例
# 🌱 Seeding database...
# ✅ Default admin user created successfully!
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📧 Email: admin@admin.com
# 🔑 Password: admin123456
# ⚠️  IMPORTANT: Please change the password after first login!
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 手动运行（可选）

如果自动创建失败，可以手动运行：

```bash
# 方法1：使用 Prisma seed
docker exec steam-lesson-app npx prisma db seed --url "$DATABASE_URL"

# 方法2：直接运行 TypeScript
docker exec -it steam-lesson-app sh
cd /app
npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed.ts
```

## 下次部署检查清单

- [ ] 确认服务器内存 >= 2GB
- [ ] Docker 和 Docker Compose 已安装
- [ ] .env.docker.local 文件已配置
- [ ] DEEPSEEK_API_KEY 已设置
- [ ] 防火墙端口 3030 已开放
- [ ] docker-entrypoint.sh 包含 seed 执行步骤
- [ ] 记录默认管理员凭据（admin@admin.com / admin123456）

## 故障排查

### 容器不断重启
```bash
# 查看错误日志
docker logs steam-lesson-app

# 常见原因：
# 1. DATABASE_URL 未设置
# 2. 数据库连接失败
# 3. 端口冲突
```

### 应用无法访问
```bash
# 检查容器状态
docker ps

# 检查端口映射
docker port steam-lesson-app

# 检查防火墙
iptables -L INPUT -n | grep 3030
```

### 数据库初始化失败
```bash
# 手动执行数据库同步
docker exec steam-lesson-app npx prisma db push --url "$DATABASE_URL"

# 查看数据库日志
docker logs steam-lesson-db
```
