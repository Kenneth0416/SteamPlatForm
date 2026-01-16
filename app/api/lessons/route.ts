import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/lessons - 獲取用戶的所有課程
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const search = searchParams.get("search")
    const showFavoriteOnly = searchParams.get("showFavoriteOnly") === "true"
    const showArchived = searchParams.get("showArchived") === "true"
    const sortBy = searchParams.get("sortBy") || "updatedAt"
    const sortOrder = searchParams.get("sortOrder") || "desc"
    const gradeLevels = searchParams.get("gradeLevels")
    const domains = searchParams.get("domains")
    const tags = searchParams.get("tags")

    const lessons = await prisma.lesson.findMany({
      where: {
        ...(userId && { userId }),
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
    return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 })
  }
}

// POST /api/lessons - 創建新課程
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, title, markdown, requirements } = body

    if (!userId || !markdown || !requirements) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Ensure user exists (create if not)
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@placeholder.local`,
        name: 'User',
        password: '$2a$10$placeholder.hash.that.will.never.match',
      },
    })

    const lesson = await prisma.lesson.create({
      data: {
        userId,
        title: title || "Untitled Lesson",
        lessonPlan: { markdown },
        requirements,
      },
    })

    // Transform response to include markdown at top level
    return NextResponse.json({
      lesson: {
        ...lesson,
        markdown: (lesson.lessonPlan as { markdown?: string })?.markdown || "",
      }
    })
  } catch (error) {
    console.error("Error creating lesson:", error)
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 })
  }
}
