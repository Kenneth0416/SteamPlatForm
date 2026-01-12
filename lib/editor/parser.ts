import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import type { Root, Content, Heading, Paragraph, Code, List, ListItem } from 'mdast'
import type { Block, BlockType, ParseResult } from './types'

let blockCounter = 0

function generateBlockId(): string {
  return `block-${blockCounter++}`
}

function getNodeLines(node: Content): { start: number; end: number } {
  const pos = node.position
  return {
    start: pos?.start?.line ?? 0,
    end: pos?.end?.line ?? 0,
  }
}

function extractTextContent(node: Content): string {
  if ('value' in node) return node.value as string
  if ('children' in node) {
    return (node.children as Content[]).map(extractTextContent).join('')
  }
  return ''
}

function processListItems(list: List, depth: number = 0): Block[] {
  const blocks: Block[] = []
  for (const item of list.children) {
    if (item.type === 'listItem') {
      const lines = getNodeLines(item)
      // Extract direct text content (not nested lists)
      const textParts: string[] = []
      const nestedLists: List[] = []

      for (const child of item.children) {
        if (child.type === 'list') {
          nestedLists.push(child)
        } else {
          textParts.push(extractTextContent(child))
        }
      }

      if (textParts.length > 0) {
        blocks.push({
          id: generateBlockId(),
          type: 'list-item',
          content: textParts.join('\n').trim(),
          order: blocks.length,
          level: depth,
          lineStart: lines.start,
          lineEnd: lines.end,
        })
      }

      // Process nested lists
      for (const nested of nestedLists) {
        blocks.push(...processListItems(nested, depth + 1))
      }
    }
  }
  return blocks
}

function astToBlocks(ast: Root): Block[] {
  blockCounter = 0
  const blocks: Block[] = []

  for (const node of ast.children) {
    const lines = getNodeLines(node)

    switch (node.type) {
      case 'heading': {
        const heading = node as Heading
        blocks.push({
          id: generateBlockId(),
          type: 'heading',
          content: extractTextContent(heading),
          order: blocks.length,
          level: heading.depth,
          lineStart: lines.start,
          lineEnd: lines.end,
        })
        break
      }

      case 'paragraph': {
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          content: extractTextContent(node as Paragraph),
          order: blocks.length,
          lineStart: lines.start,
          lineEnd: lines.end,
        })
        break
      }

      case 'code': {
        const code = node as Code
        const lang = code.lang ? `\`\`\`${code.lang}\n` : '```\n'
        blocks.push({
          id: generateBlockId(),
          type: 'code',
          content: `${lang}${code.value}\n\`\`\``,
          order: blocks.length,
          lineStart: lines.start,
          lineEnd: lines.end,
        })
        break
      }

      case 'list': {
        const listBlocks = processListItems(node as List)
        for (const block of listBlocks) {
          block.order = blocks.length + listBlocks.indexOf(block)
        }
        blocks.push(...listBlocks)
        break
      }

      default:
        // Handle other node types as paragraphs
        if ('children' in node || 'value' in node) {
          const content = extractTextContent(node)
          if (content.trim()) {
            blocks.push({
              id: generateBlockId(),
              type: 'paragraph',
              content,
              order: blocks.length,
              lineStart: lines.start,
              lineEnd: lines.end,
            })
          }
        }
    }
  }

  // Reindex orders
  blocks.forEach((block, i) => { block.order = i })
  return blocks
}

export function parseMarkdown(markdown: string): ParseResult {
  const processor = unified().use(remarkParse)
  const ast = processor.parse(markdown) as Root
  const blocks = astToBlocks(ast)
  return { blocks, markdown }
}

export function blocksToMarkdown(blocks: Block[]): string {
  const sorted = [...blocks].sort((a, b) => a.order - b.order)
  const lines: string[] = []

  for (const block of sorted) {
    switch (block.type) {
      case 'heading':
        lines.push(`${'#'.repeat(block.level || 1)} ${block.content}`)
        break
      case 'paragraph':
        lines.push(block.content)
        break
      case 'code':
        lines.push(block.content)
        break
      case 'list-item': {
        const indent = '  '.repeat(block.level || 0)
        lines.push(`${indent}- ${block.content}`)
        break
      }
    }
    lines.push('') // blank line between blocks
  }

  return lines.join('\n').trim()
}

export function updateBlockContent(blocks: Block[], blockId: string, newContent: string): Block[] {
  return blocks.map(block =>
    block.id === blockId ? { ...block, content: newContent } : block
  )
}

export function addBlock(
  blocks: Block[],
  afterBlockId: string | null,
  type: BlockType,
  content: string,
  level?: number
): { blocks: Block[]; newBlock: Block } {
  const newBlock: Block = {
    id: generateBlockId(),
    type,
    content,
    order: 0,
    level,
  }

  if (!afterBlockId) {
    // Insert at beginning
    const updated = [newBlock, ...blocks]
    updated.forEach((b, i) => { b.order = i })
    return { blocks: updated, newBlock }
  }

  const idx = blocks.findIndex(b => b.id === afterBlockId)
  if (idx === -1) {
    throw new Error(`Block ${afterBlockId} not found`)
  }

  const updated = [...blocks.slice(0, idx + 1), newBlock, ...blocks.slice(idx + 1)]
  updated.forEach((b, i) => { b.order = i })
  return { blocks: updated, newBlock }
}

export function deleteBlock(blocks: Block[], blockId: string): Block[] {
  const filtered = blocks.filter(b => b.id !== blockId)
  filtered.forEach((b, i) => { b.order = i })
  return filtered
}
