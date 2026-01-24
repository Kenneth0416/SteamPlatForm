import { NextRequest, NextResponse } from "next/server"
import { parseMarkdown, blocksToMarkdown, updateBlockContent, addBlock, deleteBlock } from "@/lib/editor/parser"
import type { PendingDiff } from "@/lib/editor/types"
import { auth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { currentLesson, diffs, lang = "en" } = await request.json() as {
      currentLesson: string
      diffs: PendingDiff[]
      lang?: "en" | "zh"
    }

    console.log('[apply-change] Received diffs:', JSON.stringify(diffs, null, 2))

    if (!currentLesson) {
      return NextResponse.json(
        { error: "Missing currentLesson" },
        { status: 400 }
      )
    }

    // Parse the current lesson into blocks
    let { blocks } = parseMarkdown(currentLesson)
    console.log('[apply-change] Parsed blocks:', blocks.map(b => ({ id: b.id, type: b.type, preview: b.content.slice(0, 30) })))
    const appliedChanges: string[] = []

    // Apply each diff
    for (const diff of diffs || []) {
      console.log('[apply-change] Processing diff:', diff)
      switch (diff.action) {
        case 'update':
          blocks = updateBlockContent(blocks, diff.blockId, diff.newContent || '')
          appliedChanges.push(`Edited block ${diff.blockId}`)
          break
        case 'add':
          try {
            const parsed = JSON.parse(diff.newContent || '{}')
            const afterId = diff.blockId === '__start__' ? null : diff.blockId
            const addResult = addBlock(
              blocks,
              afterId,
              parsed.type || 'paragraph',
              parsed.content || '',
              parsed.level,
              diff.newBlockId // Pass the pre-generated ID for chaining support
            )
            blocks = addResult.blocks
            appliedChanges.push(`Added new ${parsed.type || 'paragraph'} block`)
          } catch {
            // Fallback: treat newContent as plain text
            const afterId = diff.blockId === '__start__' ? null : diff.blockId
            const addResult = addBlock(blocks, afterId, 'paragraph', diff.newContent || '', undefined, diff.newBlockId)
            blocks = addResult.blocks
            appliedChanges.push(`Added new block`)
          }
          break
        case 'delete':
          blocks = deleteBlock(blocks, diff.blockId)
          appliedChanges.push(`Deleted block ${diff.blockId}`)
          break
      }
    }

    // Convert blocks back to markdown
    const updatedLesson = blocksToMarkdown(blocks)

    const summary = lang === "en"
      ? `Applied ${appliedChanges.length} change(s): ${appliedChanges.join(', ')}`
      : `已应用 ${appliedChanges.length} 项修改：${appliedChanges.join('、')}`

    return NextResponse.json({
      updatedLesson,
      summary,
      appliedChanges,
    })
  } catch (error) {
    console.error("Apply change error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply change" },
      { status: 500 }
    )
  }
}
