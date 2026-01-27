import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET /api/lessons - 獲取用戶的所有課程
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const showFavoriteOnly = searchParams.get("showFavoriteOnly") === "true"
    const showArchived = searchParams.get("showArchived") === "true"
    const sortBy = searchParams.get("sortBy") || "updatedAt"
    const sortOrder = searchParams.get("sortOrder") || "desc"
    const gradeLevels = searchParams.get("gradeLevels")
    const domains = searchParams.get("domains")
    const tags = searchParams.get("tags")

    // 安全：驗證搜索參數長度
    if (search && search.length > 100) {
      return NextResponse.json({ error: "Search query too long (max 100 characters)" }, { status: 400 })
    }
    if (tags && tags.length > 500) {
      return NextResponse.json({ error: "Tags filter too long" }, { status: 400 })
    }

    const lessons = await prisma.lesson.findMany({
      where: {
        userId: session.user.id, // 安全：強制使用當前會話用戶 ID
        isArchived: showArchived,
        isFavorite: showFavoriteOnly ? true : undefined,
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { tags: { has: search } },
          ],
        }),
        ...(tags && { tags: { hasSome: tags.split(",") } }),
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
    })

    // Filter by gradeLevels and domains in application layer (Prisma Json query is limited)
    const gradeLevelList = gradeLevels?.split(",") || []
    const domainList = domains?.split(",") || []

    const filteredLessons = lessons.filter(lesson => {
      const req = lesson.requirements as { gradeLevel?: string; steamDomains?: string[] }

      if (gradeLevelList.length > 0 && !gradeLevelList.includes(req.gradeLevel || "")) {
        return false
      }
      if (domainList.length > 0 && !domainList.some(d => req.steamDomains?.includes(d))) {
        return false
      }
      return true
    })

    // Transform lessons to include markdown at top level
    const transformedLessons = filteredLessons.map(lesson => ({
      ...lesson,
      markdown: (lesson.lessonPlan as { markdown?: string })?.markdown || "",
    }))

    return NextResponse.json({ lessons: transformedLessons })
  } catch (error) {
    console.error("Error fetching lessons:", error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? (error as Error).message : "Failed to fetch lessons" },
      { status: 500 }
    )
  }
}

// POST /api/lessons - 創建新課程
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    console.error('[LESSON_API] Create failed: Unauthorized')
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, markdown, requirements } = body

    console.log('[LESSON_API] Create request:', {
      userId: session.user.id,
      hasTitle: !!title,
      hasMarkdown: !!markdown,
      hasRequirements: !!requirements,
    })

    if (!markdown || !requirements) {
      console.error('[LESSON_API] Create failed: Missing required fields')
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const lesson = await prisma.lesson.create({
      data: {
        userId: session.user.id, // 安全：強制使用當前會話用戶 ID
        title: title || "Untitled Lesson",
        lessonPlan: { markdown },
        requirements,
      },
    })

    console.log('[LESSON_API] Create successful:', {
      lessonId: lesson.id,
      userId: lesson.userId,
      createdAt: lesson.createdAt,
    })

    // Transform response to include markdown at top level
    return NextResponse.json({
      lesson: {
        ...lesson,
        markdown: (lesson.lessonPlan as { markdown?: string })?.markdown || "",
      }
    })
  } catch (error) {
    console.error('[LESSON_API] Create error:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    })
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? (error as Error).message : "Failed to create lesson" },
      { status: 500 }
    )
  }
}
