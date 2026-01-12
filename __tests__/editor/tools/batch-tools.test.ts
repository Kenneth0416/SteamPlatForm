import { BlockIndexService } from '../../../lib/editor/block-index'
import { ReadWriteGuard } from '../../../lib/editor/tools/middleware'
import type { Block, PendingDiff } from '../../../lib/editor/types'

// Mock langchain tools to avoid ReadableStream issues
jest.mock('@langchain/core/tools', () => ({
  DynamicStructuredTool: jest.fn().mockImplementation((config) => ({
    name: config.name,
    description: config.description,
    schema: config.schema,
    func: config.func,
  })),
}))

// Import after mock
import {
  createReadBlocksTool,
  createEditBlocksTool,
  ToolContext,
} from '../../../lib/editor/tools'

function createTestBlocks(count: number): Block[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `block-${i}`,
    type: 'paragraph' as const,
    content: `Content of block ${i}`,
    order: i,
  }))
}

function createTestContext(blocks: Block[]): ToolContext & { pendingDiffs: PendingDiff[] } {
  const blockIndex = new BlockIndexService(blocks)
  const guard = new ReadWriteGuard()
  const pendingDiffs: PendingDiff[] = []
  return { blockIndex, guard, pendingDiffs }
}

describe('read_blocks tool', () => {
  it('should read multiple blocks and return JSON', async () => {
    const blocks = createTestBlocks(5)
    const ctx = createTestContext(blocks)
    const tool = createReadBlocksTool(ctx)

    const result = await tool.func({ blockIds: ['block-0', 'block-1', 'block-2'], withContext: false })
    const parsed = JSON.parse(result)

    expect(parsed.blocks).toHaveLength(3)
    expect(parsed.blocks[0]).toMatchObject({ id: 'block-0', ok: true, content: 'Content of block 0' })
    expect(parsed.blocks[1]).toMatchObject({ id: 'block-1', ok: true })
    expect(parsed.blocks[2]).toMatchObject({ id: 'block-2', ok: true })
  })

  it('should mark all blocks as read', async () => {
    const blocks = createTestBlocks(5)
    const ctx = createTestContext(blocks)
    const tool = createReadBlocksTool(ctx)

    await tool.func({ blockIds: ['block-0', 'block-1'], withContext: false })

    expect(ctx.guard.hasReadBlock('block-0')).toBe(true)
    expect(ctx.guard.hasReadBlock('block-1')).toBe(true)
    expect(ctx.guard.hasReadBlock('block-2')).toBe(false)
  })

  it('should mark document as read', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    const tool = createReadBlocksTool(ctx)

    expect(ctx.guard.hasReadDocument()).toBe(false)
    await tool.func({ blockIds: ['block-0'], withContext: false })
    expect(ctx.guard.hasReadDocument()).toBe(true)
  })

  it('should include context blocks when withContext is true', async () => {
    const blocks = createTestBlocks(5)
    const ctx = createTestContext(blocks)
    const tool = createReadBlocksTool(ctx)

    const result = await tool.func({ blockIds: ['block-2'], withContext: true })
    const parsed = JSON.parse(result)

    expect(parsed.blocks[0].contextBefore).toBeDefined()
    expect(parsed.blocks[0].contextAfter).toBeDefined()
  })

  it('should mark context blocks as read when withContext is true', async () => {
    const blocks = createTestBlocks(5)
    const ctx = createTestContext(blocks)
    const tool = createReadBlocksTool(ctx)

    await tool.func({ blockIds: ['block-2'], withContext: true })

    // block-1 and block-3 are context blocks
    expect(ctx.guard.hasReadBlock('block-1')).toBe(true)
    expect(ctx.guard.hasReadBlock('block-2')).toBe(true)
    expect(ctx.guard.hasReadBlock('block-3')).toBe(true)
  })

  it('should handle non-existent blocks gracefully', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    const tool = createReadBlocksTool(ctx)

    const result = await tool.func({ blockIds: ['block-0', 'nonexistent', 'block-1'], withContext: false })
    const parsed = JSON.parse(result)

    expect(parsed.blocks).toHaveLength(3)
    expect(parsed.blocks[0].ok).toBe(true)
    expect(parsed.blocks[1].ok).toBe(false)
    expect(parsed.blocks[1].error).toBe('Block not found')
    expect(parsed.blocks[2].ok).toBe(true)
  })

  it('should limit to MAX_BATCH_SIZE (25) blocks', async () => {
    const blocks = createTestBlocks(30)
    const ctx = createTestContext(blocks)
    const tool = createReadBlocksTool(ctx)

    const blockIds = blocks.map(b => b.id)
    const result = await tool.func({ blockIds, withContext: false })
    const parsed = JSON.parse(result)

    expect(parsed.blocks).toHaveLength(25)
  })

  it('should return effective content with pending overlay', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.pendingDiffs.push({
      id: 'diff-1',
      blockId: 'block-0',
      action: 'update',
      oldContent: 'Content of block 0',
      newContent: 'Updated content',
      reason: 'test',
    })
    const tool = createReadBlocksTool(ctx)

    const result = await tool.func({ blockIds: ['block-0'], withContext: false })
    const parsed = JSON.parse(result)

    expect(parsed.blocks[0].content).toBe('Updated content')
  })
})

describe('edit_blocks tool', () => {
  it('should create pending diffs for multiple blocks', async () => {
    const blocks = createTestBlocks(5)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlocksRead(['block-0', 'block-1', 'block-2'])
    const tool = createEditBlocksTool(ctx)

    const result = await tool.func({
      edits: [
        { blockId: 'block-0', newContent: 'New content 0', reason: 'Reason 0' },
        { blockId: 'block-1', newContent: 'New content 1', reason: 'Reason 1' },
      ],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results).toHaveLength(2)
    expect(parsed.results[0]).toMatchObject({ blockId: 'block-0', ok: true })
    expect(parsed.results[1]).toMatchObject({ blockId: 'block-1', ok: true })
    expect(ctx.pendingDiffs).toHaveLength(2)
  })

  it('should fail if document not read', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    const tool = createEditBlocksTool(ctx)

    const result = await tool.func({
      edits: [{ blockId: 'block-0', newContent: 'New', reason: 'test' }],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(false)
    expect(parsed.results[0].error).toContain('list_blocks')
  })

  it('should fail if block not read', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    const tool = createEditBlocksTool(ctx)

    const result = await tool.func({
      edits: [{ blockId: 'block-0', newContent: 'New', reason: 'test' }],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(false)
    expect(parsed.results[0].error).toContain('read_block')
  })

  it('should allow partial success', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlockRead('block-0')
    // block-1 not read
    const tool = createEditBlocksTool(ctx)

    const result = await tool.func({
      edits: [
        { blockId: 'block-0', newContent: 'New 0', reason: 'test' },
        { blockId: 'block-1', newContent: 'New 1', reason: 'test' },
      ],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(true)
    expect(parsed.results[1].ok).toBe(false)
    expect(ctx.pendingDiffs).toHaveLength(1)
  })

  it('should call onDiffCreated callback', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    const createdDiffs: PendingDiff[] = []
    ctx.onDiffCreated = (diff) => createdDiffs.push(diff)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlocksRead(['block-0', 'block-1'])
    const tool = createEditBlocksTool(ctx)

    await tool.func({
      edits: [
        { blockId: 'block-0', newContent: 'New 0', reason: 'test' },
        { blockId: 'block-1', newContent: 'New 1', reason: 'test' },
      ],
    })

    expect(createdDiffs).toHaveLength(2)
  })

  it('should limit to MAX_BATCH_SIZE (25) edits', async () => {
    const blocks = createTestBlocks(30)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlocksRead(blocks.map(b => b.id))
    const tool = createEditBlocksTool(ctx)

    const edits = blocks.map(b => ({
      blockId: b.id,
      newContent: `New ${b.id}`,
      reason: 'test',
    }))
    const result = await tool.func({ edits })
    const parsed = JSON.parse(result)

    expect(parsed.results).toHaveLength(25)
    expect(ctx.pendingDiffs).toHaveLength(25)
  })

  it('should use effective content for oldContent (overlay)', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlockRead('block-0')
    // First edit
    ctx.pendingDiffs.push({
      id: 'diff-1',
      blockId: 'block-0',
      action: 'update',
      oldContent: 'Content of block 0',
      newContent: 'First update',
      reason: 'first',
    })
    const tool = createEditBlocksTool(ctx)

    await tool.func({
      edits: [{ blockId: 'block-0', newContent: 'Second update', reason: 'second' }],
    })

    // The second diff should have oldContent = 'First update' (from overlay)
    expect(ctx.pendingDiffs[1].oldContent).toBe('First update')
    expect(ctx.pendingDiffs[1].newContent).toBe('Second update')
  })

  it('should fail for non-existent blocks', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlockRead('nonexistent')
    const tool = createEditBlocksTool(ctx)

    const result = await tool.func({
      edits: [{ blockId: 'nonexistent', newContent: 'New', reason: 'test' }],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(false)
    expect(parsed.results[0].error).toContain('not found')
  })
})
