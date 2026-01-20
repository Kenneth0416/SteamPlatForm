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
      onDiffCreated: (diff: unknown) => createdDiffs.push(diff),
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
    }

    const tools = createEditorTools(ctx)
    const toolNames = tools.map(t => t.name)

    expect(toolNames).toContain('read_blocks')
    expect(toolNames).toContain('edit_blocks')
  })
})
