import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { BlockIndexService } from '../block-index'
import { ReadWriteGuard } from './middleware'
import type { ReadCache } from '../agent/runtime'
import type { Block, PendingDiff, BlockType, ToolContextState } from '../types'

const MAX_BATCH_SIZE = 25
const MAX_CONTENT_LENGTH = 50000

export interface ToolContext extends ToolContextState {
  blockIndex: BlockIndexService
  guard: ReadWriteGuard
  pendingDiffs: PendingDiff[]
  readCache: ReadCache
  onDiffCreated?: (diff: PendingDiff) => void
}

function generateDiffId(): string {
  return `diff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Block ID generator for add_blocks tool
function generateBlockId(ctx: ToolContext): string {
  const blockId = `block-${Date.now()}-${ctx.blockIdCounter}`
  ctx.blockIdCounter += 1
  return blockId
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
      const includeContext = Boolean(withContext)
      const pendingDiffsVersion = ctx.pendingDiffs.length

      ctx.guard.markDocumentRead()
      ctx.guard.markBlocksRead(ids)

      const blocks = ids.map((id) => {
        const cacheKey = `${id}:${includeContext ? '1' : '0'}:${pendingDiffsVersion}`
        const cached = ctx.readCache.get(cacheKey)
        if (cached) {
          const cachedBlock = JSON.parse(cached) as {
            id: string
            ok: boolean
            type?: BlockType
            content?: string
            error?: string
            contextBefore?: { id: string; preview: string }[]
            contextAfter?: { id: string; preview: string }[]
          }
          if (includeContext) {
            const ctxIds = [
              ...(cachedBlock.contextBefore ?? []).map(b => b.id),
              ...(cachedBlock.contextAfter ?? []).map(b => b.id),
            ]
            ctx.guard.markBlocksRead(ctxIds)
          }
          return cachedBlock
        }

        const result = ctx.blockIndex.getWithContext(id)
        if (!result.block) {
          const missing = { id, ok: false, error: 'Block not found' }
          ctx.readCache.set(cacheKey, JSON.stringify(missing))
          return missing
        }

        // Mark context blocks as read
        if (includeContext) {
          const ctxIds = [
            ...result.before.map(b => b.id),
            ...result.after.map(b => b.id),
          ]
          ctx.guard.markBlocksRead(ctxIds)
        }

        // Use effective content (with pending overlay)
        const content = ctx.blockIndex.getEffectiveContent(id, ctx.pendingDiffs) ?? result.block.content

        const blockData = {
          id,
          ok: true,
          type: result.block.type,
          content,
          contextBefore: includeContext ? result.before.map(b => ({ id: b.id, preview: b.content.slice(0, 30) })) : undefined,
          contextAfter: includeContext ? result.after.map(b => ({ id: b.id, preview: b.content.slice(0, 30) })) : undefined,
        }
        ctx.readCache.set(cacheKey, JSON.stringify(blockData))
        return blockData
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
      let didMutate = false

      const results = batch.map((e) => {
        const check = ctx.guard.canEdit(e.blockId)
        if (!check.allowed) {
          return { blockId: e.blockId, ok: false, error: check.error }
        }

        // Validate content length
        if (e.newContent.length > MAX_CONTENT_LENGTH) {
          return { blockId: e.blockId, ok: false, error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` }
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
        didMutate = true
        return { blockId: e.blockId, ok: true, diffId: diff.id }
      })

      if (didMutate) {
        ctx.readCache.invalidate()
      }

      return JSON.stringify({ results }, null, 2)
    },
  })
}

export function createAddBlocksTool(ctx: ToolContext) {
  return new DynamicStructuredTool({
    name: 'add_blocks',
    description: 'PREFERRED: Batch add multiple blocks in ONE call (max 25). POSITIONING: afterBlockId=null appends to END; afterBlockId=<blockId> inserts AFTER that block. CHAINING: First block uses target position, subsequent blocks use previous newBlockId.',
    schema: z.object({
      additions: z.array(z.object({
        afterBlockId: z.string().nullable().describe("ID of block to insert AFTER. Use null to append to document END. For middle insertions, use the target block's ID. When chaining multiple blocks, use previous block's newBlockId."),
        type: z.enum(['heading', 'paragraph', 'code', 'list-item']).describe('Type of the new block'),
        content: z.string().min(1).describe('Content of the new block (must not be empty)'),
        level: z.number().optional().describe('Level for headings (1-6) or list nesting depth'),
        reason: z.string().describe('Explanation of why this block is being added'),
      })).min(1).describe('Array of additions'),
    }),
    func: async ({ additions }) => {
      const batch = additions.slice(0, MAX_BATCH_SIZE)
      let didMutate = false

      // Track the last successfully added block's ID for auto-chaining
      let lastAddedBlockId: string | null = null

      const results = batch.map((a, index) => {
        // Validate content is not empty or whitespace-only
        if (!a.content.trim()) {
          return { afterBlockId: a.afterBlockId, ok: false, error: 'Content cannot be empty or whitespace-only' }
        }

        // Validate content length
        if (a.content.length > MAX_CONTENT_LENGTH) {
          return { afterBlockId: a.afterBlockId, ok: false, error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` }
        }

        const check = ctx.guard.canAdd()
        if (!check.allowed) {
          return { afterBlockId: a.afterBlockId, ok: false, error: check.error }
        }

        // Auto-chain: For batch additions, always chain subsequent blocks to the previous one
        // This ensures correct ordering regardless of what afterBlockId the LLM specifies
        let effectiveAfterBlockId = a.afterBlockId
        if (index > 0 && lastAddedBlockId !== null) {
          // Always chain to the previous block in the batch
          effectiveAfterBlockId = lastAddedBlockId
        }

        if (effectiveAfterBlockId) {
          // Check if it's a newly created block from this batch or an existing block
          const isNewBlock = effectiveAfterBlockId.startsWith('block-')
          if (!isNewBlock) {
            const block = ctx.blockIndex.getById(effectiveAfterBlockId)
            if (!block) {
              return { afterBlockId: a.afterBlockId, ok: false, error: `Block "${effectiveAfterBlockId}" not found` }
            }
          }
        }

        const newBlockId = generateBlockId(ctx) // pre-generate block ID

        const diff: PendingDiff = {
          id: generateDiffId(),
          blockId: effectiveAfterBlockId || '__start__',
          newBlockId, // store pre-generated ID
          action: 'add',
          oldContent: '',
          newContent: JSON.stringify({ type: a.type, content: a.content.trim(), level: a.level }),
          reason: a.reason,
        }

        ctx.pendingDiffs.push(diff)
        ctx.onDiffCreated?.(diff)
        didMutate = true

        // Update tracking for auto-chaining
        lastAddedBlockId = newBlockId

        return { afterBlockId: a.afterBlockId, ok: true, diffId: diff.id, newBlockId }
      })

      if (didMutate) {
        ctx.readCache.invalidate()
      }

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
      let didMutate = false

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
        didMutate = true

        return { blockId: d.blockId, ok: true, diffId: diff.id }
      })

      if (didMutate) {
        ctx.readCache.invalidate()
      }

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
