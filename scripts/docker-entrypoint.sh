#!/bin/sh
set -e

echo "🚀 Starting STEAM Lesson Agent..."

# 确保环境变量已加载
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set!"
  exit 1
fi

# 等待 PostgreSQL 就绪
echo "⏳ Waiting for PostgreSQL..."
until pg_isready -h postgres -p 5432 -U postgres >/dev/null 2>&1; do
  echo "   PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# 初始化数据库（仅 schema 变更，不会删除数据）
echo "🔄 Checking database schema..."
npx --yes prisma@7.2.0 db push --url "$DATABASE_URL" 2>&1 | tail -5 || echo "⚠️  Schema check completed with warnings"

echo "✅ Database initialized!"

# 启动应用
echo "🎯 Starting Next.js application..."
exec node server.js
