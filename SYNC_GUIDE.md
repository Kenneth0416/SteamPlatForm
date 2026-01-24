# 服务器到本地同步指南

## 快速同步

### 1. 导出服务器数据库

```bash
# 从服务器导出数据库
ssh root@45.76.144.212 "docker exec steam-lesson-db pg_dump -U postgres steam_lesson" > /tmp/steam_lesson_backup.sql
```

### 2. 重建本地数据库

```bash
# 删除旧数据库
docker exec steam-lesson-db psql -U postgres postgres -c "DROP DATABASE IF EXISTS steam_lesson;"

# 创建新数据库
docker exec steam-lesson-db psql -U postgres postgres -c "CREATE DATABASE steam_lesson;"
```

### 3. 导入数据到本地

```bash
# 导入数据
docker exec -i steam-lesson-db psql -U postgres steam_lesson < /tmp/steam_lesson_backup.sql
```

### 4. 启动本地开发环境

```bash
# 停止现有进程（如果有）
lsof -ti:3030 | xargs kill -9 2>/dev/null

# 启动开发服务器
pnpm dev
```

## 一键同步脚本

创建 `scripts/sync-from-server.sh`：

```bash
#!/bin/bash
set -e

SERVER="root@45.76.144.212"
BACKUP_FILE="/tmp/steam_lesson_backup.sql"

echo "🔄 从服务器同步数据到本地..."

# 1. 导出服务器数据库
echo "📦 导出服务器数据库..."
ssh $SERVER "docker exec steam-lesson-db pg_dump -U postgres steam_lesson" > $BACKUP_FILE

# 2. 备份本地数据
echo "💾 备份本地数据..."
docker exec steam-lesson-db pg_dump -U postgres steam_lesson > /tmp/local_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. 重建本地数据库
echo "🔨 重建本地数据库..."
docker exec steam-lesson-db psql -U postgres postgres -c "DROP DATABASE IF EXISTS steam_lesson;"
docker exec steam-lesson-db psql -U postgres postgres -c "CREATE DATABASE steam_lesson;"

# 4. 导入数据
echo "📥 导入服务器数据..."
docker exec -i steam-lesson-db psql -U postgres steam_lesson < $BACKUP_FILE

# 5. 验证数据
echo "✅ 验证数据..."
docker exec steam-lesson-db psql -U postgres steam_lesson -c "SELECT email, role FROM \"User\";"

# 6. 重启开发服务器
echo "🚀 重启开发服务器..."
lsof -ti:3030 | xargs kill -9 2>/dev/null || true
pnpm dev > /tmp/dev-server.log 2>&1 &
sleep 5
tail -20 /tmp/dev-server.log

echo "✅ 同步完成！"
echo "🌐 访问: http://localhost:3030"
echo "👤 管理员: admin@admin.com / admin123456"
```

使用方法：

```bash
chmod +x scripts/sync-from-server.sh
./scripts/sync-from-server.sh
```

## 双向同步（本地到服务器）

### 本地数据导出到服务器

```bash
# 1. 导出本地数据库
docker exec steam-lesson-db pg_dump -U postgres steam_lesson > /tmp/local_export.sql

# 2. 上传到服务器
scp /tmp/local_export.sql root@45.76.144.212:/tmp/

# 3. 在服务器上重建数据库
ssh root@45.76.144.212 << 'EOF'
docker exec steam-lesson-db psql -U postgres postgres -c "DROP DATABASE IF EXISTS steam_lesson;"
docker exec steam-lesson-db psql -U postgres postgres -c "CREATE DATABASE steam_lesson;"
docker exec -i steam-lesson-db psql -U postgres steam_lesson < /tmp/local_export.sql
EOF
```

## 当前状态

### 本地环境

- **开发服务器**: http://localhost:3030
- **PostgreSQL**: localhost:5433 (Docker)
- **数据库**: steam_lesson
- **用户**: admin@admin.com (admin)

### 服务器环境

- **生产地址**: http://45.76.144.212:3030
- **PostgreSQL**: Docker 容器
- **数据库**: steam_lesson
- **用户**: admin@admin.com (admin)

## 注意事项

1. **数据覆盖**: 同步操作会覆盖目标数据库，操作前请备份
2. **环境差异**: 本地使用 `.env.local`，服务器使用 `.env.docker.local`
3. **端口不同**: 本地 3030，服务器 3030
4. **API Keys**: 需要单独配置，不包含在数据库中

## 常见问题

### 数据库连接失败

```bash
# 检查本地数据库状态
docker ps | grep postgres

# 启动数据库（如果未运行）
docker compose up -d postgres
```

### 端口被占用

```bash
# 查找占用进程
lsof -ti:3030

# 杀死进程
lsof -ti:3030 | xargs kill -9
```

### 权限错误

```bash
# 确保脚本有执行权限
chmod +x scripts/sync-from-server.sh
```
