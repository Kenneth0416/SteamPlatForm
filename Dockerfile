# ==========================================
# Stage 1: Base - 基础环境
# ==========================================
FROM node:20-alpine AS base

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

# 安装 OpenSSL（Prisma 依赖）、wget（健康检查）、postgresql-client（数据库检查）
RUN apk add --no-cache libc6-compat openssl wget postgresql-client


# ==========================================
# Stage 2: Dependencies - 安装依赖
# ==========================================
FROM base AS deps

WORKDIR /app

# 复制依赖配置文件（利用 Docker 缓存）
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装所有依赖（包括 devDependencies）
RUN pnpm install --frozen-lockfile


# ==========================================
# Stage 3: Builder - 构建应用
# ==========================================
FROM base AS builder

WORKDIR /app

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma 客户端
RUN pnpm exec prisma generate

# 构建 Next.js 应用
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build


# ==========================================
# Stage 4: Runner - 生产运行环境
# ==========================================
FROM base AS runner

WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 复制 Prisma schema、package.json 和 pnpm-lock.yaml（用于安装依赖）
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# 安装依赖（包含 Prisma CLI）并生成 Prisma Client
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm exec prisma generate

# 复制启动脚本
COPY scripts/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# 设置环境变量
ENV PORT=3030
ENV HOSTNAME="0.0.0.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3030/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 以 nextjs 用户运行
USER nextjs

ENTRYPOINT ["./docker-entrypoint.sh"]
