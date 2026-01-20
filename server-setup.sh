#!/bin/bash

# 服务器环境初始化脚本
# 在服务器上以 root 用户运行

set -e

echo "🚀 开始配置服务器环境..."

# 1. 更新系统
echo "📦 更新系统包..."
apt update

# 2. 安装 Node.js 20.x
echo "📦 安装 Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "✅ Node.js 版本: $(node --version)"

# 3. 安装 pnpm
echo "📦 安装 pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi
echo "✅ pnpm 版本: $(pnpm --version)"

# 4. 安装 PM2
echo "📦 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo "✅ PM2 版本: $(pm2 --version)"

# 5. 安装 PostgreSQL
echo "📦 安装 PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi
echo "✅ PostgreSQL 版本: $(psql --version)"

# 6. 配置 PostgreSQL 数据库
echo "🗄️  配置数据库..."
DB_NAME="steam_lesson_agent"
DB_USER="steam_user"
DB_PASSWORD="steam_secure_$(openssl rand -hex 8)"

sudo -u postgres psql << EOF
-- 删除已存在的数据库和用户（如果有）
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- 创建新用户和数据库
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

echo "✅ 数据库配置完成"
echo ""
echo "📝 数据库连接信息："
echo "DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public\""
echo ""
echo "⚠️  请保存上面的 DATABASE_URL，稍后配置环境变量时需要"

# 7. 创建部署目录
echo "📁 创建部署目录..."
mkdir -p /var/www/steam-lesson-agent
mkdir -p /var/www/steam-lesson-agent/logs

echo ""
echo "✅ 服务器环境配置完成！"
echo ""
echo "📋 下一步："
echo "1. 在本地运行: ./deploy.sh root 207.148.118.198 /var/www/steam-lesson-agent"
echo "2. 或手动上传代码到 /var/www/steam-lesson-agent"
