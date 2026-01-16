// Mock unified and remark modules before importing parser
jest.mock('unified', () => ({
  unified: () => ({
    use: jest.fn().mockReturnThis(),
    parse: (md: string) => {
      // Simple mock AST generation
      const lines = md.split('\n').filter(l => l.trim())
      const children: any[] = []

      for (const line of lines) {
        if (line.startsWith('# ')) {
          children.push({
            type: 'heading',
            depth: 1,
            children: [{ type: 'text', value: line.slice(2) }],
            position: { start: { line: 1 }, end: { line: 1 } },
          })
        } else if (line.startsWith('## ')) {
          children.push({
            type: 'heading',
            depth: 2,
            children: [{ type: 'text', value: line.slice(3) }],
            position: { start: { line: 1 }, end: { line: 1 } },
          })
        } else if (line.startsWith('- ')) {
          children.push({
            type: 'list',
            children: [{
              type: 'listItem',
              children: [{ type: 'paragraph', children: [{ type: 'text', value: line.slice(2) }] }],
              position: { start: { line: 1 }, end: { line: 1 } },
            }],
            position: { start: { line: 1 }, end: { line: 1 } },
          })
        } else if (line.startsWith('```')) {
          children.push({
            type: 'code',
            lang: line.slice(3) || null,
            value: 'const x = 1;',
            position: { start: { line: 1 }, end: { line: 1 } },
          })
        } else if (line.trim()) {
          children.push({
            type: 'paragraph',
            children: [{ type: 'text', value: line }],
            position: { start: { line: 1 }, end: { line: 1 } },
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

describe('Markdown Parser', () => {
  describe('parseMarkdown', () => {
    it('should parse headings correctly', () => {
      const md = '# Title\n\n## Subtitle'
      const result = parseMarkdown(md)

      expect(result.blocks).toHaveLength(2)
      expect(result.blocks[0].type).toBe('heading')
      expect(result.blocks[0].content).toBe('Title')
      expect(result.blocks[0].level).toBe(1)
      expect(result.blocks[1].type).toBe('heading')
      expect(result.blocks[1].content).toBe('Subtitle')
      expect(result.blocks[1].level).toBe(2)
    })

    it('should parse paragraphs correctly', () => {
      const md = 'First paragraph.\n\nSecond paragraph.'
      const result = parseMarkdown(md)

      expect(result.blocks).toHaveLength(2)
      expect(result.blocks[0].type).toBe('paragraph')
      expect(result.blocks[0].content).toBe('First paragraph.')
      expect(result.blocks[1].content).toBe('Second paragraph.')
    })

    it('should parse list items as independent blocks', () => {
      const md = '- Item 1\n- Item 2\n- Item 3'
      const result = parseMarkdown(md)

      expect(result.blocks).toHaveLength(3)
      result.blocks.forEach((block, i) => {
        expect(block.type).toBe('list-item')
        expect(block.content).toBe(`Item ${i + 1}`)
      })
    })

    it('should parse code blocks correctly', () => {
      const md = '```javascript\nconst x = 1;\n```'
      const result = parseMarkdown(md)

      // At least one code block should exist
      const codeBlocks = result.blocks.filter(b => b.type === 'code')
      expect(codeBlocks.length).toBeGreaterThanOrEqual(1)
      expect(codeBlocks[0].content).toContain('const x = 1;')
    })

    it('should assign unique IDs to each block', () => {
      const md = '# Title\n\nParagraph\n\n- Item'
      const result = parseMarkdown(md)

      const ids = result.blocks.map(b => b.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should maintain correct order', () => {
      const md = '# First\n\nSecond\n\n# Third'
      const result = parseMarkdown(md)

      expect(result.blocks[0].order).toBe(0)
      expect(result.blocks[1].order).toBe(1)
      expect(result.blocks[2].order).toBe(2)
    })
  })

  describe('blocksToMarkdown', () => {
    it('should convert blocks back to markdown', () => {
      const blocks = [
        { id: 'b1', type: 'heading' as const, content: 'Title', order: 0, level: 1 },
        { id: 'b2', type: 'paragraph' as const, content: 'Text', order: 1 },
      ]

      const md = blocksToMarkdown(blocks)
      expect(md).toContain('# Title')
      expect(md).toContain('Text')
    })

    it('should handle list items with proper indentation', () => {
      const blocks = [
        { id: 'b1', type: 'list-item' as const, content: 'Item 1', order: 0, level: 0 },
        { id: 'b2', type: 'list-item' as const, content: 'Nested', order: 1, level: 1 },
      ]

      const md = blocksToMarkdown(blocks)
      expect(md).toContain('- Item 1')
      expect(md).toContain('  - Nested')
    })
  })

  describe('updateBlockContent', () => {
    it('should update the correct block', () => {
      const blocks = [
        { id: 'b1', type: 'paragraph' as const, content: 'Old', order: 0 },
        { id: 'b2', type: 'paragraph' as const, content: 'Keep', order: 1 },
      ]

      const updated = updateBlockContent(blocks, 'b1', 'New')
      expect(updated[0].content).toBe('New')
      expect(updated[1].content).toBe('Keep')
    })

    it('should not mutate original array', () => {
      const blocks = [{ id: 'b1', type: 'paragraph' as const, content: 'Old', order: 0 }]
      const updated = updateBlockContent(blocks, 'b1', 'New')

      expect(blocks[0].content).toBe('Old')
      expect(updated[0].content).toBe('New')
    })
  })

  describe('addBlock', () => {
    it('should add block at beginning when afterBlockId is null', () => {
      const blocks = [{ id: 'b1', type: 'paragraph' as const, content: 'Existing', order: 0 }]
      const { blocks: updated, newBlock } = addBlock(blocks, null, 'heading', 'New Title', 1)

      expect(updated).toHaveLength(2)
      expect(updated[0].content).toBe('New Title')
      expect(updated[0].order).toBe(0)
      expect(updated[1].order).toBe(1)
    })

    it('should add block after specified block', () => {
      const blocks = [
        { id: 'b1', type: 'paragraph' as const, content: 'First', order: 0 },
        { id: 'b2', type: 'paragraph' as const, content: 'Third', order: 1 },
      ]

      const { blocks: updated } = addBlock(blocks, 'b1', 'paragraph', 'Second')
      expect(updated).toHaveLength(3)
      expect(updated[1].content).toBe('Second')
    })

    it('should throw error for non-existent afterBlockId', () => {
      const blocks = [{ id: 'b1', type: 'paragraph' as const, content: 'Existing', order: 0 }]
      expect(() => addBlock(blocks, 'nonexistent', 'paragraph', 'New')).toThrow()
    })
  })

  describe('deleteBlock', () => {
    it('should remove the specified block', () => {
      const blocks = [
        { id: 'b1', type: 'paragraph' as const, content: 'First', order: 0 },
        { id: 'b2', type: 'paragraph' as const, content: 'Second', order: 1 },
      ]

      const updated = deleteBlock(blocks, 'b1')
      expect(updated).toHaveLength(1)
      expect(updated[0].id).toBe('b2')
    })

    it('should reindex orders after deletion', () => {
      const blocks = [
        { id: 'b1', type: 'paragraph' as const, content: 'First', order: 0 },
        { id: 'b2', type: 'paragraph' as const, content: 'Second', order: 1 },
        { id: 'b3', type: 'paragraph' as const, content: 'Third', order: 2 },
      ]

      const updated = deleteBlock(blocks, 'b2')
      expect(updated[0].order).toBe(0)
      expect(updated[1].order).toBe(1)
    })
  })
})
