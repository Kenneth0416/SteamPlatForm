import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [totalUsers, totalLessons, newUsersThisWeek, newLessonsThisWeek] = await Promise.all([
      prisma.user.count(),
      prisma.lesson.count(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.lesson.count({ where: { createdAt: { gte: weekAgo } } }),
    ])

    return NextResponse.json({
      totalUsers,
      totalLessons,
      newUsersThisWeek,
      newLessonsThisWeek,
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
