import { NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'

/**
 * 验证课程是否属于当前用户
 * @param lessonId 课程 ID
 * @param userId 用户 ID
 * @returns 如果验证失败返回 NextResponse，否则返回 null
 */
export async function verifyLessonOwnership(
  lessonId: string,
  userId: string
): Promise<{ owned: boolean; lesson?: any; error?: NextResponse }> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, userId },
    select: { id: true, title: true },
  })

  if (!lesson) {
    return {
      owned: false,
      error: new NextResponse(
        JSON.stringify({ error: 'Lesson not found or access denied' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      ),
    }
  }

  return { owned: true, lesson }
}

/**
 * 通过文档 ID 验证课程所有权（用于 EditorDocument）
 * @param documentId 文档 ID
 * @param userId 用户 ID
 * @returns 如果验证失败返回 NextResponse，否则返回 { lessonId, owned }
 */
export async function verifyDocumentOwnership(
  documentId: string,
  userId: string
): Promise<{ owned: boolean; lessonId?: string; error?: NextResponse }> {
  const doc = await prisma.editorDocument.findFirst({
    where: { id: documentId },
    select: { lessonId: true },
  })

  if (!doc) {
    return {
      owned: false,
      error: new NextResponse(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      ),
    }
  }

  // 验证课程所有权
  const ownership = await verifyLessonOwnership(doc.lessonId, userId)
  if (!ownership.owned) {
    return { owned: false, error: ownership.error }
  }

  return { owned: true, lessonId: doc.lessonId }
}

/**
 * 检查用户是否为管理员
 * @param role 用户角色（从 session 获取）
 * @returns 如果不是管理员返回 NextResponse，否则返回 null
 */
export function requireAdminRole(role: string): NextResponse | null {
  // Prisma enum uses uppercase (ADMIN, USER)
  if (role !== "ADMIN") {
    return new NextResponse(
      JSON.stringify({ error: "Forbidden - Admin access required" }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }
  return null
}
