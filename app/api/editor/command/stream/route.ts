import { NextRequest } from 'next/server'
import { runEditorAgentStream } from '@/lib/editor/agent'
import type { Block } from '@/lib/editor/types'

export async function POST(request: NextRequest) {
  try {
    const { message, blocks, chatHistory } = await request.json()

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'message field is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!blocks || !Array.isArray(blocks)) {
      return new Response(JSON.stringify({ error: 'blocks field is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of runEditorAgentStream(
            message,
            blocks as Block[],
            chatHistory || []
          )) {
            const data = `data: ${JSON.stringify(event)}\n\n`
            controller.enqueue(encoder.encode(data))
          }
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: 'Stream error' })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Command error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process command' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
