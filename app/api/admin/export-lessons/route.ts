import JSZip from "jszip"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"

export const runtime = "nodejs"

type LessonRequirements = {
  gradeLevel?: string
  steamDomains?: string[]
  [key: string]: unknown
}

type LessonPlan = {
  markdown?: string
  [key: string]: unknown
}

function sanitizeSegment(value: string, fallback: string): string {
  const trimmed = value.trim()
  const cleaned = trimmed.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_+|_+$/g, "")
  return cleaned || fallback
}

function formatDateFolder(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-")
}

export async function GET(_request: NextRequest) {
  const authError = await requireAdmin()
  if (authError) return authError

  try {
    const lessons = await prisma.lesson.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const zip = new JSZip()

    lessons.forEach((lesson) => {
      const userName = sanitizeSegment(lesson.user?.name ?? "unknown", "user")
      const userEmail = sanitizeSegment(lesson.user?.email ?? "unknown", "email")
      const userFolderName = `${userName}_${userEmail}`

      const lessonTitle = sanitizeSegment(lesson.title || "Untitled", "lesson")
      const dateLabel = formatDateFolder(lesson.createdAt)
      const lessonFolderName = `${lessonTitle}_${dateLabel}`

      const plan = lesson.lessonPlan as LessonPlan | null
      const markdown = typeof plan?.markdown === "string" ? plan.markdown : ""

      const requirements = lesson.requirements as LessonRequirements | null

      const metadata = {
        id: lesson.id,
        title: lesson.title,
        grade: requirements?.gradeLevel ?? null,
        gradeLevel: requirements?.gradeLevel ?? null,
        domains: requirements?.steamDomains ?? [],
        steamDomains: requirements?.steamDomains ?? [],
        createdAt: lesson.createdAt.toISOString(),
        updatedAt: lesson.updatedAt.toISOString(),
        tags: lesson.tags ?? [],
        isFavorite: lesson.isFavorite,
        isArchived: lesson.isArchived,
        user: {
          id: lesson.userId,
          name: lesson.user?.name ?? "",
          email: lesson.user?.email ?? "",
        },
      }

      const folder = zip.folder(userFolderName)?.folder(lessonFolderName)
      if (!folder) return

      folder.file("lesson.md", markdown)
      folder.file("metadata.json", JSON.stringify(metadata, null, 2))
    })

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
    const filename = `lessons_export_${formatTimestamp(new Date())}.zip`

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Admin lessons export error:", error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? (error as Error).message : "Failed to export lessons" },
      { status: 500 },
    )
  }
}
