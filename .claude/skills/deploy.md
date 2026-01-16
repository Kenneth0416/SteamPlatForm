---
name: deploy
description: 部署和环境配置
---

关键文件:
- docker-compose.yml
- package.json
- .env

命令:
- pnpm dev (开发)
- docker compose up -d (数据库)
- pnpm build && pnpm start (生产)
