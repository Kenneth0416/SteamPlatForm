import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const requireAuth = async () => {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return session
}

// GET /api/lessons/[id] - 獲取單個課程
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  if (!session?.user) {
    return session as unknown as NextResponse
  }

  try {
    const { id } = await params
    const lesson = await prisma.lesson.findFirst({
      where: {
        id,
        userId: session.user.id, // 安全：只允許訪問自己的課程
      },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    return NextResponse.json({
      lesson: {
        ...lesson,
        markdown: (lesson.lessonPlan as { markdown?: string })?.markdown || "",
        chatHistory: lesson.chatHistory || [],
      }
    })
  } catch (error) {
    console.error("Error fetching lesson:", error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? (error as Error).message : "Failed to fetch lesson" },
      { status: 500 }
    )
  }
}

// PUT /api/lessons/[id] - 更新課程
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  if (!session?.user) {
    return session as unknown as NextResponse
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { markdown, requirements, tags, isFavorite, isArchived, title, chatHistory } = body

    // 驗證所有權
    const existing = await prisma.lesson.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    // Only update title if explicitly provided (don't auto-extract from markdown on update)
    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        ...(markdown && { lessonPlan: { markdown } }),
        ...(title && { title }),
        ...(requirements && { requirements }),
        ...(chatHistory !== undefined && { chatHistory }),
        ...(tags !== undefined && { tags }),
        ...(isFavorite !== undefined && { isFavorite }),
        ...(isArchived !== undefined && { isArchived }),
      },
    })

    return NextResponse.json({
      lesson: {
        ...lesson,
        markdown: (lesson.lessonPlan as { markdown?: string })?.markdown || "",
        chatHistory: lesson.chatHistory || [],
      }
    })
  } catch (error) {
    console.error("Error updating lesson:", error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? (error as Error).message : "Failed to update lesson" },
      { status: 500 }
    )
  }
}

// DELETE /api/lessons/[id] - 刪除課程
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  if (!session?.user) {
    return session as unknown as NextResponse
  }

  try {
    const { id } = await params

    // 驗證所有權
    const existing = await prisma.lesson.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    await prisma.lesson.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting lesson:", error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? (error as Error).message : "Failed to delete lesson" },
      { status: 500 }
    )
  }
}
