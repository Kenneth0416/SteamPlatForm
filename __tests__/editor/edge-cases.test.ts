// Mock unified and remark modules
jest.mock('unified', () => ({
  unified: () => ({
    use: jest.fn().mockReturnThis(),
    parse: (md: string) => {
      const lines = md.split('\n')
      const children: unknown[] = []
      let lineNum = 0

      for (const line of lines) {
        lineNum++
        if (line.startsWith('# ')) {
          children.push({
            type: 'heading',
            depth: 1,
            children: [{ type: 'text', value: line.slice(2) }],
            position: { start: { line: lineNum }, end: { line: lineNum } },
          })
        } else if (line.startsWith('## ')) {
          children.push({
            type: 'heading',
            depth: 2,
            children: [{ type: 'text', value: line.slice(3) }],
            position: { start: { line: lineNum }, end: { line: lineNum } },
          })
        } else if (line.match(/^(\s*)- /)) {
          const match = line.match(/^(\s*)- (.*)/)
          const indent = match?.[1]?.length || 0
          const content = match?.[2] || ''
          const depth = Math.floor(indent / 2)
          children.push({
            type: 'list',
            children: [{
              type: 'listItem',
              children: [{ type: 'paragraph', children: [{ type: 'text', value: content }] }],
              position: { start: { line: lineNum }, end: { line: lineNum } },
            }],
            position: { start: { line: lineNum }, end: { line: lineNum } },
          })
        } else if (line.startsWith('```')) {
          children.push({
            type: 'code',
            lang: line.slice(3) || null,
            value: 'code content',
            position: { start: { line: lineNum }, end: { line: lineNum } },
          })
        } else if (line.trim()) {
          children.push({
            type: 'paragraph',
            children: [{ type: 'text', value: line }],
            position: { start: { line: lineNum }, end: { line: lineNum } },
          })
        }
      }
      return { type: 'root', children }
    },
  }),
}))
jest.mock('remark-parse', () => jest.fn())
jest.mock('remark-stringify', () => jest.fn())

import { parseMarkdown, blocksToMarkdown, updateBlockContent, addBlock, deleteBlock } from '@/lib/editor/parser'
import { BlockIndexService } from '@/lib/editor/block-index'
import { generateDiff } from '@/lib/editor/diff'
import type { Block } from '@/lib/editor/types'

describe('Edge Cases', () => {
  describe('Empty Document', () => {
    it('should handle empty string', () => {
      const result = parseMarkdown('')
      expect(result.blocks).toHaveLength(0)
    })

    it('should handle whitespace-only document', () => {
      const result = parseMarkdown('   \n\n   \n')
      expect(result.blocks).toHaveLength(0)
    })

    it('should convert empty blocks to empty markdown', () => {
      const md = blocksToMarkdown([])
      expect(md).toBe('')
    })

    it('should handle BlockIndexService with empty blocks', () => {
      const service = new BlockIndexService([])
      expect(service.size()).toBe(0)
      expect(service.getBlockIndex()).toEqual([])
      expect(service.search('anything')).toEqual([])
    })
  })

  describe('Large Document', () => {
    it('should handle document with 1000 blocks', () => {
      const blocks: Block[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `block-${i}`,
        type: 'paragraph' as const,
        content: `Paragraph ${i} with some content`,
        order: i,
      }))

      const service = new BlockIndexService(blocks)
      expect(service.size()).toBe(1000)

      // Search should still work
      const results = service.search('Paragraph 500')
      expect(results.length).toBeGreaterThan(0)
    })

    it('should handle very long content in a single block', () => {
      const longContent = 'A'.repeat(10000)
      const blocks: Block[] = [
        { id: 'b1', type: 'paragraph', content: longContent, order: 0 },
      ]

      const service = new BlockIndexService(blocks)
      const summaries = service.getBlockIndex()
      expect(summaries[0].preview.length).toBeLessThanOrEqual(53) // 50 + '...'
    })

    it('should generate diff for large content changes', () => {
      const oldContent = 'A'.repeat(5000)
      const newContent = 'B'.repeat(5000)
      const diff = generateDiff(oldContent, newContent)

      expect(diff.additions).toBeGreaterThan(0)
      expect(diff.deletions).toBeGreaterThan(0)
    })
  })

  describe('Nested Lists', () => {
    it('should handle deeply nested list items', () => {
      const md = `- Level 0
  - Level 1
    - Level 2
      - Level 3`
      const result = parseMarkdown(md)

      // Each list item should be a separate block
      expect(result.blocks.length).toBeGreaterThanOrEqual(4)
      result.blocks.forEach(block => {
        expect(block.type).toBe('list-item')
      })
    })

    it('should preserve list item content when converting back', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'list-item', content: 'Item 1', order: 0, level: 0 },
        { id: 'b2', type: 'list-item', content: 'Nested 1', order: 1, level: 1 },
        { id: 'b3', type: 'list-item', content: 'Nested 2', order: 2, level: 1 },
        { id: 'b4', type: 'list-item', content: 'Item 2', order: 3, level: 0 },
      ]

      const md = blocksToMarkdown(blocks)
      expect(md).toContain('- Item 1')
      expect(md).toContain('  - Nested 1')
      expect(md).toContain('  - Nested 2')
      expect(md).toContain('- Item 2')
    })
  })

  describe('Special Characters', () => {
    it('should handle markdown special characters in content', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'paragraph', content: 'Text with *asterisks* and _underscores_', order: 0 },
        { id: 'b2', type: 'paragraph', content: 'Code: `const x = 1`', order: 1 },
        { id: 'b3', type: 'paragraph', content: 'Link: [text](url)', order: 2 },
      ]

      const md = blocksToMarkdown(blocks)
      expect(md).toContain('*asterisks*')
      expect(md).toContain('`const x = 1`')
      expect(md).toContain('[text](url)')
    })

    it('should handle unicode characters', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'heading', content: '中文标题', order: 0, level: 1 },
        { id: 'b2', type: 'paragraph', content: 'Emoji: 🎉 🚀 ✨', order: 1 },
      ]

      const md = blocksToMarkdown(blocks)
      expect(md).toContain('中文标题')
      expect(md).toContain('🎉')
    })

    it('should search unicode content', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'paragraph', content: '这是中文内容', order: 0 },
        { id: 'b2', type: 'paragraph', content: 'English content', order: 1 },
      ]

      const service = new BlockIndexService(blocks)
      const results = service.search('中文')
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain('中文')
    })
  })

  describe('Block Operations Edge Cases', () => {
    it('should handle updating non-existent block gracefully', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'paragraph', content: 'Content', order: 0 },
      ]

      const updated = updateBlockContent(blocks, 'nonexistent', 'New content')
      expect(updated).toEqual(blocks)
    })

    it('should handle deleting non-existent block gracefully', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'paragraph', content: 'Content', order: 0 },
      ]

      const updated = deleteBlock(blocks, 'nonexistent')
      expect(updated).toHaveLength(1)
    })

    it('should handle deleting last block', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'paragraph', content: 'Only block', order: 0 },
      ]

      const updated = deleteBlock(blocks, 'b1')
      expect(updated).toHaveLength(0)
    })

    it('should handle adding to empty document', () => {
      const { blocks, newBlock } = addBlock([], null, 'heading', 'First heading', 1)
      expect(blocks).toHaveLength(1)
      expect(newBlock.content).toBe('First heading')
      expect(newBlock.order).toBe(0)
    })

    it('should throw when adding after non-existent block', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'paragraph', content: 'Content', order: 0 },
      ]

      expect(() => addBlock(blocks, 'nonexistent', 'paragraph', 'New')).toThrow()
    })
  })

  describe('Diff Edge Cases', () => {
    it('should handle identical content', () => {
      const diff = generateDiff('same content', 'same content')
      expect(diff.additions).toBe(0)
      expect(diff.deletions).toBe(0)
      expect(diff.unchanged).toBeGreaterThan(0)
    })

    it('should handle complete replacement', () => {
      const diff = generateDiff('old', 'new')
      expect(diff.additions).toBeGreaterThan(0)
      expect(diff.deletions).toBeGreaterThan(0)
    })

    it('should handle multiline content', () => {
      const old = 'line1\nline2\nline3'
      const newContent = 'line1\nmodified\nline3'
      const diff = generateDiff(old, newContent)

      expect(diff.changes.length).toBeGreaterThan(0)
    })
  })

  describe('Code Block Handling', () => {
    it('should preserve code block language', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'code', content: '```javascript\nconst x = 1;\n```', order: 0 },
      ]

      const md = blocksToMarkdown(blocks)
      expect(md).toContain('```javascript')
    })

    it('should handle code block without language', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'code', content: '```\nplain code\n```', order: 0 },
      ]

      const md = blocksToMarkdown(blocks)
      expect(md).toContain('```')
    })
  })

  describe('Heading Levels', () => {
    it('should handle all heading levels', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'heading', content: 'H1', order: 0, level: 1 },
        { id: 'b2', type: 'heading', content: 'H2', order: 1, level: 2 },
        { id: 'b3', type: 'heading', content: 'H3', order: 2, level: 3 },
        { id: 'b4', type: 'heading', content: 'H4', order: 3, level: 4 },
        { id: 'b5', type: 'heading', content: 'H5', order: 4, level: 5 },
        { id: 'b6', type: 'heading', content: 'H6', order: 5, level: 6 },
      ]

      const md = blocksToMarkdown(blocks)
      expect(md).toContain('# H1')
      expect(md).toContain('## H2')
      expect(md).toContain('### H3')
      expect(md).toContain('#### H4')
      expect(md).toContain('##### H5')
      expect(md).toContain('###### H6')
    })

    it('should default to level 1 for heading without level', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'heading', content: 'No level', order: 0 },
      ]

      const md = blocksToMarkdown(blocks)
      expect(md).toContain('# No level')
    })
  })

  describe('Order Consistency', () => {
    it('should maintain order after multiple operations', () => {
      let blocks: Block[] = [
        { id: 'b1', type: 'paragraph', content: 'First', order: 0 },
        { id: 'b2', type: 'paragraph', content: 'Second', order: 1 },
        { id: 'b3', type: 'paragraph', content: 'Third', order: 2 },
      ]

      // Delete middle
      blocks = deleteBlock(blocks, 'b2')
      expect(blocks[0].order).toBe(0)
      expect(blocks[1].order).toBe(1)

      // Add new
      const result = addBlock(blocks, 'b1', 'paragraph', 'New')
      blocks = result.blocks
      expect(blocks[0].order).toBe(0)
      expect(blocks[1].order).toBe(1)
      expect(blocks[2].order).toBe(2)
    })
  })
})
