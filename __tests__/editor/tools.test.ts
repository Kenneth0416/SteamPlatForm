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
import { ReadCache, ToolTrace, detectStuck } from '@/lib/editor/agent/runtime'
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
      readCache: new ReadCache(),
      blockIdCounter: 0,
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

    it('should use cache for repeated reads with same context and pending diffs', async () => {
      const tool = createReadBlocksTool(ctx)
      const getWithContextSpy = jest.spyOn(ctx.blockIndex, 'getWithContext')

      await tool.func({ blockIds: ['b1'], withContext: false })
      await tool.func({ blockIds: ['b1'], withContext: false })

      expect(getWithContextSpy).toHaveBeenCalledTimes(1)
    })

    it('should bypass cache when withContext changes', async () => {
      const tool = createReadBlocksTool(ctx)
      const getWithContextSpy = jest.spyOn(ctx.blockIndex, 'getWithContext')

      await tool.func({ blockIds: ['b2'], withContext: false })
      await tool.func({ blockIds: ['b2'], withContext: true })

      expect(getWithContextSpy).toHaveBeenCalledTimes(2)
    })

    it('should reuse cached context reads and mark context blocks', async () => {
      const tool = createReadBlocksTool(ctx)
      const getWithContextSpy = jest.spyOn(ctx.blockIndex, 'getWithContext')

      await tool.func({ blockIds: ['b2'], withContext: true })
      ctx.guard.reset()

      await tool.func({ blockIds: ['b2'], withContext: true })

      expect(getWithContextSpy).toHaveBeenCalledTimes(1)
      expect(ctx.guard.hasReadBlock('b1')).toBe(true)
      expect(ctx.guard.hasReadBlock('b3')).toBe(true)
    })

    it('should handle cached entries without context arrays', async () => {
      const tool = createReadBlocksTool(ctx)
      ctx.readCache.set('b1:1:0', JSON.stringify({
        id: 'b1',
        ok: true,
        type: 'heading',
        content: 'Cached heading',
      }))

      const result = await tool.func({ blockIds: ['b1'], withContext: true })
      const parsed = JSON.parse(result)
      expect(parsed.blocks[0].content).toBe('Cached heading')
      expect(ctx.guard.hasReadBlock('b1')).toBe(true)
    })

    it('should fall back to original content when effective content is null', async () => {
      ctx.pendingDiffs.push({
        id: 'diff-delete',
        blockId: 'b1',
        action: 'delete',
        oldContent: 'Introduction',
        newContent: '',
        reason: 'Test delete',
      })

      const tool = createReadBlocksTool(ctx)
      const result = await tool.func({ blockIds: ['b1'], withContext: false })
      const parsed = JSON.parse(result)
      expect(parsed.blocks[0].content).toBe('Introduction')
    })
  })

  describe('edit_blocks tool', () => {
    it('should create pending diffs for multiple edits', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlocksRead(['b1', 'b2'])
      ctx.readCache.set('cache-key', 'cached')

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
      expect(ctx.readCache.size()).toBe(0)
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

    it('should accept content at max length (50000 characters)', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('b1')

      const tool = createEditBlocksTool(ctx)
      const maxContent = 'a'.repeat(50000)
      const result = await tool.func({
        edits: [{ blockId: 'b1', newContent: maxContent, reason: 'Test' }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results[0].ok).toBe(true)
    })

    it('should reject content exceeding max length (50001 characters)', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('b1')

      const tool = createEditBlocksTool(ctx)
      const tooLongContent = 'a'.repeat(50001)
      const result = await tool.func({
        edits: [{ blockId: 'b1', newContent: tooLongContent, reason: 'Test' }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results[0].ok).toBe(false)
      expect(parsed.results[0].error).toContain('Content exceeds maximum length of 50000 characters')
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

      ctx.readCache.set('cache-key', 'cached')

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
      expect(ctx.readCache.size()).toBe(0)
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

    it('should auto-chain additions within a batch', async () => {
      ctx.guard.markDocumentRead()

      const tool = createAddBlocksTool(ctx)
      const result = await tool.func({
        additions: [
          {
            afterBlockId: 'b1',
            type: 'paragraph',
            content: 'First',
            reason: 'Test',
          },
          {
            afterBlockId: 'b1',
            type: 'paragraph',
            content: 'Second',
            reason: 'Test',
          },
        ],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results).toHaveLength(2)
      expect(parsed.results[0].ok).toBe(true)
      expect(parsed.results[1].ok).toBe(true)
      expect(pendingDiffs[1].blockId).toBe(pendingDiffs[0].newBlockId)
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

    it('should accept content at max length (50000 characters)', async () => {
      ctx.guard.markDocumentRead()

      const tool = createAddBlocksTool(ctx)
      const maxContent = 'a'.repeat(50000)
      const result = await tool.func({
        additions: [{
          afterBlockId: 'b1',
          type: 'paragraph',
          content: maxContent,
          reason: 'Test',
        }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results[0].ok).toBe(true)
    })

    it('should reject content exceeding max length (50001 characters)', async () => {
      ctx.guard.markDocumentRead()

      const tool = createAddBlocksTool(ctx)
      const tooLongContent = 'a'.repeat(50001)
      const result = await tool.func({
        additions: [{
          afterBlockId: 'b1',
          type: 'paragraph',
          content: tooLongContent,
          reason: 'Test',
        }],
      })

      const parsed = JSON.parse(result)
      expect(parsed.results[0].ok).toBe(false)
      expect(parsed.results[0].error).toContain('Content exceeds maximum length of 50000 characters')
    })
  })

  describe('delete_blocks tool', () => {
    it('should create pending diff for deletion', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('b2')
      ctx.readCache.set('cache-key', 'cached')

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
      expect(ctx.readCache.size()).toBe(0)
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

    it('should return error when block already deleted', async () => {
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('b2')
      ctx.pendingDiffs.push({
        id: 'diff-del',
        blockId: 'b2',
        action: 'delete',
        oldContent: 'This is the first paragraph.',
        newContent: '',
        reason: 'Test',
      })

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
      expect(parsed.results[0].error).toContain('already deleted')
    })

    it('should generate unique IDs across document switches', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1712345678901)

      try {
        ctx.guard.markDocumentRead()
        const tool = createAddBlocksTool(ctx)
        const firstResult = await tool.func({
          additions: [{
            afterBlockId: 'b1',
            type: 'paragraph',
            content: 'Doc A block',
            reason: 'Test A',
          }],
        })

        const firstParsed = JSON.parse(firstResult)
        const firstId = firstParsed.results[0].newBlockId as string

        ctx.guard.reset()
        ctx.blockIndex = new BlockIndexService([
          { id: 'c1', type: 'heading', content: 'Doc B', order: 0, level: 1 },
        ])
        ctx.guard.markDocumentRead()

        const secondResult = await tool.func({
          additions: [{
            afterBlockId: 'c1',
            type: 'paragraph',
            content: 'Doc B block',
            reason: 'Test B',
          }],
        })

        const secondParsed = JSON.parse(secondResult)
        const secondId = secondParsed.results[0].newBlockId as string

        expect(firstId).not.toBe(secondId)
      } finally {
        nowSpy.mockRestore()
      }
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

describe('Runtime utilities', () => {
  it('should maintain ToolTrace ring buffer behavior', () => {
    const trace = new ToolTrace(2)
    trace.add({ name: 'list_blocks', args: {}, status: 'success', timestamp: 1 })
    trace.add({ name: 'read_blocks', args: { blockIds: ['b1'] }, status: 'success', timestamp: 2 })
    trace.add({ name: 'edit_blocks', args: { edits: [] }, status: 'error', timestamp: 3 })

    expect(trace.size()).toBe(2)
    const recent = trace.getRecent()
    expect(recent[0].name).toBe('read_blocks')
    expect(recent[1].name).toBe('edit_blocks')

    trace.clear()
    expect(trace.size()).toBe(0)
  })

  it('should support ReadCache operations', () => {
    const cache = new ReadCache()
    expect(cache.size()).toBe(0)
    expect(cache.has('b1')).toBe(false)

    cache.set('b1', 'content')
    expect(cache.has('b1')).toBe(true)
    expect(cache.get('b1')).toBe('content')
    expect(cache.size()).toBe(1)

    cache.invalidate()
    expect(cache.size()).toBe(0)
    expect(cache.get('b1')).toBeUndefined()
  })

  it('should detect stuck patterns from repeated calls', () => {
    const trace = new ToolTrace(10)
    trace.add({ name: 'list_blocks', args: {}, status: 'success', timestamp: 1 })
    trace.add({ name: 'list_blocks', args: {}, status: 'success', timestamp: 2 })
    trace.add({ name: 'list_blocks', args: {}, status: 'success', timestamp: 3 })
    const listResult = detectStuck(trace)
    expect(listResult.isStuck).toBe(true)
    expect(listResult.reason).toContain('list_blocks')

    trace.clear()
    trace.add({ name: 'read_blocks', args: { blockIds: ['b1'] }, status: 'success', timestamp: 1 })
    trace.add({ name: 'read_blocks', args: { blockIds: ['b1'] }, status: 'success', timestamp: 2 })
    trace.add({ name: 'read_blocks', args: { blockIds: ['b1'] }, status: 'success', timestamp: 3 })
    const readResult = detectStuck(trace)
    expect(readResult.isStuck).toBe(true)
    expect(readResult.reason).toContain('read_blocks')
  })

  it('should detect no-progress loops and allow mutations', () => {
    const trace = new ToolTrace(10)
    for (let i = 0; i < 10; i++) {
      trace.add({
        name: i % 2 === 0 ? 'list_blocks' : 'read_blocks',
        args: i % 2 === 0 ? {} : { blockIds: ['b1'] },
        status: 'success',
        timestamp: i,
      })
    }
    const noProgress = detectStuck(trace)
    expect(noProgress.isStuck).toBe(true)
    expect(noProgress.reason).toContain('without any edit/add/delete')

    trace.clear()
    trace.add({ name: 'list_blocks', args: {}, status: 'success', timestamp: 1 })
    trace.add({ name: 'edit_blocks', args: { edits: [] }, status: 'success', timestamp: 2 })
    trace.add({ name: 'read_blocks', args: { blockIds: ['b1'] }, status: 'success', timestamp: 3 })
    const okResult = detectStuck(trace)
    expect(okResult.isStuck).toBe(false)
  })

  it('should return non-stuck when too few entries', () => {
    const trace = new ToolTrace(10)
    trace.add({ name: 'list_blocks', args: {}, status: 'success', timestamp: 1 })
    trace.add({ name: 'read_blocks', args: { blockIds: ['b1'] }, status: 'success', timestamp: 2 })
    const result = detectStuck(trace)
    expect(result.isStuck).toBe(false)
  })
})
