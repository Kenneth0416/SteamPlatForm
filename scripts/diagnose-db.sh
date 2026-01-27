#!/bin/bash
set -e

echo "🔍 STEAM Lesson Platform - Database Diagnostics"
echo "=============================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Docker 是否运行
echo "📦 Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# 检查容器状态
echo "🐳 Checking containers..."
CONTAINERS=$(docker ps -a --filter "name=steam" --format "{{.Names}}: {{.Status}}")
if [ -z "$CONTAINERS" ]; then
    echo -e "${YELLOW}⚠️  No STEAM containers found${NC}"
else
    echo "$CONTAINERS"
fi
echo ""

# 检查数据库连接
echo "🗄️  Testing database connection..."
DB_CONTAINER=$(docker ps -q -f name=steam-lesson-db)
if [ -z "$DB_CONTAINER" ]; then
    echo -e "${RED}❌ Database container is not running${NC}"
    echo "Run: docker-compose up -d postgres"
else
    echo -e "${GREEN}✅ Database container is running${NC}"
    
    # 检查数据库连接
    if docker exec steam-lesson-db pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is accepting connections${NC}"
    else
        echo -e "${RED}❌ Database is not ready${NC}"
    fi
    
    # 检查数据库和表
    echo ""
    echo "📊 Database stats:"
    docker exec steam-lesson-db psql -U postgres -d steam_lesson -c "
        SELECT 
            'users' as table_name, COUNT(*) as count FROM \"User\"
        UNION ALL
        SELECT 
            'lessons' as table_name, COUNT(*) as count FROM \"Lesson\"
        UNION ALL
        SELECT 
            'document_blocks' as table_name, COUNT(*) as count FROM \"DocumentBlock\"
        UNION ALL
        SELECT 
            'document_versions' as table_name, COUNT(*) as count FROM \"DocumentVersion\"
        UNION ALL
        SELECT 
            'edit_history' as table_name, COUNT(*) as count FROM \"EditHistory\"
        UNION ALL
        SELECT 
            'editor_documents' as table_name, COUNT(*) as count FROM \"EditorDocument\";
    " 2>/dev/null || echo -e "${YELLOW}⚠️  Could not query table counts${NC}"
    
    # 检查最近的课程
    echo ""
    echo "📚 Recent lessons (last 5):"
    docker exec steam-lesson-db psql -U postgres -d steam_lesson -c "
        SELECT 
            id, 
            substring(title, 1, 30) as title,
            user_id,
            created_at::text,
            updated_at::text
        FROM \"Lesson\"
        ORDER BY updated_at DESC
        LIMIT 5;
    " 2>/dev/null || echo -e "${YELLOW}⚠️  Could not query recent lessons${NC}"
fi

echo ""
echo "=============================================="
echo "✨ Diagnostics complete"
