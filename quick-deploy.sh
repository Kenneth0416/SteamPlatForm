#!/bin/bash
# 快速部署到远程服务器
# 
# 使用方法：
#   1. 确保你有 SSH 访问权限到 root@45.76.144.212
#   2. 在本地项目目录执行: ./quick-deploy.sh

set -e

echo "🚀 开始部署到远程服务器..."
echo ""

# 检查 SSH 连接
echo "📡 测试 SSH 连接..."
if ! ssh -o ConnectTimeout=5 root@45.76.144.212 "echo 'SSH 连接成功'" 2>/dev/null; then
    echo "❌ 无法连接到服务器 root@45.76.144.212"
    echo "请检查："
    echo "1. SSH 密钥是否配置"
    echo "2. 服务器是否可访问"
    echo "3. 网络连接是否正常"
    exit 1
fi
echo "✅ SSH 连接正常"
echo ""

# 执行远程部署脚本
echo "📦 执行远程部署..."
./deploy-remote.sh

echo ""
echo "✨ 部署流程完成！"
echo ""
echo "📍 访问应用: http://45.76.144.212:3030"
echo "📊 健康检查: http://45.76.144.212:3030/api/health"
