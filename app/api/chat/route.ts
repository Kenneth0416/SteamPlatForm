import { NextRequest } from "next/server"
import { parseMarkdown } from "@/lib/editor/parser"
import { runEditorAgentStream } from "@/lib/editor/agent"

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

    const { blocks } = parseMarkdown(currentLesson || "")
    const stream = runEditorAgentStream(message, blocks, [])

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let hasSuggestedChange = false

          for await (const event of stream) {
            if (event.type === 'new_turn') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "new_turn" })}\n\n`)
              )
            } else if (event.type === 'tool_call') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "tool_call", toolCall: event.data })}\n\n`)
              )
            } else if (event.type === 'content') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "content", content: event.data })}\n\n`)
              )
            } else if (event.type === 'diff') {
              if (!hasSuggestedChange) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "suggested_change", content: "true" })}\n\n`)
                )
                hasSuggestedChange = true
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "diff", diff: event.data })}\n\n`)
              )
            } else if (event.type === 'done') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`))
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            }
          }

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
