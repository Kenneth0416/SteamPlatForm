#!/bin/bash
set -e

# ==========================================
# STEAM Lesson Platform - 远程部署脚本
# ==========================================

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 服务器配置
SERVER_HOST="root@45.76.144.212"
APP_DIR="/root/SteamPlatForm-main"
BACKUP_DIR="/root/backups/steam-lesson"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}STEAM Lesson Platform - 远程部署${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 检查本地是否有未提交的更改
echo -e "${YELLOW}📋 检查本地状态...${NC}"
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}❌ 有未提交的更改，请先提交或暂存${NC}"
    git status --short
    exit 1
fi
echo -e "${GREEN}✅ 本地状态干净${NC}"
echo ""

# 2. 备份远程数据库
echo -e "${YELLOW}💾 备份远程数据库...${NC}"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
ssh ${SERVER_HOST} "mkdir -p ${BACKUP_DIR}"
ssh ${SERVER_HOST} "docker exec steam-lesson-db pg_dump -U postgres steam_lesson | gzip > ${BACKUP_DIR}/${BACKUP_FILE}.gz"
echo -e "${GREEN}✅ 数据库已备份到: ${BACKUP_DIR}/${BACKUP_FILE}.gz${NC}"
echo ""

# 3. 停止远程服务
echo -e "${YELLOW}⏹️  停止远程服务...${NC}"
ssh ${SERVER_HOST} "cd ${APP_DIR} && docker-compose down"
echo -e "${GREEN}✅ 服务已停止${NC}"
echo ""

# 4. 拉取最新代码
echo -e "${YELLOW}📥 拉取最新代码...${NC}"
ssh ${SERVER_HOST} "cd ${APP_DIR} && git pull origin main"
echo -e "${GREEN}✅ 代码已更新${NC}"
echo ""

# 5. 重新构建镜像
echo -e "${YELLOW}🔨 重新构建 Docker 镜像...${NC}"
ssh ${SERVER_HOST} "cd ${APP_DIR} && docker-compose build --no-cache app"
echo -e "${GREEN}✅ 镜像构建完成${NC}"
echo ""

# 6. 启动服务
echo -e "${YELLOW}🚀 启动服务...${NC}"
ssh ${SERVER_HOST} "cd ${APP_DIR} && docker-compose up -d"
echo -e "${GREEN}✅ 服务已启动${NC}"
echo ""

# 7. 等待服务就绪
echo -e "${YELLOW}⏳ 等待服务就绪...${NC}"
sleep 10

# 8. 健康检查
echo -e "${YELLOW}🏥 健康检查...${NC}"
HEALTH_CHECK=$(ssh ${SERVER_HOST} "curl -s http://localhost:3030/api/health || echo 'failed'")
if echo "$HEALTH_CHECK" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅ 服务健康${NC}"
    echo "$HEALTH_CHECK" | grep -o '"checks":{[^}]*}' | head -1
else
    echo -e "${RED}❌ 健康检查失败${NC}"
    echo "$HEALTH_CHECK"
fi
echo ""

# 9. 显示日志
echo -e "${YELLOW}📋 最近的应用日志（LESSON_API）:${NC}"
ssh ${SERVER_HOST} "docker-compose logs --tail=20 app | grep -i 'LESSON_API\|error\|warning' || echo '无相关日志'"
echo ""

# 10. 运行数据库诊断
echo -e "${YELLOW}🔍 数据库统计...${NC}"
ssh ${SERVER_HOST} "cd ${APP_DIR} && ./scripts/diagnose-db.sh" || echo -e "${YELLOW}⚠️  诊断脚本执行失败${NC}"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✨ 部署完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "📍 应用地址: ${GREEN}http://45.76.144.212:3030${NC}"
echo -e "📊 健康检查: ${GREEN}http://45.76.144.212:3030/api/health${NC}"
echo ""
echo -e "${YELLOW}测试步骤:${NC}"
echo "1. 登录到应用"
echo "2. 创建或修改一个课件"
echo "3. 点击 'Save' 按钮"
echo "4. 刷新页面，确认数据还在"
echo "5. 重新登录，确认数据还在"
echo ""
echo -e "${YELLOW}查看实时日志:${NC}"
echo "ssh ${SERVER_HOST} \"cd ${APP_DIR} && docker-compose logs -f app\""
echo ""
echo -e "${YELLOW}回滚方案:${NC}"
echo "1. ssh ${SERVER_HOST}"
echo "2. cd ${APP_DIR}"
echo "3. git checkout <previous-commit>"
echo "4. docker-compose down"
echo "5. docker-compose build"
echo "6. docker-compose up -d"
echo "7. 恢复数据库: gunzip < ${BACKUP_DIR}/${BACKUP_FILE}.gz | docker exec -i steam-lesson-db psql -U postgres steam_lesson"
echo ""
