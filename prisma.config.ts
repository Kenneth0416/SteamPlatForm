import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// 本地开发使用 .env.local，生产环境从环境变量读取
if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.local" });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
