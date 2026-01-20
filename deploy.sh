#!/bin/bash

# STEAM Lesson Agent 部署脚本
# 使用方法: ./deploy.sh [SSH_USER] [SERVER_IP] [DEPLOY_PATH]

set -e

SSH_USER=${1:-root}
SERVER_IP=${2:-207.148.118.198}
DEPLOY_PATH=${3:-/var/www/steam-lesson-agent}
APP_PORT=${4:-3000}

echo "🚀 开始部署到 $SSH_USER@$SERVER_IP:$DEPLOY_PATH"

# 1. 检查服务器连接
echo "📡 检查服务器连接..."
ssh $SSH_USER@$SERVER_IP "echo '连接成功'"

# 2. 创建部署目录
echo "📁 创建部署目录..."
ssh $SSH_USER@$SERVER_IP "mkdir -p $DEPLOY_PATH"

# 3. 同步代码（排除 node_modules 和 .next）
echo "📦 同步代码到服务器..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'coverage' \
  --exclude '.env.local' \
  ./ $SSH_USER@$SERVER_IP:$DEPLOY_PATH/

# 4. 在服务器上执行部署命令
echo "🔧 在服务器上安装依赖并构建..."
ssh $SSH_USER@$SERVER_IP << EOF
  cd $DEPLOY_PATH

  # 检查 Node.js
  if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
  fi

  # 检查 pnpm
  if ! command -v pnpm &> /dev/null; then
    echo "📦 安装 pnpm..."
    npm install -g pnpm
  fi

  # 检查 PM2
  if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
  fi

  # 安装依赖
  echo "📦 安装项目依赖..."
  pnpm install --prod=false

  # 生成 Prisma Client
  echo "🔨 生成 Prisma Client..."
  npx prisma generate

  # 构建应用
  echo "🏗️  构建应用..."
  pnpm build

  # 运行数据库迁移
  echo "🗄️  运行数据库迁移..."
  npx prisma migrate deploy

  # 使用 PM2 启动/重启应用
  echo "🚀 启动应用..."
  pm2 delete steam-lesson-agent 2>/dev/null || true
  pm2 start ecosystem.config.js
  pm2 save

  # 设置 PM2 开机自启
  pm2 startup systemd -u $SSH_USER --hp /home/$SSH_USER 2>/dev/null || true

  echo "✅ 部署完成！"
  echo "📊 应用状态："
  pm2 status
EOF

echo ""
echo "✅ 部署成功！"
echo "🌐 应用地址: http://$SERVER_IP:$APP_PORT"
echo "📊 查看日志: ssh $SSH_USER@$SERVER_IP 'pm2 logs steam-lesson-agent'"
echo "🔄 重启应用: ssh $SSH_USER@$SERVER_IP 'pm2 restart steam-lesson-agent'"
