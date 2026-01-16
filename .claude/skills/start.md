---
name: start
description: 启动项目开发环境
---

启动步骤:
1. docker compose up -d (启动 PostgreSQL)
2. npx prisma generate (生成 Prisma 客户端)
3. pnpm dev (启动开发服务器)

检查:
- 数据库: localhost:5432
- 应用: localhost:3000
- .env 配置完整
