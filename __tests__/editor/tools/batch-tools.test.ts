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
  createListBlocksTool,
  createReadBlocksTool,
  createEditBlocksTool,
  createAddBlocksTool,
  createDeleteBlocksTool,
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

describe('list_blocks tool', () => {
  it('should list all blocks with preview', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    const tool = createListBlocksTool(ctx)

    const result = await tool.func({})

    expect(result).toContain('Document has 3 blocks:')
    expect(result).toContain('[block-0] (paragraph)')
    expect(result).toContain('[block-1] (paragraph)')
    expect(result).toContain('[block-2] (paragraph)')
  })

  it('should mark document as read', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    const tool = createListBlocksTool(ctx)

    expect(ctx.guard.hasReadDocument()).toBe(false)
    await tool.func({})
    expect(ctx.guard.hasReadDocument()).toBe(true)
  })
})


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

describe('add_blocks tool', () => {
  it('should create pending diffs for multiple additions', async () => {
    const blocks = createTestBlocks(5)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    const tool = createAddBlocksTool(ctx)

    const result = await tool.func({
      additions: [
        { afterBlockId: 'block-0', type: 'paragraph', content: 'New content 1', reason: 'test 1' },
        { afterBlockId: 'block-1', type: 'heading', content: 'New heading', level: 2, reason: 'test 2' },
      ],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results).toHaveLength(2)
    expect(parsed.results[0]).toMatchObject({ afterBlockId: 'block-0', ok: true })
    expect(parsed.results[1]).toMatchObject({ afterBlockId: 'block-1', ok: true })
    expect(ctx.pendingDiffs).toHaveLength(2)
    expect(ctx.pendingDiffs[0].action).toBe('add')
    expect(ctx.pendingDiffs[1].action).toBe('add')
  })

  it('should handle null afterBlockId (insert at start)', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    const tool = createAddBlocksTool(ctx)

    const result = await tool.func({
      additions: [
        { afterBlockId: null, type: 'paragraph', content: 'At start', reason: 'test' },
      ],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(true)
    expect(ctx.pendingDiffs[0].blockId).toBe('__start__')
  })

  it('should reject empty content', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    const tool = createAddBlocksTool(ctx)

    const result = await tool.func({
      additions: [
        { afterBlockId: 'block-0', type: 'paragraph', content: '   ', reason: 'test' },
      ],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(false)
    expect(parsed.results[0].error).toContain('empty')
  })

  it('should fail if document not read', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    const tool = createAddBlocksTool(ctx)

    const result = await tool.func({
      additions: [
        { afterBlockId: 'block-0', type: 'paragraph', content: 'New', reason: 'test' },
      ],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(false)
    expect(parsed.results[0].error).toContain('list_blocks')
  })

  it('should fail for non-existent afterBlockId', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    const tool = createAddBlocksTool(ctx)

    const result = await tool.func({
      additions: [
        { afterBlockId: 'nonexistent', type: 'paragraph', content: 'New', reason: 'test' },
      ],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(false)
    expect(parsed.results[0].error).toContain('not found')
  })

  it('should limit to MAX_BATCH_SIZE (25) additions', async () => {
    const blocks = createTestBlocks(30)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    const tool = createAddBlocksTool(ctx)

    const additions = Array.from({ length: 30 }, (_, i) => ({
      afterBlockId: `block-${i}`,
      type: 'paragraph' as const,
      content: `Content ${i}`,
      reason: 'test',
    }))
    const result = await tool.func({ additions })
    const parsed = JSON.parse(result)

    expect(parsed.results).toHaveLength(25)
    expect(ctx.pendingDiffs).toHaveLength(25)
  })

  it('should call onDiffCreated callback', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    const createdDiffs: PendingDiff[] = []
    ctx.onDiffCreated = (diff) => createdDiffs.push(diff)
    ctx.guard.markDocumentRead()
    const tool = createAddBlocksTool(ctx)

    await tool.func({
      additions: [
        { afterBlockId: 'block-0', type: 'paragraph', content: 'New 1', reason: 'test 1' },
        { afterBlockId: 'block-1', type: 'paragraph', content: 'New 2', reason: 'test 2' },
      ],
    })

    expect(createdDiffs).toHaveLength(2)
    expect(createdDiffs[0].action).toBe('add')
    expect(createdDiffs[1].action).toBe('add')
  })

  it('should allow partial success', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    const tool = createAddBlocksTool(ctx)

    const result = await tool.func({
      additions: [
        { afterBlockId: 'block-0', type: 'paragraph', content: 'Valid', reason: 'test' },
        { afterBlockId: 'nonexistent', type: 'paragraph', content: 'Invalid', reason: 'test' },
        { afterBlockId: 'block-1', type: 'paragraph', content: '  ', reason: 'test' }, // empty
      ],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(true)
    expect(parsed.results[1].ok).toBe(false)
    expect(parsed.results[2].ok).toBe(false)
    expect(ctx.pendingDiffs).toHaveLength(1)
  })

  it('should trim content and include metadata in diff', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    const tool = createAddBlocksTool(ctx)

    await tool.func({
      additions: [
        { afterBlockId: 'block-0', type: 'heading', content: '  My Heading  ', level: 3, reason: 'test' },
      ],
    })

    const newContent = JSON.parse(ctx.pendingDiffs[0].newContent)
    expect(newContent.content).toBe('My Heading')
    expect(newContent.type).toBe('heading')
    expect(newContent.level).toBe(3)
  })
})

describe('delete_blocks tool', () => {
  it('should create pending diffs for multiple deletions', async () => {
    const blocks = createTestBlocks(5)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlocksRead(['block-0', 'block-1', 'block-2'])
    const tool = createDeleteBlocksTool(ctx)

    const result = await tool.func({
      deletions: [
        { blockId: 'block-0', reason: 'Remove 0' },
        { blockId: 'block-1', reason: 'Remove 1' },
      ],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results).toHaveLength(2)
    expect(parsed.results[0]).toMatchObject({ blockId: 'block-0', ok: true })
    expect(parsed.results[1]).toMatchObject({ blockId: 'block-1', ok: true })
    expect(ctx.pendingDiffs).toHaveLength(2)
    expect(ctx.pendingDiffs[0].action).toBe('delete')
    expect(ctx.pendingDiffs[1].action).toBe('delete')
  })

  it('should fail if document not read', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    const tool = createDeleteBlocksTool(ctx)

    const result = await tool.func({
      deletions: [{ blockId: 'block-0', reason: 'test' }],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(false)
    expect(parsed.results[0].error).toContain('list_blocks')
  })

  it('should fail if block not read', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    const tool = createDeleteBlocksTool(ctx)

    const result = await tool.func({
      deletions: [{ blockId: 'block-0', reason: 'test' }],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(false)
    expect(parsed.results[0].error).toContain('read_block')
  })

  it('should fail for non-existent blocks', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlockRead('nonexistent')
    const tool = createDeleteBlocksTool(ctx)

    const result = await tool.func({
      deletions: [{ blockId: 'nonexistent', reason: 'test' }],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(false)
    expect(parsed.results[0].error).toContain('not found')
  })

  it('should use effective content with pending overlay', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlockRead('block-0')
    // First edit changes content
    ctx.pendingDiffs.push({
      id: 'diff-1',
      blockId: 'block-0',
      action: 'update',
      oldContent: 'Content of block 0',
      newContent: 'Updated content',
      reason: 'update',
    })
    const tool = createDeleteBlocksTool(ctx)

    await tool.func({
      deletions: [{ blockId: 'block-0', reason: 'delete' }],
    })

    // The delete diff should use effective content (updated content)
    expect(ctx.pendingDiffs[1].oldContent).toBe('Updated content')
    expect(ctx.pendingDiffs[1].action).toBe('delete')
  })

  it('should detect already deleted blocks', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlockRead('block-0')
    // First delete
    ctx.pendingDiffs.push({
      id: 'diff-1',
      blockId: 'block-0',
      action: 'delete',
      oldContent: 'Content of block 0',
      newContent: '',
      reason: 'first delete',
    })
    const tool = createDeleteBlocksTool(ctx)

    const result = await tool.func({
      deletions: [{ blockId: 'block-0', reason: 'second delete' }],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(false)
    expect(parsed.results[0].error).toContain('deleted')
  })

  it('should limit to MAX_BATCH_SIZE (25) deletions', async () => {
    const blocks = createTestBlocks(30)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlocksRead(blocks.map(b => b.id))
    const tool = createDeleteBlocksTool(ctx)

    const deletions = blocks.map(b => ({
      blockId: b.id,
      reason: 'test',
    }))
    const result = await tool.func({ deletions })
    const parsed = JSON.parse(result)

    expect(parsed.results).toHaveLength(25)
    expect(ctx.pendingDiffs).toHaveLength(25)
  })

  it('should call onDiffCreated callback', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    const createdDiffs: PendingDiff[] = []
    ctx.onDiffCreated = (diff) => createdDiffs.push(diff)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlocksRead(['block-0', 'block-1'])
    const tool = createDeleteBlocksTool(ctx)

    await tool.func({
      deletions: [
        { blockId: 'block-0', reason: 'test 1' },
        { blockId: 'block-1', reason: 'test 2' },
      ],
    })

    expect(createdDiffs).toHaveLength(2)
    expect(createdDiffs[0].action).toBe('delete')
    expect(createdDiffs[1].action).toBe('delete')
  })

  it('should allow partial success', async () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlockRead('block-0')
    // block-1 not read
    const tool = createDeleteBlocksTool(ctx)

    const result = await tool.func({
      deletions: [
        { blockId: 'block-0', reason: 'test' },
        { blockId: 'block-1', reason: 'test' },
      ],
    })
    const parsed = JSON.parse(result)

    expect(parsed.results[0].ok).toBe(true)
    expect(parsed.results[1].ok).toBe(false)
    expect(ctx.pendingDiffs).toHaveLength(1)
  })

  it('should use batch validation via canDeleteBlocks', async () => {
    const blocks = createTestBlocks(5)
    const ctx = createTestContext(blocks)
    ctx.guard.markDocumentRead()
    ctx.guard.markBlocksRead(['block-0', 'block-2'])
    // block-1 not read
    const tool = createDeleteBlocksTool(ctx)

    const result = await tool.func({
      deletions: [
        { blockId: 'block-0', reason: 'test' },
        { blockId: 'block-1', reason: 'test' },
        { blockId: 'block-2', reason: 'test' },
      ],
    })
    const parsed = JSON.parse(result)

    // block-0 and block-2 should succeed, block-1 should fail
    expect(parsed.results[0].ok).toBe(true)
    expect(parsed.results[1].ok).toBe(false)
    expect(parsed.results[2].ok).toBe(true)
    expect(ctx.pendingDiffs).toHaveLength(2)
  })
})

describe('createEditorTools integration', () => {
  it('should export all 5 batch tools', () => {
    const blocks = createTestBlocks(3)
    const ctx = createTestContext(blocks)

    // Import dynamically to ensure it's covered
    const { createEditorTools } = require('../../../lib/editor/tools')
    const tools = createEditorTools(ctx)

    expect(tools).toHaveLength(5)
    expect(tools[0].name).toBe('list_blocks')
    expect(tools[1].name).toBe('read_blocks')
    expect(tools[2].name).toBe('edit_blocks')
    expect(tools[3].name).toBe('add_blocks')
    expect(tools[4].name).toBe('delete_blocks')
  })
})
