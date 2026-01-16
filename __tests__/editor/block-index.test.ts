import { BlockIndexService } from '../../lib/editor/block-index'
import type { Block, PendingDiff } from '../../lib/editor/types'

function createTestBlocks(count: number): Block[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `block-${i}`,
    type: 'paragraph' as const,
    content: `Content of block ${i}`,
    order: i,
  }))
}

describe('BlockIndexService', () => {
  describe('getEffectiveContent', () => {
    it('should return original content when no pending diffs', () => {
      const blocks = createTestBlocks(3)
      const service = new BlockIndexService(blocks)

      const content = service.getEffectiveContent('block-0', [])
      expect(content).toBe('Content of block 0')
    })

    it('should return updated content from pending diff', () => {
      const blocks = createTestBlocks(3)
      const service = new BlockIndexService(blocks)
      const pendingDiffs: PendingDiff[] = [
        {
          id: 'diff-1',
          blockId: 'block-0',
          action: 'update',
          oldContent: 'Content of block 0',
          newContent: 'Updated content',
          reason: 'test',
        },
      ]

      const content = service.getEffectiveContent('block-0', pendingDiffs)
      expect(content).toBe('Updated content')
    })

    it('should return null for deleted blocks', () => {
      const blocks = createTestBlocks(3)
      const service = new BlockIndexService(blocks)
      const pendingDiffs: PendingDiff[] = [
        {
          id: 'diff-1',
          blockId: 'block-0',
          action: 'delete',
          oldContent: 'Content of block 0',
          newContent: '',
          reason: 'test',
        },
      ]

      const content = service.getEffectiveContent('block-0', pendingDiffs)
      expect(content).toBeNull()
    })

    it('should use the last pending diff for a block', () => {
      const blocks = createTestBlocks(3)
      const service = new BlockIndexService(blocks)
      const pendingDiffs: PendingDiff[] = [
        {
          id: 'diff-1',
          blockId: 'block-0',
          action: 'update',
          oldContent: 'Content of block 0',
          newContent: 'First update',
          reason: 'first',
        },
        {
          id: 'diff-2',
          blockId: 'block-0',
          action: 'update',
          oldContent: 'First update',
          newContent: 'Second update',
          reason: 'second',
        },
      ]

      const content = service.getEffectiveContent('block-0', pendingDiffs)
      expect(content).toBe('Second update')
    })

    it('should return null for non-existent blocks', () => {
      const blocks = createTestBlocks(3)
      const service = new BlockIndexService(blocks)

      const content = service.getEffectiveContent('nonexistent', [])
      expect(content).toBeNull()
    })

    it('should not affect other blocks', () => {
      const blocks = createTestBlocks(3)
      const service = new BlockIndexService(blocks)
      const pendingDiffs: PendingDiff[] = [
        {
          id: 'diff-1',
          blockId: 'block-0',
          action: 'update',
          oldContent: 'Content of block 0',
          newContent: 'Updated',
          reason: 'test',
        },
      ]

      expect(service.getEffectiveContent('block-0', pendingDiffs)).toBe('Updated')
      expect(service.getEffectiveContent('block-1', pendingDiffs)).toBe('Content of block 1')
      expect(service.getEffectiveContent('block-2', pendingDiffs)).toBe('Content of block 2')
    })
  })

  describe('getEffectiveBlock', () => {
    it('should return block with effective content', () => {
      const blocks = createTestBlocks(3)
      const service = new BlockIndexService(blocks)
      const pendingDiffs: PendingDiff[] = [
        {
          id: 'diff-1',
          blockId: 'block-0',
          action: 'update',
          oldContent: 'Content of block 0',
          newContent: 'Updated content',
          reason: 'test',
        },
      ]

      const block = service.getEffectiveBlock('block-0', pendingDiffs)
      expect(block).not.toBeNull()
      expect(block!.id).toBe('block-0')
      expect(block!.content).toBe('Updated content')
      expect(block!.type).toBe('paragraph')
    })

    it('should return null for deleted blocks', () => {
      const blocks = createTestBlocks(3)
      const service = new BlockIndexService(blocks)
      const pendingDiffs: PendingDiff[] = [
        {
          id: 'diff-1',
          blockId: 'block-0',
          action: 'delete',
          oldContent: 'Content of block 0',
          newContent: '',
          reason: 'test',
        },
      ]

      const block = service.getEffectiveBlock('block-0', pendingDiffs)
      expect(block).toBeNull()
    })

    it('should return null for non-existent blocks', () => {
      const blocks = createTestBlocks(3)
      const service = new BlockIndexService(blocks)

      const block = service.getEffectiveBlock('nonexistent', [])
      expect(block).toBeNull()
    })

    it('should preserve other block properties', () => {
      const blocks: Block[] = [
        { id: 'block-0', type: 'heading', content: 'Title', order: 0, level: 1 },
      ]
      const service = new BlockIndexService(blocks)
      const pendingDiffs: PendingDiff[] = [
        {
          id: 'diff-1',
          blockId: 'block-0',
          action: 'update',
          oldContent: 'Title',
          newContent: 'New Title',
          reason: 'test',
        },
      ]

      const block = service.getEffectiveBlock('block-0', pendingDiffs)
      expect(block).not.toBeNull()
      expect(block!.type).toBe('heading')
      expect(block!.level).toBe(1)
      expect(block!.content).toBe('New Title')
    })
  })

  describe('getWithContext', () => {
    it('should return block with before and after context', () => {
      const blocks = createTestBlocks(5)
      const service = new BlockIndexService(blocks)

      const result = service.getWithContext('block-2', 1)

      expect(result.block).toBeDefined()
      expect(result.block!.id).toBe('block-2')
      expect(result.before).toHaveLength(1)
      expect(result.before[0].id).toBe('block-1')
      expect(result.after).toHaveLength(1)
      expect(result.after[0].id).toBe('block-3')
    })

    it('should handle first block (no before context)', () => {
      const blocks = createTestBlocks(5)
      const service = new BlockIndexService(blocks)

      const result = service.getWithContext('block-0', 1)

      expect(result.before).toHaveLength(0)
      expect(result.after).toHaveLength(1)
    })

    it('should handle last block (no after context)', () => {
      const blocks = createTestBlocks(5)
      const service = new BlockIndexService(blocks)

      const result = service.getWithContext('block-4', 1)

      expect(result.before).toHaveLength(1)
      expect(result.after).toHaveLength(0)
    })

    it('should return empty for non-existent block', () => {
      const blocks = createTestBlocks(3)
      const service = new BlockIndexService(blocks)

      const result = service.getWithContext('nonexistent', 1)

      expect(result.block).toBeUndefined()
      expect(result.before).toHaveLength(0)
      expect(result.after).toHaveLength(0)
    })
  })
})
