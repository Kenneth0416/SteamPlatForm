#!/bin/bash

# PostgreSQL 数据库初始化脚本
# 在服务器上运行此脚本来设置数据库

set -e

DB_NAME="steam_lesson_agent"
DB_USER="steam_user"
DB_PASSWORD=${1:-"your_secure_password"}

echo "🗄️  配置 PostgreSQL 数据库..."

# 检查 PostgreSQL 是否安装
if ! command -v psql &> /dev/null; then
    echo "📦 安装 PostgreSQL..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

# 创建数据库和用户
sudo -u postgres psql << EOF
-- 创建用户
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- 创建数据库
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;

\q
EOF

echo "✅ 数据库配置完成！"
echo "📝 数据库连接字符串："
echo "DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public\""
