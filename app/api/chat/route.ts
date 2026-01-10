import { NextRequest } from "next/server"
import { chatWithLessonStream } from "@/lib/langchain"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, currentLesson, lang = "en" } = body as {
      message: string
      currentLesson: string
      lang?: "en" | "zh"
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const stream = chatWithLessonStream(message, currentLesson, lang)

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (error) {
          controller.error(error)
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
  } catch (error) {
    console.error("Chat error:", error)
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Failed to process chat" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
