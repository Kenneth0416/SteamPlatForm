import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { BlockIndexService } from '../block-index'
import { ReadWriteGuard } from './middleware'
import type { Block, PendingDiff, BlockType } from '../types'

const MAX_BATCH_SIZE = 25

export interface ToolContext {
  blockIndex: BlockIndexService
  guard: ReadWriteGuard
  pendingDiffs: PendingDiff[]
  onDiffCreated?: (diff: PendingDiff) => void
}

function generateDiffId(): string {
  return `diff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createListBlocksTool(ctx: ToolContext) {
  return new DynamicStructuredTool({
    name: 'list_blocks',
    description: 'List all blocks in the document with their IDs, types, and content previews. Call this first to understand document structure.',
    schema: z.object({}),
    func: async () => {
      ctx.guard.markDocumentRead()
      const summaries = ctx.blockIndex.getBlockIndex()
      const formatted = summaries.map(s =>
        `[${s.id}] (${s.type}) ${s.preview}`
      ).join('\n')
      return `Document has ${summaries.length} blocks:\n${formatted}`
    },
  })
}

export function createReadBlockTool(ctx: ToolContext) {
  return new DynamicStructuredTool({
    name: 'read_block',
    description: 'Read ONE block. Use read_blocks instead for 2+ blocks.',
    schema: z.object({
      blockId: z.string().describe('The ID of the block to read'),
    }),
    func: async ({ blockId }) => {
      const result = ctx.blockIndex.getWithContext(blockId)
      if (!result.block) {
        return `Error: Block "${blockId}" not found`
      }

      ctx.guard.markBlockRead(blockId)
      // Also mark context blocks as read
      const ctxIds = [
        ...result.before.map(b => b.id),
        ...result.after.map(b => b.id),
      ]
      ctx.guard.markBlocksRead(ctxIds)

      // Use effective content (with pending overlay)
      const content = ctx.blockIndex.getEffectiveContent(blockId, ctx.pendingDiffs) ?? result.block.content

      let output = `Block ${blockId} (${result.block.type}):\n${content}`

      if (result.before.length > 0) {
        output = `Context before:\n${result.before.map(b => `[${b.id}] ${b.content.slice(0, 30)}...`).join('\n')}\n\n${output}`
      }
      if (result.after.length > 0) {
        output += `\n\nContext after:\n${result.after.map(b => `[${b.id}] ${b.content.slice(0, 30)}...`).join('\n')}`
      }

      return output
    },
  })
}

export function createReadBlocksTool(ctx: ToolContext) {
  return new DynamicStructuredTool({
    name: 'read_blocks',
    description: 'PREFERRED: Batch read multiple blocks in ONE call. Always use this over read_block.',
    schema: z.object({
      blockIds: z.array(z.string()).min(1).describe('Array of block IDs to read'),
      withContext: z.boolean().optional().default(false).describe('Include surrounding context'),
    }),
    func: async ({ blockIds, withContext }) => {
      const ids = blockIds.slice(0, MAX_BATCH_SIZE)
      ctx.guard.markDocumentRead()
      ctx.guard.markBlocksRead(ids)

      const blocks = ids.map((id) => {
        const result = ctx.blockIndex.getWithContext(id)
        if (!result.block) {
          return { id, ok: false, error: 'Block not found' }
        }

        // Mark context blocks as read
        if (withContext) {
          const ctxIds = [
            ...result.before.map(b => b.id),
            ...result.after.map(b => b.id),
          ]
          ctx.guard.markBlocksRead(ctxIds)
        }

        // Use effective content (with pending overlay)
        const content = ctx.blockIndex.getEffectiveContent(id, ctx.pendingDiffs) ?? result.block.content

        return {
          id,
          ok: true,
          type: result.block.type,
          content,
          contextBefore: withContext ? result.before.map(b => ({ id: b.id, preview: b.content.slice(0, 30) })) : undefined,
          contextAfter: withContext ? result.after.map(b => ({ id: b.id, preview: b.content.slice(0, 30) })) : undefined,
        }
      })

      return JSON.stringify({ blocks }, null, 2)
    },
  })
}

export function createEditBlockTool(ctx: ToolContext) {
  return new DynamicStructuredTool({
    name: 'edit_block',
    description: 'Edit ONE block. Use edit_blocks instead for 2+ edits.',
    schema: z.object({
      blockId: z.string().describe('The ID of the block to edit'),
      newContent: z.string().describe('The new content for the block'),
      reason: z.string().describe('Brief reason for this change'),
    }),
    func: async ({ blockId, newContent, reason }) => {
      const check = ctx.guard.canEdit(blockId)
      if (!check.allowed) {
        return `Error: ${check.error}`
      }

      // Use effective content for oldContent (with pending overlay)
      const oldContent = ctx.blockIndex.getEffectiveContent(blockId, ctx.pendingDiffs)
      if (oldContent === null) {
        return `Error: Block "${blockId}" not found or deleted`
      }

      const diff: PendingDiff = {
        id: generateDiffId(),
        blockId,
        action: 'update',
        oldContent,
        newContent,
        reason,
      }

      ctx.pendingDiffs.push(diff)
      ctx.onDiffCreated?.(diff)

      return `Created pending edit for block ${blockId}. Diff ID: ${diff.id}\nOld: ${oldContent.slice(0, 50)}...\nNew: ${newContent.slice(0, 50)}...\nReason: ${reason}\n\nUser must confirm this change.`
    },
  })
}

export function createEditBlocksTool(ctx: ToolContext) {
  return new DynamicStructuredTool({
    name: 'edit_blocks',
    description: 'PREFERRED: Batch edit multiple blocks in ONE call. Always use this over edit_block.',
    schema: z.object({
      edits: z.array(z.object({
        blockId: z.string().describe('Block ID'),
        newContent: z.string().describe('New content'),
        reason: z.string().describe('Brief reason'),
      })).min(1).describe('Array of edits'),
    }),
    func: async ({ edits }) => {
      const batch = edits.slice(0, MAX_BATCH_SIZE)

      const results = batch.map((e) => {
        const check = ctx.guard.canEdit(e.blockId)
        if (!check.allowed) {
          return { blockId: e.blockId, ok: false, error: check.error }
        }

        // Use effective content for oldContent (with pending overlay)
        const oldContent = ctx.blockIndex.getEffectiveContent(e.blockId, ctx.pendingDiffs)
        if (oldContent === null) {
          return { blockId: e.blockId, ok: false, error: 'Block not found or deleted' }
        }

        const diff: PendingDiff = {
          id: generateDiffId(),
          blockId: e.blockId,
          action: 'update',
          oldContent,
          newContent: e.newContent,
          reason: e.reason,
        }
        ctx.pendingDiffs.push(diff)
        ctx.onDiffCreated?.(diff)
        return { blockId: e.blockId, ok: true, diffId: diff.id }
      })

      return JSON.stringify({ results }, null, 2)
    },
  })
}

export function createAddBlockTool(ctx: ToolContext) {
  return new DynamicStructuredTool({
    name: 'add_block',
    description: 'Add a new block after a specified block. Use afterBlockId=null to insert at the beginning. Content must not be empty.',
    schema: z.object({
      afterBlockId: z.string().nullable().describe('ID of block to insert after, or null for beginning'),
      type: z.enum(['heading', 'paragraph', 'code', 'list-item']).describe('Type of the new block'),
      content: z.string().min(1).describe('Content of the new block (must not be empty)'),
      level: z.number().optional().describe('Level for headings (1-6) or list nesting depth'),
      reason: z.string().describe('Explanation of why this block is being added'),
    }),
    func: async ({ afterBlockId, type, content, level, reason }) => {
      // Validate content is not empty or whitespace-only
      if (!content.trim()) {
        return `Error: Content cannot be empty or whitespace-only. Please provide meaningful content.`
      }

      const check = ctx.guard.canAdd()
      if (!check.allowed) {
        return `Error: ${check.error}`
      }

      if (afterBlockId) {
        const block = ctx.blockIndex.getById(afterBlockId)
        if (!block) {
          return `Error: Block "${afterBlockId}" not found`
        }
      }

      const diff: PendingDiff = {
        id: generateDiffId(),
        blockId: afterBlockId || '__start__',
        action: 'add',
        oldContent: '',
        newContent: JSON.stringify({ type, content: content.trim(), level }),
        reason,
      }

      ctx.pendingDiffs.push(diff)
      ctx.onDiffCreated?.(diff)

      return `Created pending add after ${afterBlockId || 'start'}. Diff ID: ${diff.id}\nType: ${type}\nContent: ${content.slice(0, 50)}...\nReason: ${reason}\n\nUser must confirm this change.`
    },
  })
}

export function createDeleteBlockTool(ctx: ToolContext) {
  return new DynamicStructuredTool({
    name: 'delete_block',
    description: 'Delete a specific block. MUST call read_block first.',
    schema: z.object({
      blockId: z.string().describe('The ID of the block to delete'),
      reason: z.string().describe('Explanation of why this block is being deleted'),
    }),
    func: async ({ blockId, reason }) => {
      const check = ctx.guard.canDelete(blockId)
      if (!check.allowed) {
        return `Error: ${check.error}`
      }

      const block = ctx.blockIndex.getById(blockId)
      if (!block) {
        return `Error: Block "${blockId}" not found`
      }

      const diff: PendingDiff = {
        id: generateDiffId(),
        blockId,
        action: 'delete',
        oldContent: block.content,
        newContent: '',
        reason,
      }

      ctx.pendingDiffs.push(diff)
      ctx.onDiffCreated?.(diff)

      return `Created pending delete for block ${blockId}. Diff ID: ${diff.id}\nContent to delete: ${block.content.slice(0, 50)}...\nReason: ${reason}\n\nUser must confirm this change.`
    },
  })
}

export function createEditorTools(ctx: ToolContext) {
  return [
    createListBlocksTool(ctx),
    createReadBlockTool(ctx),
    createReadBlocksTool(ctx),
    createEditBlockTool(ctx),
    createEditBlocksTool(ctx),
    createAddBlockTool(ctx),
    createDeleteBlockTool(ctx),
  ]
}
