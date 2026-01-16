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
  createReadBlockTool,
  createEditBlockTool,
  createAddBlockTool,
  createDeleteBlockTool,
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

  describe('read_block tool', () => {
    it('should return block content with context', async () => {
      const tool = createReadBlockTool(ctx)
      const result = await tool.func({ blockId: 'b2' })

      expect(result).toContain('This is the first paragraph.')
      expect(result).toContain('paragraph')
      expect(result).toContain('Context before')
      expect(result).toContain('Context after')
    })

    it('should mark block as read', async () => {
      const tool = createReadBlockTool(ctx)
      await tool.func({ blockId: 'b2' })

      expect(ctx.guard.hasReadBlock('b2')).toBe(true)
    })

    it('should return error for non-existent block', async () => {
      const tool = createReadBlockTool(ctx)
      const result = await tool.func({ blockId: 'nonexistent' })

      expect(result).toContain('Error')
      expect(result).toContain('not found')
    })
  })

  describe('edit_block tool', () => {
    it('should create pending diff when properly authorized', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('b2')

      const tool = createEditBlockTool(ctx)
      const result = await tool.func({
        blockId: 'b2',
        newContent: 'Updated paragraph.',
        reason: 'User requested update',
      })

      expect(result).toContain('pending edit')
      expect(pendingDiffs).toHaveLength(1)
      expect(pendingDiffs[0].action).toBe('update')
      expect(pendingDiffs[0].oldContent).toBe('This is the first paragraph.')
      expect(pendingDiffs[0].newContent).toBe('Updated paragraph.')
    })

    it('should reject edit without reading document first', async () => {
      const tool = createEditBlockTool(ctx)
      const result = await tool.func({
        blockId: 'b2',
        newContent: 'Updated',
        reason: 'Test',
      })

      expect(result).toContain('Error')
      expect(result).toContain('list_blocks')
      expect(pendingDiffs).toHaveLength(0)
    })

    it('should reject edit without reading block first', async () => {
      ctx.guard.markDocumentRead()

      const tool = createEditBlockTool(ctx)
      const result = await tool.func({
        blockId: 'b2',
        newContent: 'Updated',
        reason: 'Test',
      })

      expect(result).toContain('Error')
      expect(result).toContain('read_block')
      expect(pendingDiffs).toHaveLength(0)
    })

    it('should return error for non-existent block', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('nonexistent')

      const tool = createEditBlockTool(ctx)
      const result = await tool.func({
        blockId: 'nonexistent',
        newContent: 'Updated',
        reason: 'Test',
      })

      expect(result).toContain('Error')
      expect(result).toContain('not found')
    })

    it('should call onDiffCreated callback', async () => {
      const onDiffCreated = jest.fn()
      ctx.onDiffCreated = onDiffCreated
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('b2')

      const tool = createEditBlockTool(ctx)
      await tool.func({
        blockId: 'b2',
        newContent: 'Updated',
        reason: 'Test',
      })

      expect(onDiffCreated).toHaveBeenCalledTimes(1)
      expect(onDiffCreated).toHaveBeenCalledWith(expect.objectContaining({
        action: 'update',
        blockId: 'b2',
      }))
    })
  })

  describe('add_block tool', () => {
    it('should create pending diff for adding block', async () => {
      ctx.guard.markDocumentRead()

      const tool = createAddBlockTool(ctx)
      const result = await tool.func({
        afterBlockId: 'b1',
        type: 'paragraph',
        content: 'New paragraph',
        reason: 'Adding content',
      })

      expect(result).toContain('pending add')
      expect(pendingDiffs).toHaveLength(1)
      expect(pendingDiffs[0].action).toBe('add')
      expect(pendingDiffs[0].blockId).toBe('b1')
    })

    it('should support adding at beginning with null afterBlockId', async () => {
      ctx.guard.markDocumentRead()

      const tool = createAddBlockTool(ctx)
      const result = await tool.func({
        afterBlockId: null,
        type: 'heading',
        content: 'New Title',
        level: 1,
        reason: 'Adding title',
      })

      expect(result).toContain('pending add')
      expect(result).toContain('start')
      expect(pendingDiffs[0].blockId).toBe('__start__')
    })

    it('should reject add without reading document', async () => {
      const tool = createAddBlockTool(ctx)
      const result = await tool.func({
        afterBlockId: 'b1',
        type: 'paragraph',
        content: 'New',
        reason: 'Test',
      })

      expect(result).toContain('Error')
      expect(pendingDiffs).toHaveLength(0)
    })

    it('should return error for non-existent afterBlockId', async () => {
      ctx.guard.markDocumentRead()

      const tool = createAddBlockTool(ctx)
      const result = await tool.func({
        afterBlockId: 'nonexistent',
        type: 'paragraph',
        content: 'New',
        reason: 'Test',
      })

      expect(result).toContain('Error')
      expect(result).toContain('not found')
    })
  })

  describe('delete_block tool', () => {
    it('should create pending diff for deletion', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('b2')

      const tool = createDeleteBlockTool(ctx)
      const result = await tool.func({
        blockId: 'b2',
        reason: 'Removing unnecessary content',
      })

      expect(result).toContain('pending delete')
      expect(pendingDiffs).toHaveLength(1)
      expect(pendingDiffs[0].action).toBe('delete')
      expect(pendingDiffs[0].oldContent).toBe('This is the first paragraph.')
      expect(pendingDiffs[0].newContent).toBe('')
    })

    it('should reject delete without reading block', async () => {
      ctx.guard.markDocumentRead()

      const tool = createDeleteBlockTool(ctx)
      const result = await tool.func({
        blockId: 'b2',
        reason: 'Test',
      })

      expect(result).toContain('Error')
      expect(pendingDiffs).toHaveLength(0)
    })
  })

  describe('createEditorTools', () => {
    it('should create all 7 tools', () => {
      const tools = createEditorTools(ctx)

      expect(tools).toHaveLength(7)
      expect(tools.map(t => t.name)).toEqual([
        'list_blocks',
        'read_block',
        'read_blocks',
        'edit_block',
        'edit_blocks',
        'add_block',
        'delete_block',
      ])
    })
  })
})
