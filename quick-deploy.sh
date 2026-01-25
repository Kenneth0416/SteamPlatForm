#!/bin/bash
# 一键 Docker 部署 - 本地使用

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🐳 STEAM Lesson Agent - Docker 一键部署"
echo "======================================"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker 环境检查通过${NC}"

# 环境变量配置
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}📝 创建环境变量配置...${NC}"

    SECRET=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)

    cat > .env.local << EOF
# 数据库配置
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/steam_lesson?schema=public"

# NextAuth 配置
NEXTAUTH_SECRET="$SECRET"
NEXTAUTH_URL="http://localhost:3030"

# DeepSeek API
DEEPSEEK_API_KEY="your-api-key-here"
DEEPSEEK_MODEL="deepseek-chat"
EOF

    echo -e "${YELLOW}⚠️  请编辑 .env.local 填入 DEEPSEEK_API_KEY${NC}"
    ${EDITOR:-nano} .env.local
fi

# 停止旧容器
echo "🛑 停止旧容器..."
docker compose down 2>/dev/null || true

# 启动服务
echo "🚀 构建并启动服务..."
docker compose up -d --build

# 等待就绪
echo "⏳ 等待服务启动..."
sleep 10

# 检查状态
echo ""
docker compose ps

echo ""
echo -e "${GREEN}======================================"
echo "✅ 部署完成！"
echo "======================================${NC}"
echo ""
echo "📍 访问: http://localhost:3030"
echo "📋 日志: docker compose logs -f"
echo "🛑 停止: docker compose down"
echo ""
