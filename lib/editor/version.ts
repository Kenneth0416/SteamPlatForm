import { prisma } from '@/lib/prisma'
import type { Block } from './types'

export async function createVersion(
  lessonId: string,
  blocks: Block[],
  summary?: string
): Promise<{ id: string; version: number }> {
  // Get next version number
  const lastVersion = await prisma.documentVersion.findFirst({
    where: { lessonId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })

  const nextVersion = (lastVersion?.version ?? 0) + 1

  const created = await prisma.documentVersion.create({
    data: {
      lessonId,
      version: nextVersion,
      snapshot: blocks as unknown as object,
      summary,
    },
  })

  return { id: created.id, version: nextVersion }
}

export async function getVersions(lessonId: string) {
  return prisma.documentVersion.findMany({
    where: { lessonId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      summary: true,
      createdAt: true,
    },
  })
}

export async function getVersion(lessonId: string, version: number) {
  return prisma.documentVersion.findUnique({
    where: {
      lessonId_version: { lessonId, version },
    },
  })
}

export async function restoreVersion(lessonId: string, version: number): Promise<Block[] | null> {
  const versionData = await getVersion(lessonId, version)
  if (!versionData) return null

  return versionData.snapshot as unknown as Block[]
}

export async function recordEdit(
  lessonId: string,
  blockId: string | null,
  action: 'create' | 'update' | 'delete',
  oldContent: string | null,
  newContent: string | null,
  reason: string | null,
  source: 'user' | 'llm'
) {
  return prisma.editHistory.create({
    data: {
      lessonId,
      blockId,
      action,
      oldContent,
      newContent,
      reason,
      source,
    },
  })
}

export async function getEditHistory(lessonId: string, limit: number = 50) {
  return prisma.editHistory.findMany({
    where: { lessonId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
