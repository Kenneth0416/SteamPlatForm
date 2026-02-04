#!/bin/bash
set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SERVER="root@45.76.144.212"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}SSH 密钥配置向导${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# 1. 检查是否已有 SSH 密钥
echo -e "${YELLOW}📋 检查本地 SSH 密钥...${NC}"
if [ -f ~/.ssh/id_rsa.pub ]; then
    echo -e "${GREEN}✅ 发现已有的 RSA 密钥${NC}"
    PUB_KEY=$(cat ~/.ssh/id_rsa.pub)
elif [ -f ~/.ssh/id_ed25519.pub ]; then
    echo -e "${GREEN}✅ 发现已有的 Ed25519 密钥${NC}"
    PUB_KEY=$(cat ~/.ssh/id_ed25519.pub)
else
    echo -e "${YELLOW}⚠️  未找到 SSH 密钥，正在生成...${NC}"
    ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/id_ed25519 -N ""
    PUB_KEY=$(cat ~/.ssh/id_ed25519.pub)
    echo -e "${GREEN}✅ 新密钥已生成${NC}"
fi
echo ""
echo "你的公钥内容："
echo -e "${GREEN}$PUB_KEY${NC}"
echo ""

# 2. 测试 SSH 连接
echo -e "${YELLOW}📡 测试 SSH 连接到 ${SERVER}...${NC}"
if ssh -o ConnectTimeout=5 -o BatchMode=yes ${SERVER} "echo 'SSH 密钥已配置'" 2>/dev/null; then
    echo -e "${GREEN}✅ SSH 密钥已配置，可以免密登录${NC}"
    echo ""
    echo "测试连接："
    ssh ${SERVER} "hostname && whoami"
    exit 0
fi
echo -e "${YELLOW}⚠️  SSH 密钥未配置或密码未认证${NC}"
echo ""

# 3. 提供选项
echo "请选择配置方式："
echo "1. 自动复制（需要输入一次密码）"
echo "2. 手动复制（适合自动复制失败的情况）"
echo "3. 跳过"
echo ""
read -p "请输入选项 [1-3]: " choice

case $choice in
    1)
        echo -e "${YELLOW}📤 正在复制 SSH 公钥到服务器...${NC}"
        if ssh-copy-id -i ~/.ssh/id_ed25519.pub ${SERVER} 2>/dev/null || \
           ssh-copy-id -i ~/.ssh/id_rsa.pub ${SERVER} 2>/dev/null; then
            echo -e "${GREEN}✅ SSH 公钥复制成功${NC}"
        else
            echo -e "${RED}❌ 自动复制失败，请尝试手动复制${NC}"
            exit 1
        fi
        ;;
    2)
        echo ""
        echo -e "${YELLOW}📋 手动复制步骤：${NC}"
        echo ""
        echo "1. 打开终端，连接到服务器："
        echo -e "   ${GREEN}ssh ${SERVER}${NC}"
        echo ""
        echo "2. 输入密码登录"
        echo ""
        echo "3. 在服务器上执行以下命令："
        echo -e "   ${GREEN}mkdir -p ~/.ssh && chmod 700 ~/.ssh${NC}"
        echo -e "   ${GREEN}echo '${PUB_KEY}' >> ~/.ssh/authorized_keys${NC}"
        echo -e "   ${GREEN}chmod 600 ~/.ssh/authorized_keys${NC}"
        echo ""
        echo "4. 退出服务器："
        echo -e "   ${GREEN}exit${NC}"
        echo ""
        read -p "按 Enter 继续..."
        ;;
    3)
        echo -e "${YELLOW}⏭️  跳过 SSH 配置${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ 无效选项${NC}"
        exit 1
        ;;
esac

# 4. 验证配置
echo ""
echo -e "${YELLOW}🔍 验证 SSH 配置...${NC}"
if ssh -o ConnectTimeout=5 -o BatchMode=yes ${SERVER} "echo '连接成功'" 2>/dev/null; then
    echo -e "${GREEN}✅ SSH 密钥配置成功！${NC}"
    echo ""
    echo "现在可以免密登录到服务器："
    echo -e "${GREEN}ssh ${SERVER}${NC}"
    echo ""
    echo "测试连接："
    ssh ${SERVER} "hostname && whoami"
else
    echo -e "${RED}❌ SSH 配置验证失败${NC}"
    echo "请检查："
    echo "1. 公钥是否正确添加到服务器"
    echo "2. ~/.ssh/authorized_keys 权限是否为 600"
    echo "3. ~/.ssh 目录权限是否为 700"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✨ 配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
