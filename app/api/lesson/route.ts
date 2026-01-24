import { NextRequest, NextResponse } from "next/server"
import { generateLesson, generateLessonStream } from "@/lib/langchain"
import type { LessonRequirements } from "@/types/lesson"
import { auth } from "@/lib/auth"
import { safeValidateLessonRequirements } from "@/types/lesson.schema"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { requirements, stream, lang = "en" } = body as {
      requirements: unknown
      stream?: boolean
      lang?: "en" | "zh"
    }

    // Validate requirements using Zod schema
    const validationResult = safeValidateLessonRequirements(requirements)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid lesson requirements",
          details: validationResult.error.errors.map(e => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    const validatedRequirements = validationResult.data

    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of generateLessonStream(validatedRequirements, lang)) {
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

    const markdown = await generateLesson(validatedRequirements, lang)
    return NextResponse.json({ markdown })
  } catch (error) {
    console.error("Lesson generation error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Failed to generate lesson" },
      { status: 500 }
    )
  }
}
