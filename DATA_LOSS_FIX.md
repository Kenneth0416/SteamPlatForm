# 数据丢失问题修复说明

## 问题摘要

**严重性**: 🔴 CRITICAL  
**影响**: 用户保存的课件在容器重启或刷新后消失

---

## 发现的根本原因

### 1. 编辑器保存使用了错误的 HTTP 方法 ⚠️
**文件**: `app/(protected)/editor/[lessonId]/page.tsx:123-127`

**问题**: 
- 使用 `PATCH` 方法调用 `/api/lessons/${lessonId}`
- 但 API 路由只支持 `GET`、`PUT`、`DELETE`
- 请求返回 405 错误，数据未保存

**影响**: 
- 在编辑器中修改课件后点击"Save"按钮
- 前端显示保存成功，但实际没有写入数据库
- 刷新页面或重新登录后数据消失

### 2. Docker 容器重启导致数据丢失 ⚠️
**文件**: `scripts/docker-entrypoint.sh:23`

**问题**:
```bash
npx prisma db push --accept-data-loss
```

**危险参数 `--accept-data-loss`**:
- 每次 Docker 容器重启时执行
- 如果 schema 不匹配，会删除并重建表
- 丢失所有数据

**触发场景**:
- 服务器重启
- Docker 更新部署
- 容器崩溃自动重启

---

## 已应用的修复

### ✅ 修复 1: 更正编辑器的 HTTP 方法
**文件**: `app/(protected)/editor/[lessonId]/page.tsx`

**变更**:
```diff
- method: 'PATCH',
+ method: 'PUT',
  body: JSON.stringify({ 
-   lessonPlan: markdown 
+   markdown,
+   lessonPlan: { markdown }
  }),
```

### ✅ 修复 2: 移除危险的数据丢失参数
**文件**: `scripts/docker-entrypoint.sh`

**变更**:
```diff
- npx prisma db push --accept-data-loss --url "$DATABASE_URL"
+ npx prisma db push --url "$DATABASE_URL"
```

**说明**: 
- 移除 `--accept-data-loss` 参数
- 如果 schema 不匹配，部署会失败并显示错误
- 需要手动处理 schema 变更，保护数据安全

### ✅ 修复 3: 添加详细的保存日志
**文件**: 
- `app/api/lessons/[id]/route.ts` (PUT)
- `app/api/lessons/route.ts` (POST)

**新增日志**:
```typescript
console.log('[LESSON_API] Update request:', {
  lessonId: id,
  userId: session.user.id,
  hasMarkdown: !!markdown,
  hasRequirements: !!requirements,
})
```

**用途**:
- 追踪保存操作
- 调试用户 ID 不匹配问题
- 确认数据是否真的写入数据库

### ✅ 修复 4: 创建健康检查 API
**文件**: `app/api/health/route.ts`

**端点**: `GET /api/health`

**返回信息**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-27T...",
  "checks": {
    "database": {
      "status": "healthy",
      "details": {
        "userCount": 5,
        "lessonCount": 23,
        "recentLessons": [...]
      }
    }
  }
}
```

### ✅ 修复 5: 创建数据库诊断脚本
**文件**: `scripts/diagnose-db.sh`

**用法**:
```bash
./scripts/diagnose-db.sh
```

**检查项**:
- Docker 状态
- 数据库连接
- 表数据统计
- 最近的课程记录

---

## 部署步骤

### 1. 备份现有数据（⚠️ 重要！）
```bash
# 在服务器上执行
docker exec steam-lesson-db pg_dump -U postgres steam_lesson > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 重新构建并部署
```bash
# 停止现有容器
docker-compose down

# 拉取最新代码
git pull origin main

# 重新构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志确认启动成功
docker-compose logs -f app
```

### 3. 验证修复
```bash
# 检查健康状态
curl http://localhost:3030/api/health

# 运行数据库诊断
./scripts/diagnose-db.sh

# 查看应用日志中的保存操作
docker-compose logs app | grep '[LESSON_API]'
```

### 4. 测试保存功能
1. 登录到应用
2. 创建或修改一个课件
3. 点击"Save"按钮
4. 检查浏览器控制台无错误
5. 刷新页面，确认修改仍然存在
6. 退出登录并重新登录，确认数据持久化

---

## 监控和调试

### 查看实时保存日志
```bash
docker-compose logs -f app | grep '[LESSON_API]'
```

**预期输出** (保存成功):
```
[LESSON_API] Update request: {
  lessonId: 'cm2x...',
  userId: 'cm2x...',
  hasMarkdown: true,
  hasRequirements: true,
}
[LESSON_API] Updating lesson with data: {
  lessonId: 'cm2x...',
  fields: ['lessonPlan', 'markdown'],
}
[LESSON_API] Update successful: {
  lessonId: 'cm2x...',
  userId: 'cm2x...',
  updatedAt: 2026-01-27T...,
}
```

**异常输出** (保存失败):
```
[LESSON_API] Update failed: Lesson not found or access denied
```

### 常见问题排查

#### 问题 1: 保存后立即消失
**原因**: 可能使用了错误的 HTTP 方法  
**解决**: 确认已部署修复 1

#### 问题 2: 容器重启后数据消失
**原因**: `--accept-data-loss` 删除了数据  
**解决**: 确认已部署修复 2，并从备份恢复

#### 问题 3: 保存报 404 错误
**原因**: 用户 ID 不匹配或课程不存在  
**排查**: 
```bash
# 检查课程是否存在
docker exec steam-lesson-db psql -U postgres -d steam_lesson -c \
  "SELECT id, user_id, title FROM \"Lesson\" WHERE id = 'YOUR_LESSON_ID';"

# 检查当前会话用户 ID
# 在浏览器控制台执行:
# fetch('/api/auth/session').then(r=>r.json()).then(console.log)
```

#### 问题 4: 保存报 401 错误
**原因**: 会话过期  
**解决**: 重新登录

---

## 预防措施

### 1. 定期备份数据库
**添加到 crontab**:
```bash
# 每天凌晨 2 点备份
0 2 * * * /path/to/backup-script.sh
```

**备份脚本示例**:
```bash
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

docker exec steam-lesson-db pg_dump -U postgres steam_lesson | \
  gzip > "$BACKUP_DIR/steam_lesson_$DATE.sql.gz"

# 保留最近 7 天的备份
find "$BACKUP_DIR" -name "steam_lesson_*.sql.gz" -mtime +7 -delete
```

### 2. 监控日志
使用日志聚合工具（如 Loki、ELK）监控关键错误：
- `[LESSON_API] Update failed`
- `[LESSON_API] Create failed`
- `database connection error`

### 3. 设置告警
当以下情况发生时发送告警：
- 健康检查失败（`/api/health` 返回非 200）
- 数据库连接失败
- 数据库表记录数异常减少

---

## 回滚计划

如果新版本出现问题：

1. **立即停止容器**:
```bash
docker-compose down
```

2. **回滚到旧版本**:
```bash
git checkout <previous-stable-tag>
docker-compose build
docker-compose up -d
```

3. **从备份恢复数据**（如果需要）:
```bash
cat backup_20260127.sql | \
  docker exec -i steam-lesson-db psql -U postgres steam_lesson
```

---

## 联系信息

如有问题，请检查：
- 应用日志: `docker-compose logs app`
- 数据库日志: `docker-compose logs postgres`
- 健康检查: `curl http://localhost:3030/api/health`

---

**最后更新**: 2026-01-27  
**修复版本**: v1.0.1-data-loss-fix
