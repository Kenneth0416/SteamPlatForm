import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/lessons - 獲取用戶的所有課程
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const search = searchParams.get("search")
    const showArchived = searchParams.get("showArchived") === "true"
    const showFavoriteOnly = searchParams.get("showFavoriteOnly") === "true"
    const sortBy = searchParams.get("sortBy") || "updatedAt"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    const lessons = await prisma.lesson.findMany({
      where: {
        ...(userId && { userId }),
        isArchived: showArchived ? undefined : false,
        isFavorite: showFavoriteOnly ? true : undefined,
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { tags: { has: search } },
          ],
        }),
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
    })

    // Transform lessons to include markdown at top level
    const transformedLessons = lessons.map(lesson => ({
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
