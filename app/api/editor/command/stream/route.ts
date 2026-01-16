import { NextRequest } from 'next/server'
import { runEditorAgentStream, runMultiDocAgentStream } from '@/lib/editor/agent'
import type { Block, EditorDocument } from '@/lib/editor/types'

export async function POST(request: NextRequest) {
  try {
    const { message, blocks, chatHistory, documents, activeDocId } = await request.json()

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'message field is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Use multi-doc agent if documents provided, otherwise single-doc
          const agentStream = documents && Array.isArray(documents) && documents.length > 0
            ? runMultiDocAgentStream(
                message,
                documents as EditorDocument[],
                activeDocId || documents[0].id,
                chatHistory || []
              )
            : runEditorAgentStream(
                message,
                blocks as Block[],
                chatHistory || []
              )

          for await (const event of agentStream) {
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
