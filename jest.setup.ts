import '@testing-library/jest-dom'

// Virtual mocks for optional export dependencies (not always present in the sandboxed test environment).
jest.mock(
  '@react-pdf/renderer',
  () => {
    const extractText = (node: any): string[] => {
      if (!node) return []
      if (Array.isArray(node)) return node.flatMap(extractText)
      if (typeof node === 'string' || typeof node === 'number') return [String(node)]
      if (typeof node === 'object' && node.props) return extractText(node.props.children)
      return []
    }

    const countImages = (node: any): number => {
      if (!node) return 0
      if (Array.isArray(node)) return node.reduce((sum, n) => sum + countImages(n), 0)
      if (typeof node === 'object' && node.type) {
        const self = node.type === 'Image' ? 1 : 0
        return self + countImages(node.props?.children)
      }
      return 0
    }

    return {
      Document: 'Document',
      Page: 'Page',
      Text: 'Text',
      View: 'View',
      Image: 'Image',
      pdf: (doc: any) => ({
        toBuffer: async () => {
          const textParts = extractText(doc).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean)
          const templateIdx = textParts.findIndex(t => t.includes('Template:'))
          const templateValue = templateIdx >= 0 ? (textParts[templateIdx + 1] || '').trim() : ''
          const templateLine =
            templateIdx >= 0
              ? `Template: ${templateValue || textParts[templateIdx].replace(/^.*Template:\s*/i, '').trim()}`
              : 'Template: <missing>'
          const imageCount = countImages(doc)
          return Buffer.from(`%PDF-1.4\n${templateLine}\nimages=${imageCount}\n%%EOF\n`, 'utf8')
        },
      }),
    }
  },
  { virtual: true },
)

jest.mock(
  'docx',
  () => {
    class DocNode {
      props: any
      constructor(props: any) {
        this.props = props
      }
    }

    class Document extends DocNode {}
    class Paragraph extends DocNode {}
    class TextRun extends DocNode {}
    class ImageRun extends DocNode {}
    class Table extends DocNode {}
    class TableRow extends DocNode {}
    class TableCell extends DocNode {}

    const HeadingLevel = {
      HEADING_1: 'HEADING_1',
      HEADING_2: 'HEADING_2',
      HEADING_3: 'HEADING_3',
    }

    const WidthType = {
      PERCENTAGE: 'PERCENTAGE',
    }

    const Packer = {
      toBuffer: async (doc: any) => {
        // 检查是否包含图片
        const hasImages = JSON.stringify(doc).includes('"type":"png"')
        const payload = JSON.stringify(doc)
        const mediaSection = hasImages ? 'word/media/image1.png\n' : ''
        return Buffer.from(`PK\n${mediaSection}word/document.xml\n${payload}\n`, 'utf8')
      },
    }

    return {
      Document,
      Paragraph,
      TextRun,
      ImageRun,
      Table,
      TableRow,
      TableCell,
      HeadingLevel,
      WidthType,
      Packer,
    }
  },
  { virtual: true },
)

// Mock ESM modules globally
jest.mock('marked', () => ({
  marked: {
    parse: jest.fn((md: string) => `<p>${md}</p>`),
  },
}))

jest.mock('turndown', () => {
  return jest.fn().mockImplementation(() => ({
    addRule: jest.fn(),
    turndown: jest.fn((html: string) => html.replace(/<[^>]*>/g, '')),
  }))
})
