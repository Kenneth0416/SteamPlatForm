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
