import { NextRequest, NextResponse } from 'next/server'
import { getVersions, getVersion, restoreVersion, getEditHistory } from '@/lib/editor/version'
import { auth } from '@/lib/auth'
import { verifyLessonOwnership } from '@/lib/api-utils'

const requireAuth = async () => {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return session
}

export async function GET(request: NextRequest) {
  const session = await requireAuth()
  if (!session?.user) {
    return session as unknown as NextResponse
  }

  const { searchParams } = new URL(request.url)
  const lessonId = searchParams.get('lessonId')
  const version = searchParams.get('version')
  const type = searchParams.get('type') || 'versions'

  if (!lessonId) {
    return NextResponse.json(
      { error: 'lessonId is required' },
      { status: 400 }
    )
  }

  // 驗證所有權
  const ownership = await verifyLessonOwnership(lessonId, session.user.id)
  if (!ownership.owned) {
    return ownership.error as unknown as NextResponse
  }

  try {
    if (type === 'edits') {
      const history = await getEditHistory(lessonId)
      return NextResponse.json({ history })
    }

    if (version) {
      const versionData = await getVersion(lessonId, parseInt(version))
      if (!versionData) {
        return NextResponse.json(
          { error: 'Version not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(versionData)
    }

    const versions = await getVersions(lessonId)
    return NextResponse.json({ versions })
  } catch (error) {
    console.error('History error:', error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Failed to get history' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAuth()
  if (!session?.user) {
    return session as unknown as NextResponse
  }

  try {
    const { lessonId, version } = await request.json()

    if (!lessonId || version === undefined) {
      return NextResponse.json(
        { error: 'lessonId and version are required' },
        { status: 400 }
      )
    }

    // 驗證所有權
    const ownership = await verifyLessonOwnership(lessonId, session.user.id)
    if (!ownership.owned) {
      return ownership.error as unknown as NextResponse
    }

    const blocks = await restoreVersion(lessonId, version)
    if (!blocks) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ blocks })
  } catch (error) {
    console.error('Restore error:', error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Failed to restore version' },
      { status: 500 }
    )
  }
}
