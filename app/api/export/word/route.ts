import { parseMarkdownToLesson } from "@/lib/export/parser"
import type { ExportTemplate } from "@/lib/export/types"
import { createDocxDocument } from "@/lib/export/word/generator"
import { Packer } from "docx"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  // 安全：添加認證檢查
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          markdown?: string
          template?: ExportTemplate
          includeImages?: boolean
          lang?: "en" | "zh"
        }
      | null

    const markdown = body?.markdown ?? ""
    const template = body?.template ?? "standard"
    const includeImages = body?.includeImages ?? false

    // 驗證輸入長度
    if (markdown.length > 1_000_000) {
      return NextResponse.json({ error: "Markdown too large (max 1MB)" }, { status: 400 })
    }

    if (!markdown || typeof markdown !== "string") {
      return NextResponse.json({ error: "Missing markdown" }, { status: 400 })
    }

    const lesson = parseMarkdownToLesson(markdown)
    const doc = createDocxDocument(lesson, template, includeImages)
    const buffer = await Packer.toBuffer(doc)

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="lesson.docx"',
      },
    })
  } catch (error) {
    console.error("Word export error:", error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? (error as Error).message : "Failed to export Word document" },
      { status: 500 },
    )
  }
}
