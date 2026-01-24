import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const isDevelopment = process.env.NODE_ENV !== 'production'

function createPrismaClient() {
  if (isDevelopment) {
    const dbUrl = process.env.DATABASE_URL || ''
    console.log('[PRISMA] Initializing Prisma Client')
    console.log('[PRISMA] DATABASE_URL exists:', !!dbUrl)
  }

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
