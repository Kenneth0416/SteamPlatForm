import { NextRequest, NextResponse } from "next/server"
import { parseMarkdown } from "@/lib/editor/parser"
import { runEditorAgentStream } from "@/lib/editor/agent"
import { auth } from "@/lib/auth"
import { withRateLimit } from "@/lib/rateLimit"

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

      // 驗證輸入長度
      if (message.length > 2000) {
        return new Response(JSON.stringify({ error: "Message too long (max 2000 characters)" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (currentLesson && currentLesson.length > 500_000) {
        return new Response(JSON.stringify({ error: "Lesson content too large" }), {
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
        JSON.stringify({ error: process.env.NODE_ENV === "development" ? (error as Error).message : "Failed to process chat" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
  }, "ai") // 使用 AI 速率限制
}
