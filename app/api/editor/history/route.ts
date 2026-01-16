import { NextRequest, NextResponse } from 'next/server'
import { getVersions, getVersion, restoreVersion, getEditHistory } from '@/lib/editor/version'
import { auth } from '@/lib/auth'

const requireAuth = async () => {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth()
  if (unauthorized) {
    return unauthorized
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
      { error: 'Failed to get history' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth()
  if (unauthorized) {
    return unauthorized
  }

  try {
    const { lessonId, version } = await request.json()

    if (!lessonId || version === undefined) {
      return NextResponse.json(
        { error: 'lessonId and version are required' },
        { status: 400 }
      )
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
      { error: 'Failed to restore version' },
      { status: 500 }
    )
  }
}
