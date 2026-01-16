import { NextResponse } from "next/server"
import { parseMarkdownToLesson } from "@/lib/export/parser"
import type { ExportTemplate } from "@/lib/export/types"
import { generatePdf } from "@/lib/export/pdf/generator"

export const runtime = "nodejs"

type PdfExportRequestBody = {
  markdown?: string
  template?: ExportTemplate
  includeImages?: boolean
  lang?: "en" | "zh"
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PdfExportRequestBody
    const markdown = typeof body.markdown === "string" ? body.markdown : ""
    const template = (body.template || "standard") as ExportTemplate
    const includeImages = Boolean(body.includeImages)

    if (!markdown.trim()) {
      return NextResponse.json({ error: "Missing markdown" }, { status: 400 })
    }

    // 客户端已将 Mermaid 图表渲染为 PNG，无需服务端转换
    const lesson = parseMarkdownToLesson(markdown)
    const buffer = await generatePdf(lesson, template, includeImages)

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="lesson.pdf"',
      },
    })
  } catch (error) {
    console.error("PDF export error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Failed to export PDF" },
      { status: 500 },
    )
  }
}
