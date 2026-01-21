// Mock LangChain tools before importing
jest.mock('@langchain/core/tools', () => ({
  DynamicStructuredTool: class MockTool {
    name: string
    description: string
    schema: unknown
    func: (args: unknown) => Promise<string>

    constructor(opts: { name: string; description: string; schema: unknown; func: (args: unknown) => Promise<string> }) {
      this.name = opts.name
      this.description = opts.description
      this.schema = opts.schema
      this.func = opts.func
    }
  },
}))

import { BlockIndexService } from '@/lib/editor/block-index'
import { ReadWriteGuard } from '@/lib/editor/tools/middleware'
import {
  createListBlocksTool,
  createReadBlocksTool,
  createEditBlocksTool,
  createAddBlocksTool,
  createDeleteBlocksTool,
  createEditorTools,
  ToolContext,
} from '@/lib/editor/tools'
import type { Block, PendingDiff } from '@/lib/editor/types'

describe('LLM Tools', () => {
  const sampleBlocks: Block[] = [
    { id: 'b1', type: 'heading', content: 'Introduction', order: 0, level: 1 },
    { id: 'b2', type: 'paragraph', content: 'This is the first paragraph.', order: 1 },
    { id: 'b3', type: 'list-item', content: 'Step one', order: 2, level: 0 },
  ]

  let ctx: ToolContext
  let pendingDiffs: PendingDiff[]

  beforeEach(() => {
    pendingDiffs = []
    ctx = {
      blockIndex: new BlockIndexService(sampleBlocks),
      guard: new ReadWriteGuard(),
      pendingDiffs,
    }
  })

  describe('list_blocks tool', () => {
    it('should list all blocks with summaries', async () => {
      const tool = createListBlocksTool(ctx)
      const result = await tool.func({})

      expect(result).toContain('3 blocks')
      expect(result).toContain('[b1]')
      expect(result).toContain('heading')
      expect(result).toContain('Introduction')
    })

    it('should mark document as read', async () => {
      const tool = createListBlocksTool(ctx)
      await tool.func({})

      expect(ctx.guard.hasReadDocument()).toBe(true)
    })
  })

  describe('read_blocks tool', () => {
    it('should read multiple blocks', async () => {
      const tool = createReadBlocksTool(ctx)
      const result = await tool.func({ blockIds: ['b1', 'b2'] })

      const parsed = JSON.parse(result)
      expect(parsed.blocks).toHaveLength(2)
      expect(parsed.blocks[0].id).toBe('b1')
      expect(parsed.blocks[0].ok).toBe(true)
      expect(parsed.blocks[0].content).toBe('Introduction')
      expect(parsed.blocks[1].id).toBe('b2')
      expect(parsed.blocks[1].content).toBe('This is the first paragraph.')
    })

    it('should include context when requested', async () => {
      const tool = createReadBlocksTool(ctx)
      const result = await tool.func({ blockIds: ['b2'], withContext: true })

      const parsed = JSON.parse(result)
      expect(parsed.blocks[0].contextBefore).toBeDefined()
      expect(parsed.blocks[0].contextAfter).toBeDefined()
    })

    it('should handle non-existent blocks', async () => {
      const tool = createReadBlocksTool(ctx)
      const result = await tool.func({ blockIds: ['nonexistent'] })

      const parsed = JSON.parse(result)
      expect(parsed.blocks[0].ok).toBe(false)
      expect(parsed.blocks[0].error).toBe('Block not found')
    })
  })

  describe('edit_blocks tool', () => {
    it('should create pending diffs for multiple edits', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlocksRead(['b1', 'b2'])

      const tool = createEditBlocksTool(ctx)
      const result = await tool.func({
        edits: [
          { blockId: 'b1', newContent: 'Updated heading', reason: 'Update title' },
          { blockId: 'b2', newContent: 'Updated paragraph', reason: 'Update content' },
        ],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results).toHaveLength(2)
      expect(parsed.results[0].ok).toBe(true)
      expect(parsed.results[1].ok).toBe(true)
      expect(pendingDiffs).toHaveLength(2)
    })

    it('should handle errors for individual edits', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('b1')

      const tool = createEditBlocksTool(ctx)
      const result = await tool.func({
        edits: [
          { blockId: 'b1', newContent: 'Updated', reason: 'Test' },
          { blockId: 'nonexistent', newContent: 'Updated', reason: 'Test' },
        ],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results[0].ok).toBe(true)
      expect(parsed.results[1].ok).toBe(false)
      expect(parsed.results[1].error).toContain('read_blocks')
    })

    it('should call onDiffCreated for each edit', async () => {
      const onDiffCreated = jest.fn()
      ctx.onDiffCreated = onDiffCreated
      ctx.guard.markDocumentRead()
      ctx.guard.markBlocksRead(['b1', 'b2'])

      const tool = createEditBlocksTool(ctx)
      await tool.func({
        edits: [
          { blockId: 'b1', newContent: 'Updated 1', reason: 'Test 1' },
          { blockId: 'b2', newContent: 'Updated 2', reason: 'Test 2' },
        ],
      })

      expect(onDiffCreated).toHaveBeenCalledTimes(2)
    })

    it('should handle deleted blocks', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('b1')

      // Simulate a deleted block by adding a delete diff
      ctx.pendingDiffs.push({
        id: 'diff-1',
        blockId: 'b1',
        action: 'delete',
        oldContent: 'Introduction',
        newContent: '',
        reason: 'Test delete',
      })

      const tool = createEditBlocksTool(ctx)
      const result = await tool.func({
        edits: [{ blockId: 'b1', newContent: 'Updated', reason: 'Test' }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results[0].ok).toBe(false)
      expect(parsed.results[0].error).toContain('not found or deleted')
    })
  })

  describe('add_blocks tool', () => {
    it('should reject empty content', async () => {
      ctx.guard.markDocumentRead()

      const tool = createAddBlocksTool(ctx)
      const result = await tool.func({
        additions: [{
          afterBlockId: 'b1',
          type: 'paragraph',
          content: '   ',
          reason: 'Test',
        }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results).toHaveLength(1)
      expect(parsed.results[0].ok).toBe(false)
      expect(parsed.results[0].error).toContain('empty or whitespace-only')
    })
    it('should create pending diff for adding block', async () => {
      ctx.guard.markDocumentRead()

      const tool = createAddBlocksTool(ctx)
      const result = await tool.func({
        additions: [{
          afterBlockId: 'b1',
          type: 'paragraph',
          content: 'New paragraph',
          reason: 'Adding content',
        }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results).toHaveLength(1)
      expect(parsed.results[0].ok).toBe(true)
      expect(parsed.results[0].diffId).toBeDefined()
      expect(pendingDiffs).toHaveLength(1)
      expect(pendingDiffs[0].action).toBe('add')
      expect(pendingDiffs[0].blockId).toBe('b1')
    })

    it('should support adding at beginning with null afterBlockId', async () => {
      ctx.guard.markDocumentRead()

      const tool = createAddBlocksTool(ctx)
      const result = await tool.func({
        additions: [{
          afterBlockId: null,
          type: 'heading',
          content: 'New Title',
          level: 1,
          reason: 'Adding title',
        }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results).toHaveLength(1)
      expect(parsed.results[0].ok).toBe(true)
      expect(parsed.results[0].afterBlockId).toBe(null)
      expect(pendingDiffs[0].blockId).toBe('__start__')
    })

    it('should reject add without reading document', async () => {
      const tool = createAddBlocksTool(ctx)
      const result = await tool.func({
        additions: [{
          afterBlockId: 'b1',
          type: 'paragraph',
          content: 'New',
          reason: 'Test',
        }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results).toHaveLength(1)
      expect(parsed.results[0].ok).toBe(false)
      expect(parsed.results[0].error).toContain('list_blocks')
      expect(pendingDiffs).toHaveLength(0)
    })

    it('should return error for non-existent afterBlockId', async () => {
      ctx.guard.markDocumentRead()

      const tool = createAddBlocksTool(ctx)
      const result = await tool.func({
        additions: [{
          afterBlockId: 'nonexistent',
          type: 'paragraph',
          content: 'New',
          reason: 'Test',
        }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results).toHaveLength(1)
      expect(parsed.results[0].ok).toBe(false)
      expect(parsed.results[0].error).toContain('not found')
    })
  })

  describe('delete_blocks tool', () => {
    it('should create pending diff for deletion', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('b2')

      const tool = createDeleteBlocksTool(ctx)
      const result = await tool.func({
        deletions: [{
          blockId: 'b2',
          reason: 'Removing unnecessary content',
        }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results).toHaveLength(1)
      expect(parsed.results[0].ok).toBe(true)
      expect(parsed.results[0].diffId).toBeDefined()
      expect(pendingDiffs).toHaveLength(1)
      expect(pendingDiffs[0].action).toBe('delete')
      expect(pendingDiffs[0].oldContent).toBe('This is the first paragraph.')
      expect(pendingDiffs[0].newContent).toBe('')
    })

    it('should reject delete without reading block', async () => {
      ctx.guard.markDocumentRead()

      const tool = createDeleteBlocksTool(ctx)
      const result = await tool.func({
        deletions: [{
          blockId: 'b2',
          reason: 'Test',
        }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results).toHaveLength(1)
      expect(parsed.results[0].ok).toBe(false)
      expect(parsed.results[0].error).toContain('read_blocks')
      expect(pendingDiffs).toHaveLength(0)
    })

    it('should return error for non-existent block', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('nonexistent')

      const tool = createDeleteBlocksTool(ctx)
      const result = await tool.func({
        deletions: [{
          blockId: 'nonexistent',
          reason: 'Test',
        }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results).toHaveLength(1)
      expect(parsed.results[0].ok).toBe(false)
      expect(parsed.results[0].error).toContain('not found')
    })
  })

  describe('createEditorTools', () => {
    it('should create all 5 tools', () => {
      const tools = createEditorTools(ctx)

      expect(tools).toHaveLength(5)
      expect(tools.map(t => t.name)).toEqual([
        'list_blocks',
        'read_blocks',
        'edit_blocks',
        'add_blocks',
        'delete_blocks',
      ])
    })
  })
})
