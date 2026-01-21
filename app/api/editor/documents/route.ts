import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseMarkdown } from '@/lib/editor/parser'
import { auth } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

type EditorDocumentRow = Prisma.EditorDocumentGetPayload<{}>

const requireAuth = async () => {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth()
  if (unauthorized) {
    return unauthorized
  }

  const lessonId = req.nextUrl.searchParams.get('lessonId')
  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId required' }, { status: 400 })
  }

  const docs: EditorDocumentRow[] = await prisma.editorDocument.findMany({
    where: { lessonId },
    orderBy: { order: 'asc' },
  })

  const result = docs.map(doc => ({
    id: doc.id,
    name: doc.name,
    type: doc.type,
    content: doc.content,
    blocks: parseMarkdown(doc.content).blocks,
    isDirty: false,
    createdAt: doc.createdAt,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth()
  if (unauthorized) {
    return unauthorized
  }

  const body = await req.json()
  const { lessonId, name, type, content } = body

  if (!lessonId || !name || !type) {
    return NextResponse.json({ error: 'lessonId, name, type required' }, { status: 400 })
  }

  const maxOrder = await prisma.editorDocument.aggregate({
    where: { lessonId },
    _max: { order: true },
  })

  const doc = await prisma.editorDocument.create({
    data: {
      lessonId,
      name,
      type,
      content: content || '',
      order: (maxOrder._max.order ?? -1) + 1,
    },
  })

  return NextResponse.json({
    id: doc.id,
    name: doc.name,
    type: doc.type,
    content: doc.content,
    blocks: parseMarkdown(doc.content).blocks,
    isDirty: false,
    createdAt: doc.createdAt,
  })
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAuth()
  if (unauthorized) {
    return unauthorized
  }

  const body = await req.json()
  const { id, name, content } = body

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const doc = await prisma.editorDocument.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(content !== undefined && { content }),
    },
  })

  return NextResponse.json({
    id: doc.id,
    name: doc.name,
    type: doc.type,
    content: doc.content,
    blocks: parseMarkdown(doc.content).blocks,
    isDirty: false,
    createdAt: doc.createdAt,
  })
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAuth()
  if (unauthorized) {
    return unauthorized
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  await prisma.editorDocument.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
