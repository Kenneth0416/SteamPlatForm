import { NextRequest, NextResponse } from 'next/server'
import { createVersion, recordEdit } from '@/lib/editor/version'
import { auth } from '@/lib/auth'
import { verifyLessonOwnership } from '@/lib/api-utils'
import type { Block } from '@/lib/editor/types'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { lessonId, blocks, summary, edits } = await request.json()

    if (!lessonId || !blocks) {
      return NextResponse.json(
        { error: 'lessonId and blocks are required' },
        { status: 400 }
      )
    }

    // 驗證所有權
    const ownership = await verifyLessonOwnership(lessonId, session.user.id)
    if (!ownership.owned) {
      return ownership.error as unknown as NextResponse
    }

    // Create version snapshot
    const version = await createVersion(lessonId, blocks as Block[], summary)

    // Record individual edits if provided
    if (edits && Array.isArray(edits)) {
      for (const edit of edits) {
        await recordEdit(
          lessonId,
          edit.blockId,
          edit.action,
          edit.oldContent,
          edit.newContent,
          edit.reason,
          edit.source || 'llm'
        )
      }
    }

    return NextResponse.json({
      success: true,
      version: version.version,
      versionId: version.id,
    })
  } catch (error) {
    console.error('Apply error:', error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Failed to apply changes' },
      { status: 500 }
    )
  }
}
