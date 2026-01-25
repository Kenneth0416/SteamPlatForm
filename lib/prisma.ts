import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const isDevelopment = process.env.NODE_ENV !== 'production'
const isVercel = !!process.env.VERCEL

function createPrismaClient() {
  if (isDevelopment) {
    const dbUrl = process.env.DATABASE_URL || ''
    console.log('[PRISMA] Initializing Prisma Client')
    console.log('[PRISMA] DATABASE_URL exists:', !!dbUrl)
  }

  // Vercel serverless 环境不使用连接池
  if (isVercel) {
    console.log('[PRISMA] Vercel detected: using direct Prisma Client (no connection pool)')
    return new PrismaClient()
  }

  // 本地开发环境使用连接池优化
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: isDevelopment ? 10 : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })

  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({ adapter })

  if (isDevelopment) {
    console.log('[PRISMA] Client initialized successfully')
  }

  return client
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
