import type { Block, BlockSummary, PendingDiff } from './types'

export class BlockIndexService {
  private blocks: Map<string, Block> = new Map()
  private orderIndex: Block[] = []

  constructor(blocks: Block[] = []) {
    this.setBlocks(blocks)
  }

  setBlocks(blocks: Block[]): void {
    this.blocks.clear()
    this.orderIndex = [...blocks].sort((a, b) => a.order - b.order)
    for (const block of this.orderIndex) {
      this.blocks.set(block.id, block)
    }
  }

  getBlocks(): Block[] {
    return [...this.orderIndex]
  }

  getBlockIndex(): BlockSummary[] {
    return this.orderIndex.map(block => ({
      id: block.id,
      type: block.type,
      preview: block.content.slice(0, 50) + (block.content.length > 50 ? '...' : ''),
      order: block.order,
    }))
  }

  getById(blockId: string): Block | undefined {
    return this.blocks.get(blockId)
  }

  getByIds(blockIds: string[]): Block[] {
    return blockIds
      .map(id => this.blocks.get(id))
      .filter((b): b is Block => b !== undefined)
  }

  // Get effective content considering pending diffs (overlay)
  getEffectiveContent(blockId: string, pendingDiffs: PendingDiff[]): string | null {
    // Find the last pending diff for this block
    for (let i = pendingDiffs.length - 1; i >= 0; i--) {
      const diff = pendingDiffs[i]
      if (diff.blockId === blockId) {
        if (diff.action === 'delete') return null
        if (diff.action === 'update') return diff.newContent
      }
    }
    // No pending diff, return original content
    const block = this.blocks.get(blockId)
    return block?.content ?? null
  }

  // Get effective block with pending overlay applied
  getEffectiveBlock(blockId: string, pendingDiffs: PendingDiff[]): Block | null {
    const block = this.blocks.get(blockId)
    if (!block) return null

    const content = this.getEffectiveContent(blockId, pendingDiffs)
    if (content === null) return null // deleted

    return { ...block, content }
  }

  search(keyword: string): Block[] {
    const lower = keyword.toLowerCase()
    return this.orderIndex.filter(block =>
      block.content.toLowerCase().includes(lower)
    )
  }

  getWithContext(blockId: string, contextSize: number = 1): {
    block: Block | undefined
    before: Block[]
    after: Block[]
  } {
    const block = this.blocks.get(blockId)
    if (!block) {
      return { block: undefined, before: [], after: [] }
    }

    const idx = this.orderIndex.findIndex(b => b.id === blockId)
    const before = this.orderIndex.slice(Math.max(0, idx - contextSize), idx)
    const after = this.orderIndex.slice(idx + 1, idx + 1 + contextSize)

    return { block, before, after }
  }

  getByOrder(order: number): Block | undefined {
    return this.orderIndex[order]
  }

  getByType(type: Block['type']): Block[] {
    return this.orderIndex.filter(b => b.type === type)
  }

  size(): number {
    return this.blocks.size
  }
}
