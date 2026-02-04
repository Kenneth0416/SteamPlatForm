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
# Stage 3: Runner - 生产运行环境
# ==========================================
FROM base AS runner

WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制预构建的产物
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

# 复制 Prisma schema、package.json 和 pnpm-lock.yaml（用于安装依赖）
COPY prisma ./prisma
COPY package.json ./package.json
COPY pnpm-lock.yaml ./pnpm-lock.yaml

# 生成 Prisma Client
RUN pnpm exec prisma generate

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
