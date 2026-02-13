import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const health = {
    status: "healthy" as const,
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: "unknown" as const, details: {} as Record<string, unknown> },
      auth: { status: "unknown" as const, details: {} as Record<string, unknown> },
    },
  }

  // 检查数据库连接
  try {
    await prisma.$queryRaw`SELECT 1 as ping`
    health.checks.database = {
      status: "healthy",
      details: {
        message: "Database connection successful",
      },
    }

    // 检查用户和课程数量
    const userCount = await prisma.user.count()
    const lessonCount = await prisma.lesson.count()

    health.checks.database.details = {
      ...health.checks.database.details,
      userCount,
      lessonCount,
    }

    // 检查最近的课程（用于调试数据丢失）
    const recentLessons = await prisma.lesson.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    health.checks.database.details = {
      ...health.checks.database.details,
      recentLessons,
    }
  } catch (error) {
    health.status = "unhealthy"
    health.checks.database = {
      status: "unhealthy",
      details: {
        error: (error as Error).message,
      },
    }
  }

  // 如果提供了认证头，检查会话
  const authHeader = request.headers.get("authorization")
  if (authHeader) {
    try {
      const session = await auth()
      if (session?.user) {
        const userLessonCount = await prisma.lesson.count({
          where: { userId: session.user.id },
        })

        health.checks.auth = {
          status: "authenticated",
          details: {
            userId: session.user.id,
            email: session.user.email,
            lessonCount: userLessonCount,
          },
        }
      } else {
        health.checks.auth = {
          status: "unauthenticated",
          details: { message: "No valid session" },
        }
      }
    } catch (error) {
      health.checks.auth = {
        status: "error",
        details: { error: (error as Error).message },
      }
    }
  }

  const statusCode = health.status === "healthy" ? 200 : 503
  return NextResponse.json(health, { status: statusCode })
}
