# 默认管理员账户说明

## 自动创建

首次部署时，系统会自动创建默认管理员账户，无需手动设置。

## 凭据信息

```
Email: admin@admin.com
Password: admin123456
Role: admin
```

## 安全提示

⚠️ **首次登录后请立即修改密码！**

## 使用方法

1. 访问应用首页
2. 使用上述凭据登录
3. 登录后点击右上角用户图标进入个人设置
4. 修改密码

## 幂等性

- 如果管理员账户已存在，系统会跳过创建
- 可以安全地重启容器而不会重复创建
- 数据库不会丢失或重复数据

## 工作原理

初始化脚本在容器启动时自动运行：
1. 检查是否存在 `admin@admin.com` 用户
2. 如果不存在，创建管理员账户
3. 密码使用 bcrypt 加密存储
4. 角色设置为 `admin`（小写）

## 故障排查

如果登录失败，检查：
1. 邮箱是否输入正确（admin@admin.com）
2. 密码是否输入正确（admin123456）
3. 查看容器日志确认是否创建成功

```bash
docker logs steam-lesson-app | grep -i "admin\|seed"
```

## 手动创建（备用方法）

如果自动创建失败，可以手动运行：

```bash
# 使用 Prisma seed 命令
docker exec steam-lesson-app npx prisma db seed --url "$DATABASE_URL"
```

## 环境变量

默认管理员账户不依赖额外的环境变量，只要有 `DATABASE_URL` 即可创建。
