import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"

// GET /api/admin/lessons - 獲取所有課程（可選 userId 過濾）
export async function GET(request: NextRequest) {
  const authError = await requireAdmin()
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    const lessons = await prisma.lesson.findMany({
      where: userId ? { userId } : {},
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    const transformedLessons = lessons.map((lesson) => ({
      ...lesson,
      markdown: (lesson.lessonPlan as { markdown?: string })?.markdown || "",
    }))

    return NextResponse.json({ lessons: transformedLessons })
  } catch (error) {
    console.error("Error fetching admin lessons:", error)
    return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 })
  }
}
