#!/bin/bash
# STEAM Lesson Agent 服务器一键部署脚本
# 在服务器上以 root 用户执行此脚本

set -e

echo "🚀 STEAM Lesson Agent 一键部署开始..."
echo "================================================"

# 配置变量
DEPLOY_DIR="/var/www/steam-lesson-agent"
DB_NAME="steam_lesson_agent"
DB_USER="steam_user"
DB_PASSWORD="Steam2026_$(openssl rand -hex 4)"
APP_PORT=3000

# 1. 安装 Node.js 20
echo ""
echo "📦 [1/8] 安装 Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "✅ Node.js: $(node --version)"

# 2. 安装 pnpm
echo ""
echo "📦 [2/8] 安装 pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi
echo "✅ pnpm: $(pnpm --version)"

# 3. 安装 PM2
echo ""
echo "📦 [3/8] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo "✅ PM2: $(pm2 --version)"

# 4. 安装 PostgreSQL
echo ""
echo "📦 [4/8] 安装 PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
    sleep 3
fi
echo "✅ PostgreSQL: $(psql --version | head -1)"

# 5. 配置数据库
echo ""
echo "🗄️  [5/8] 配置数据库..."
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF
echo "✅ 数据库创建完成"

# 6. 创建部署目录
echo ""
echo "📁 [6/8] 创建部署目录..."
mkdir -p $DEPLOY_DIR/logs
cd $DEPLOY_DIR

# 7. 生成环境变量文件
echo ""
echo "⚙️  [7/8] 生成环境变量..."
cat > .env.production << ENV_EOF
# 数据库
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"

# DeepSeek AI (需要手动填写)
DEEPSEEK_API_KEY="your_deepseek_api_key_here"
DEEPSEEK_MODEL="deepseek-chat"
DEEPSEEK_BASE_URL="https://api.deepseek.com"

# NextAuth
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://207.148.118.198:$APP_PORT"

# 应用配置
NODE_ENV="production"
PORT=$APP_PORT
ENV_EOF

echo "✅ 环境变量文件已创建: $DEPLOY_DIR/.env.production"

# 8. 显示后续步骤
echo ""
echo "================================================"
echo "✅ 服务器环境配置完成！"
echo ""
echo "📋 数据库信息："
echo "   DATABASE_URL: postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo ""
echo "⚠️  下一步操作："
echo ""
echo "1️⃣  编辑环境变量文件，填写 DEEPSEEK_API_KEY："
echo "   nano $DEPLOY_DIR/.env.production"
echo ""
echo "2️⃣  在本地电脑上传代码（在项目目录执行）："
echo "   rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' ./ root@207.148.118.198:$DEPLOY_DIR/"
echo ""
echo "3️⃣  返回服务器，安装依赖并启动："
echo "   cd $DEPLOY_DIR"
echo "   pnpm install"
echo "   npx prisma generate"
echo "   pnpm build"
echo "   npx prisma migrate deploy"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "4️⃣  访问应用："
echo "   http://207.148.118.198:$APP_PORT"
echo ""
echo "================================================"
