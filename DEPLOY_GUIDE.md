# 快速部署指南 - 数据丢失修复

## 一键部署（推荐）

在**本地机器**上执行：

```bash
./deploy-remote.sh
```

脚本会自动完成：
1. ✅ 备份远程数据库
2. ✅ 停止服务
3. ✅ 拉取最新代码
4. ✅ 重新构建镜像
5. ✅ 启动服务
6. ✅ 健康检查
7. ✅ 显示日志

---

## 手动部署（如果一键脚本失败）

### 1. 连接到服务器
```bash
ssh root@45.76.144.212
```

### 2. 进入项目目录
```bash
cd /root/SteamPlatForm-main
```

### 3. 备份数据库（⚠️ 重要！）
```bash
# 创建备份目录
mkdir -p /root/backups/steam-lesson

# 备份数据库
docker exec steam-lesson-db pg_dump -U postgres steam_lesson | \
  gzip > /root/backups/steam-lesson/backup_$(date +%Y%m%d_%H%M%S).sql.gz

# 确认备份成功
ls -lh /root/backups/steam-lesson/
```

### 4. 拉取最新代码
```bash
git pull origin main
```

### 5. 停止现有服务
```bash
docker-compose down
```

### 6. 重新构建镜像
```bash
docker-compose build --no-cache app
```

### 7. 启动服务
```bash
docker-compose up -d
```

### 8. 查看启动日志
```bash
docker-compose logs -f app
```

等待看到类似以下的日志：
```
✅ PostgreSQL is ready!
🎯 Starting Next.js application...
✅ Server ready on http://0.0.0.0:3030
```

按 `Ctrl+C` 退出日志查看。

### 9. 验证部署

#### 9.1 健康检查
```bash
curl http://localhost:3030/api/health
```

预期输出：
```json
{
  "status": "healthy",
  "timestamp": "2026-01-27T...",
  "checks": {
    "database": {
      "status": "healthy",
      "details": {
        "message": "Database connection successful",
        "userCount": 5,
        "lessonCount": 23
      }
    }
  }
}
```

#### 9.2 运行数据库诊断
```bash
./scripts/diagnose-db.sh
```

#### 9.3 测试保存功能
1. 打开浏览器访问：http://45.76.144.212:3030
2. 登录你的账号
3. 创建或修改一个课件
4. 点击"Save"按钮
5. **检查浏览器控制台无错误**
6. 刷新页面 → 数据应该还在
7. 退出登录并重新登录 → 数据应该还在

### 10. 监控保存日志
```bash
docker-compose logs -f app | grep LESSON_API
```

保存成功时应该看到：
```
[LESSON_API] Update request: { lessonId: '...', userId: '...', ... }
[LESSON_API] Update successful: { lessonId: '...', userId: '...', ... }
```

---

## 故障排查

### 问题 1：拉取代码失败
```bash
# 检查 git 状态
git status

# 如果有本地修改，先提交或暂存
git stash
git pull origin main
```

### 问题 2：构建失败
```bash
# 清理 Docker 缓存
docker system prune -a

# 重新构建
docker-compose build --no-cache
```

### 问题 3：服务启动失败
```bash
# 查看详细日志
docker-compose logs app

# 检查数据库连接
docker-compose logs postgres

# 检查环境变量
cat .env.docker.local
```

### 问题 4：数据丢失
```bash
# 从备份恢复
cd /root/backups/steam-lesson
gunzip < backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i steam-lesson-db psql -U postgres steam_lesson
```

### 问题 5：健康检查失败
```bash
# 检查容器状态
docker-compose ps

# 检查数据库连接
docker exec steam-lesson-db pg_isready -U postgres

# 重启服务
docker-compose restart app
```

---

## 验证修复是否生效

### 测试 1：编辑器保存
1. 访问编辑器页面
2. 修改课件内容
3. 点击"Save"按钮
4. 打开浏览器控制台（F12）
5. 应该看到成功的网络请求（PUT /api/lessons/:id）

### 测试 2：容器重启数据持久化
```bash
# 在服务器上执行
docker-compose restart

# 等待 30 秒
sleep 30

# 检查数据是否还在
curl http://localhost:3030/api/health | grep lessonCount
```

### 测试 3：日志验证
```bash
# 应该看到详细的保存日志
docker-compose logs app | grep '\[LESSON_API\].*Update successful'
```

---

## 回滚方案

如果新版本有问题：

### 方案 1：回滚到上一个提交
```bash
cd /root/SteamPlatForm-main

# 查看提交历史
git log --oneline -10

# 回滚到上一个版本
git checkout <previous-commit-hash>

# 重新部署
docker-compose down
docker-compose build
docker-compose up -d
```

### 方案 2：从备份恢复数据
```bash
# 恢复数据库
cd /root/backups/steam-lesson
gunzip < backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i steam-lesson-db psql -U postgres steam_lesson
```

---

## 联系和监控

### 查看实时日志
```bash
# 应用日志
docker-compose logs -f app

# 数据库日志
docker-compose logs -f postgres

# 只看保存相关的日志
docker-compose logs -f app | grep LESSON_API
```

### 设置定期备份（推荐）
```bash
# 添加到 crontab
crontab -e

# 每天凌晨 2 点自动备份
0 2 * * * cd /root/SteamPlatForm-main && docker exec steam-lesson-db pg_dump -U postgres steam_lesson | gzip > /root/backups/steam-lesson/backup_$(date +\%Y\%m\%d).sql.gz
```

### 监控磁盘空间
```bash
# 检查 Docker 占用
docker system df

# 清理未使用的资源
docker system prune -a --volumes
```

---

## 部署后检查清单

- [ ] 服务正常启动（docker-compose ps）
- [ ] 健康检查通过（curl /api/health）
- [ ] 可以正常登录
- [ ] 创建新课件成功
- [ ] 修改课件保存成功
- [ ] 刷新页面数据还在
- [ ] 重新登录数据还在
- [ ] 重启容器数据还在
- [ ] 日志无错误信息

全部通过后，部署成功！✅
