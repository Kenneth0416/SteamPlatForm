import { NextRequest, NextResponse } from "next/server"
import { generateLesson, generateLessonStream } from "@/lib/langchain"
import type { LessonRequirements } from "@/types/lesson"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requirements, stream, lang = "en" } = body as {
      requirements: LessonRequirements
      stream?: boolean
      lang?: "en" | "zh"
    }

    if (!requirements) {
      return NextResponse.json({ error: "Missing requirements" }, { status: 400 })
    }

    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of generateLessonStream(requirements, lang)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            controller.close()
          } catch (error) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`)
            )
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    const markdown = await generateLesson(requirements, lang)
    return NextResponse.json({ markdown })
  } catch (error) {
    console.error("Lesson generation error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Failed to generate lesson" },
      { status: 500 }
    )
  }
}
