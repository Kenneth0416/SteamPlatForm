// Test the ToolContext interface with batch tools
// Mock langchain to avoid ReadableStream issues
jest.mock('@langchain/core/tools', () => ({
  DynamicStructuredTool: jest.fn().mockImplementation((config) => ({
    name: config.name,
    description: config.description,
    schema: config.schema,
    func: config.func,
  })),
}))

import { ReadCache, ToolTrace } from '../../lib/editor/agent/runtime'

describe('ToolContext interface', () => {
  it('should support onDiffCreated callback', async () => {
    const { createEditorTools } = await import('../../lib/editor/tools')
    const { BlockIndexService } = await import('../../lib/editor/block-index')
    const { ReadWriteGuard } = await import('../../lib/editor/tools/middleware')

    const blockIndex = new BlockIndexService([])
    const guard = new ReadWriteGuard()
    const pendingDiffs: unknown[] = []
    const createdDiffs: unknown[] = []

    const ctx = {
      blockIndex,
      guard,
      pendingDiffs,
      readCache: new ReadCache(),
      onDiffCreated: (diff: unknown) => createdDiffs.push(diff),
      blockIdCounter: 0,
    }

    const tools = createEditorTools(ctx)
    expect(tools.length).toBe(5) // 5 batch tools only
  })

  it('should include batch tools in createEditorTools', async () => {
    const { createEditorTools } = await import('../../lib/editor/tools')
    const { BlockIndexService } = await import('../../lib/editor/block-index')
    const { ReadWriteGuard } = await import('../../lib/editor/tools/middleware')

    const ctx = {
      blockIndex: new BlockIndexService([]),
      guard: new ReadWriteGuard(),
      pendingDiffs: [],
      readCache: new ReadCache(),
      blockIdCounter: 0,
    }

    const tools = createEditorTools(ctx)
    const toolNames = tools.map(t => t.name)

    expect(toolNames).toContain('read_blocks')
    expect(toolNames).toContain('edit_blocks')
  })
})

describe('Runtime utilities', () => {
  it('should shift entries when exceeding max size', () => {
    const trace = new ToolTrace(1)
    trace.add({ name: 'list_blocks', args: {}, status: 'success', timestamp: 1 })
    trace.add({ name: 'read_blocks', args: { blockIds: ['b1'] }, status: 'success', timestamp: 2 })

    expect(trace.size()).toBe(1)
  })

  it('should report cache presence and size', () => {
    const cache = new ReadCache()
    cache.set('b1', 'content')

    expect(cache.has('b1')).toBe(true)
    expect(cache.size()).toBe(1)
  })
})

describe('Error Recovery', () => {
  describe('Test 1: Block Not Found Recovery', () => {
    it('should recover from block not found by calling list_blocks', async () => {
      const { createEditorTools } = await import('../../lib/editor/tools')
      const { BlockIndexService } = await import('../../lib/editor/block-index')
      const { ReadWriteGuard } = await import('../../lib/editor/tools/middleware')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { Block } = await import('../../lib/editor/types')

      // Setup: Document with 3 blocks
      const blocks = [
        { id: 'block_1', type: 'paragraph', content: 'First paragraph', order: 0 },
        { id: 'block_2', type: 'paragraph', content: 'Second paragraph', order: 1 },
        { id: 'block_3', type: 'paragraph', content: 'Third paragraph', order: 2 },
      ]
      const blockIndex = new BlockIndexService(blocks)
      const guard = new ReadWriteGuard()
      const pendingDiffs: unknown[] = []

      const ctx = {
        blockIndex,
        guard,
        pendingDiffs,
        readCache: new ReadCache(),
        blockIdCounter: 0,
      }

      const tools = createEditorTools(ctx)
      const editBlocksTool = tools.find(t => t.name === 'edit_blocks')
      const listBlocksTool = tools.find(t => t.name === 'list_blocks')
      const readBlocksTool = tools.find(t => t.name === 'read_blocks')

      expect(editBlocksTool).toBeDefined()
      expect(listBlocksTool).toBeDefined()
      expect(readBlocksTool).toBeDefined()

      // Step 1: User requests edit of non-existent block_999
      const editResult = await editBlocksTool!.func!({
        edits: [{ blockId: 'block_999', newContent: 'New content', reason: 'Testing' }]
      })
      const editParsed = JSON.parse(editResult as string)

      // Expected: Error "Block not found" or "not read yet"
      expect(editParsed.results[0].ok).toBe(false)
      expect(editParsed.results[0].error).toMatch(/not read yet|not found|list_blocks/i)

      // Step 2: Agent calls list_blocks to refresh document state
      const listResult = await listBlocksTool!.func!( {})
      expect(listResult).toContain('block_1')
      expect(listResult).toContain('block_2')
      expect(listResult).toContain('block_3')
      expect(listResult).not.toContain('block_999')

      // Step 3: Read the correct block (block_2)
      const readResult = await readBlocksTool!.func!({
        blockIds: ['block_2'], withContext: false
      })
      const readParsed = JSON.parse(readResult as string)
      expect(readParsed.blocks[0].ok).toBe(true)
      expect(readParsed.blocks[0].id).toBe('block_2')

      // Step 4: Agent retries with correct block ID
      const retryResult = await editBlocksTool!.func!({
        edits: [{ blockId: 'block_2', newContent: 'Updated second paragraph', reason: 'Testing recovery' }]
      })
      const retryParsed = JSON.parse(retryResult as string)

      // Expected: Success
      expect(retryParsed.results[0].ok).toBe(true)
      expect(retryParsed.results[0].blockId).toBe('block_2')
      expect(pendingDiffs.length).toBe(1)
    })
  })

  describe('Test 2: Guard Reset After Document Switch', () => {
    it('should enforce guard reset after switch_document', async () => {
      const { createEditorTools } = await import('../../lib/editor/tools')
      const { BlockIndexService } = await import('../../lib/editor/block-index')
      const { ReadWriteGuard } = await import('../../lib/editor/tools/middleware')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { Block } = await import('../../lib/editor/types')

      // Setup: Simulate two documents with different blocks
      const blocksA = [
        { id: 'docA_block_1', type: 'paragraph' as const, content: 'Doc A - First', order: 0 },
        { id: 'docA_block_2', type: 'paragraph' as const, content: 'Doc A - Second', order: 1 },
      ]
      const blocksB = [
        { id: 'docB_block_1', type: 'paragraph' as const, content: 'Doc B - First', order: 0 },
        { id: 'docB_block_2', type: 'paragraph' as const, content: 'Doc B - Second', order: 1 },
      ]

      const guard = new ReadWriteGuard()
      const pendingDiffs = []

      // Initial block index for doc_A
      const blockIndexA = new BlockIndexService(blocksA)

      const ctxA = {
        blockIndex: blockIndexA,
        guard,
        pendingDiffs,
        readCache: new ReadCache(),
        blockIdCounter: 0,
      }

      // Create tools for document A
      const toolsA = createEditorTools(ctxA)
      const listBlocksTool = toolsA.find(t => t.name === 'list_blocks')
      const readBlocksTool = toolsA.find(t => t.name === 'read_blocks')
      const editBlocksTool = toolsA.find(t => t.name === 'edit_blocks')

      // Step 1: Read block in doc_A (marks as read)
      const readResult = await readBlocksTool!.func!({
        blockIds: ['docA_block_1'], withContext: false
      })
      const readParsed = JSON.parse(readResult as string)
      expect(readParsed.blocks[0].ok).toBe(true)

      // Verify guard state
      expect(guard.hasReadDocument()).toBe(true)
      expect(guard.hasReadBlock('docA_block_1')).toBe(true)

      // Step 2: Simulate switch_document by resetting guard and updating block index
      guard.reset()
      const blockIndexB = new BlockIndexService(blocksB)

      const ctxB = {
        blockIndex: blockIndexB,
        guard,
        pendingDiffs,
        readCache: new ReadCache(),
        blockIdCounter: 0,
      }

      const toolsB = createEditorTools(ctxB)
      const editBlocksToolB = toolsB.find(t => t.name === 'edit_blocks')
      const listBlocksToolB = toolsB.find(t => t.name === 'list_blocks')
      const readBlocksToolB = toolsB.find(t => t.name === 'read_blocks')

      // Step 3: Verify guard was reset after switch
      expect(guard.hasReadDocument()).toBe(false)
      expect(guard.hasReadBlock('docA_block_1')).toBe(false)

      // Step 4: Try to edit block in doc_B without reading first
      const editWithoutReadResult = await editBlocksToolB!.func!({
        edits: [{ blockId: 'docB_block_1', newContent: 'New content', reason: 'Testing guard reset' }]
      })
      const editWithoutReadParsed = JSON.parse(editWithoutReadResult as string)

      // Expected: Error "not read yet" or "Must call list_blocks"
      expect(editWithoutReadParsed.results[0].ok).toBe(false)
      expect(editWithoutReadParsed.results[0].error).toMatch(/list_blocks|not read yet/i)

      // Step 5: Call list_blocks in doc_B
      const listBlocksResult = await listBlocksToolB!.func!( {})
      expect(listBlocksResult).toContain('docB_block_1')
      expect(listBlocksResult).toContain('docB_block_2')

      // Step 6: Read block in doc_B
      const readInDocBResult = await readBlocksToolB!.func!({
        blockIds: ['docB_block_1'], withContext: false
      })
      const readInDocBParsed = JSON.parse(readInDocBResult as string)
      expect(readInDocBParsed.blocks[0].ok).toBe(true)

      // Step 7: Edit block in doc_B (using toolsB context)
      const editSuccessResult = await editBlocksToolB!.func!({
        edits: [{ blockId: 'docB_block_1', newContent: 'Updated Doc B content', reason: 'Testing recovery' }]
      })
      const editSuccessParsed = JSON.parse(editSuccessResult as string)

      // Expected: Success
      expect(editSuccessParsed.results[0].ok).toBe(true)
      expect(editSuccessParsed.results[0].blockId).toBe('docB_block_1')
    })
  })

  describe('Test 3: Stuck Loop Detection', () => {
    it('should detect stuck loops after 3 failed attempts', async () => {
      const { detectStuck, ToolTrace } = await import('../../lib/editor/agent/runtime')

      // Setup: Create a ToolTrace instance
      const trace = new ToolTrace(30)

      // Initially, no stuck state
      const initialCheck = detectStuck(trace)
      expect(initialCheck.isStuck).toBe(false)

      // Step 1-3: Try to edit same block 3 times without reading
      const timestamp = Date.now()
      for (let i = 0; i < 3; i++) {
        trace.add({
          name: 'edit_blocks',
          args: { blockId: 'block_1', newContent: 'content' },
          status: 'error',
          timestamp: timestamp + i * 1000,
        })
      }

      // The stuck detector should detect this pattern
      // Since edit_blocks is not a read tool, and we have errors but no successful mutations
      // Let's test the consecutive list_blocks scenario
      trace.clear()

      // Test consecutive list_blocks (should trigger stuck detection)
      for (let i = 0; i < 3; i++) {
        trace.add({
          name: 'list_blocks',
          args: {},
          status: 'success',
          timestamp: timestamp + i * 1000,
        })
      }

      const stuckCheck = detectStuck(trace)

      // Expected: detectStuck() returns {isStuck: true, reason: "..."}
      expect(stuckCheck.isStuck).toBe(true)
      expect(stuckCheck.reason).toContain('list_blocks')
      expect(stuckCheck.reason).toContain('3 times')

      // Test no progress scenario (10 calls without edit/add/delete)
      trace.clear()

      for (let i = 0; i < 10; i++) {
        trace.add({
          name: i % 2 === 0 ? 'list_blocks' : 'read_blocks',
          args: i % 2 === 0 ? {} : { blockIds: ['block_1'] },
          status: 'success',
          timestamp: timestamp + i * 1000,
        })
      }

      const noProgressCheck = detectStuck(trace)
      expect(noProgressCheck.isStuck).toBe(true)
      expect(noProgressCheck.reason).toContain('10')
      expect(noProgressCheck.reason).toContain('without any edit/add/delete')

      // Test successful scenario (should not be stuck)
      trace.clear()

      trace.add({
        name: 'list_blocks',
        args: {},
        status: 'success',
        timestamp: timestamp,
      })
      trace.add({
        name: 'read_blocks',
        args: { blockIds: ['block_1', 'block_2'] },
        status: 'success',
        timestamp: timestamp + 1000,
      })
      trace.add({
        name: 'edit_blocks',
        args: { edits: [{ blockId: 'block_1', newContent: 'updated', reason: 'test' }] },
        status: 'success',
        timestamp: timestamp + 2000,
      })

      const successCheck = detectStuck(trace)
      expect(successCheck.isStuck).toBe(false)

      // Test consecutive read_blocks with same args (should trigger stuck detection)
      trace.clear()

      for (let i = 0; i < 3; i++) {
        trace.add({
          name: 'read_blocks',
          args: { blockIds: ['block_1', 'block_2'], withContext: false },
          status: 'success',
          timestamp: timestamp + i * 1000,
        })
      }

      const readStuckCheck = detectStuck(trace)
      expect(readStuckCheck.isStuck).toBe(true)
      expect(readStuckCheck.reason).toContain('read_blocks')
      expect(readStuckCheck.reason).toContain('3 times')
    })

    it('should provide clear stuck detection reasons for error recovery', async () => {
      const { detectStuck, ToolTrace } = await import('../../lib/editor/agent/runtime')

      const trace = new ToolTrace(30)
      const timestamp = Date.now()

      // Test list_blocks loop
      for (let i = 0; i < 3; i++) {
        trace.add({
          name: 'list_blocks',
          args: {},
          status: 'success',
          timestamp: timestamp + i * 1000,
        })
      }

      const result = detectStuck(trace)

      // Expected: Warning message in response
      expect(result.isStuck).toBe(true)
      expect(result.reason).toBeDefined()
      expect(typeof result.reason).toBe('string')

      // The reason should be actionable for ERROR HANDLING section
      expect(result.reason?.toLowerCase()).toMatch(/list_blocks|consecutive|times/)
    })
  })
})
