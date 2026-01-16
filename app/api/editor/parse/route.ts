import { NextRequest, NextResponse } from 'next/server'
import { parseMarkdown, blocksToMarkdown } from '@/lib/editor/parser'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { markdown } = await request.json()

    if (typeof markdown !== 'string') {
      return NextResponse.json(
        { error: 'markdown field is required and must be a string' },
        { status: 400 }
      )
    }

    const result = parseMarkdown(markdown)

    return NextResponse.json({
      blocks: result.blocks,
      blockCount: result.blocks.length,
    })
  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json(
      { error: 'Failed to parse markdown' },
      { status: 500 }
    )
  }
}
