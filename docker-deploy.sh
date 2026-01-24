#!/bin/bash
# STEAM Lesson Agent - Docker 快速部署脚本

set -e

echo "🐳 STEAM Lesson Agent - Docker 快速部署"
echo "========================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 检查环境变量文件
if [ ! -f .env.docker ]; then
    echo "❌ .env.docker 文件不存在"
    exit 1
fi

# 创建本地配置（如果不存在）
if [ ! -f .env.docker.local ]; then
    echo "📝 创建本地环境变量配置..."
    cp .env.docker .env.docker.local

    # 生成随机 NEXTAUTH_SECRET
    SECRET=$(openssl rand -base64 32)
    sed -i.bak "s/CHANGE_ME_TO_RANDOM_32_CHARS_STRING_IN_PRODUCTION/$SECRET/g" .env.docker.local
    rm -f .env.docker.local.bak

    echo "⚠️  请编辑 .env.docker.local 填入以下配置："
    echo "   - NEXTAUTH_URL: 你的域名"
    echo "   - DEEPSEEK_API_KEY: DeepSeek API 密钥"
    echo ""
    read -p "是否立即编辑配置文件？(y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env.docker.local
    else
        echo "⏸️  请手动编辑 .env.docker.local 后再运行此脚本"
        exit 0
    fi
fi

# 更新 docker-compose.yml 使用本地配置
if ! grep -q ".env.docker.local" docker-compose.yml; then
    echo "🔧 更新 docker-compose.yml 使用本地配置..."
    sed -i.bak 's/\.env\.docker/.env.docker.local/g' docker-compose.yml
    rm -f docker-compose.yml.bak
fi

# 构建镜像
echo "🏗️  构建 Docker 镜像..."
docker compose build

# 启动服务
echo "🚀 启动服务..."
docker compose up -d

# 等待服务就绪
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态："
docker compose ps

# 等待健康检查
echo ""
echo "🩺 等待健康检查（最多等待 2 分钟）..."
for i in {1..24}; do
    if curl -s http://localhost:3030/api/health > /dev/null 2>&1; then
        echo "✅ 应用已就绪！"
        break
    fi
    echo "   检查中... ($i/24)"
    sleep 5
done

# 显示访问信息
echo ""
echo "========================================"
echo "✅ 部署完成！"
echo ""
echo "📍 访问地址："
echo "   应用: http://localhost:3030"
echo "   健康检查: http://localhost:3030/api/health"
echo ""
echo "📝 常用命令："
echo "   查看日志: docker compose logs -f app"
echo "   停止服务: docker compose down"
echo "   重启应用: docker compose restart app"
echo ""
echo "📖 详细文档: DOCKER_DEPLOY.md"
echo "========================================"
