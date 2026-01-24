#!/bin/sh
# ==========================================
# STEAM Lesson Agent - 诊断脚本
# ==========================================

echo "=========================================="
echo "🔍 STEAM Lesson Agent 诊断"
echo "=========================================="
echo ""

# 1. 容器状态
echo "📦 1. 容器状态"
docker compose ps
echo ""

# 2. 应用日志（最近 50 行）
echo "📋 2. 应用日志（最近 50 行）"
docker compose logs app --tail=50
echo ""

# 3. 数据库连接测试
echo "🗄️  3. 数据库连接测试"
docker compose exec postgres pg_isready -U postgres
echo ""

# 4. 数据库表结构检查
echo "📊 4. 数据库表结构"
docker compose exec postgres psql -U postgres -d steam_lesson -c "\dt"
echo ""

# 5. 环境变量检查
echo "🔧 5. 环境变量"
docker compose exec app env | grep -E "(DATABASE_URL|NEXTAUTH|NODE_ENV|PORT)"
echo ""

# 6. Prisma Client 检查
echo "🤖 6. Prisma Client"
docker compose exec app ls -la node_modules/.bin/prisma 2>/dev/null || echo "Prisma binary not found"
echo ""

# 7. 测试注册 API
echo "🧪 7. 测试注册 API"
curl -X POST http://localhost:3030/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@diagnostic.com","name":"Diagnostic Test","password":"test123456"}' \
  -v 2>&1 | tail -20
echo ""

# 8. 进入应用容器检查
echo "📂 8. 应用容器文件结构"
docker compose exec app ls -la /app
echo ""

echo "=========================================="
echo "✅ 诊断完成"
echo "=========================================="
