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

export function createAddBlocksTool(ctx: ToolContext) {
  return new DynamicStructuredTool({
    name: 'add_blocks',
    description: 'PREFERRED: Batch add multiple blocks in ONE call (max 25). Always use this over add_block.',
    schema: z.object({
      additions: z.array(z.object({
        afterBlockId: z.string().nullable().describe('ID of block to insert after, or null for beginning'),
        type: z.enum(['heading', 'paragraph', 'code', 'list-item']).describe('Type of the new block'),
        content: z.string().min(1).describe('Content of the new block (must not be empty)'),
        level: z.number().optional().describe('Level for headings (1-6) or list nesting depth'),
        reason: z.string().describe('Explanation of why this block is being added'),
      })).min(1).describe('Array of additions'),
    }),
    func: async ({ additions }) => {
      const batch = additions.slice(0, MAX_BATCH_SIZE)

      const results = batch.map((a) => {
        // Validate content is not empty or whitespace-only
        if (!a.content.trim()) {
          return { afterBlockId: a.afterBlockId, ok: false, error: 'Content cannot be empty or whitespace-only' }
        }

        const check = ctx.guard.canAdd()
        if (!check.allowed) {
          return { afterBlockId: a.afterBlockId, ok: false, error: check.error }
        }

        if (a.afterBlockId) {
          const block = ctx.blockIndex.getById(a.afterBlockId)
          if (!block) {
            return { afterBlockId: a.afterBlockId, ok: false, error: `Block "${a.afterBlockId}" not found` }
          }
        }

        const diff: PendingDiff = {
          id: generateDiffId(),
          blockId: a.afterBlockId || '__start__',
          action: 'add',
          oldContent: '',
          newContent: JSON.stringify({ type: a.type, content: a.content.trim(), level: a.level }),
          reason: a.reason,
        }

        ctx.pendingDiffs.push(diff)
        ctx.onDiffCreated?.(diff)

        return { afterBlockId: a.afterBlockId, ok: true, diffId: diff.id }
      })

      return JSON.stringify({ results }, null, 2)
    },
  })
}

export function createDeleteBlocksTool(ctx: ToolContext) {
  return new DynamicStructuredTool({
    name: 'delete_blocks',
    description: 'PREFERRED: Batch delete multiple blocks in ONE call (max 25). MUST call read_blocks first.',
    schema: z.object({
      deletions: z.array(z.object({
        blockId: z.string().describe('The ID of the block to delete'),
        reason: z.string().describe('Explanation of why this block is being deleted'),
      })).min(1).describe('Array of deletions'),
    }),
    func: async ({ deletions }) => {
      const batch = deletions.slice(0, MAX_BATCH_SIZE)
      const blockIds = batch.map(d => d.blockId)

      // Batch validation using canDeleteBlocks
      const validation = ctx.guard.canDeleteBlocks(blockIds)

      const results = batch.map((d) => {
        // Check individual validation result
        if (validation.errors.has(d.blockId)) {
          return { blockId: d.blockId, ok: false, error: validation.errors.get(d.blockId) }
        }

        // Use effective content (with pending overlay)
        const oldContent = ctx.blockIndex.getEffectiveContent(d.blockId, ctx.pendingDiffs)
        if (oldContent === null) {
          const block = ctx.blockIndex.getById(d.blockId)
          if (!block) {
            return { blockId: d.blockId, ok: false, error: `Block "${d.blockId}" not found` }
          }
          return { blockId: d.blockId, ok: false, error: 'Block already deleted' }
        }

        const diff: PendingDiff = {
          id: generateDiffId(),
          blockId: d.blockId,
          action: 'delete',
          oldContent,
          newContent: '',
          reason: d.reason,
        }

        ctx.pendingDiffs.push(diff)
        ctx.onDiffCreated?.(diff)

        return { blockId: d.blockId, ok: true, diffId: diff.id }
      })

      return JSON.stringify({ results }, null, 2)
    },
  })
}

export function createEditorTools(ctx: ToolContext) {
  return [
    createListBlocksTool(ctx),
    createReadBlocksTool(ctx),
    createEditBlocksTool(ctx),
    createAddBlocksTool(ctx),
    createDeleteBlocksTool(ctx),
  ]
}

// Re-export multi-document tools
export { createListDocumentsTool, createSwitchDocumentTool, type MultiDocToolContext } from './document-tools'
