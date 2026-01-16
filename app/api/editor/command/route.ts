import { NextRequest, NextResponse } from 'next/server'
import { runEditorAgent } from '@/lib/editor/agent'
import type { Block } from '@/lib/editor/types'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { message, blocks, chatHistory } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'message field is required' },
        { status: 400 }
      )
    }

    if (!blocks || !Array.isArray(blocks)) {
      return NextResponse.json(
        { error: 'blocks field is required and must be an array' },
        { status: 400 }
      )
    }

    const result = await runEditorAgent(
      message,
      blocks as Block[],
      chatHistory || []
    )

    return NextResponse.json({
      response: result.response,
      pendingDiffs: result.pendingDiffs,
    })
  } catch (error) {
    console.error('Command error:', error)
    return NextResponse.json(
      { error: 'Failed to process command' },
      { status: 500 }
    )
  }
}
