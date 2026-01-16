export type BlockType = 'heading' | 'paragraph' | 'code' | 'list-item'

export interface Block {
  id: string
  type: BlockType
  content: string
  order: number
  level?: number // heading level (1-6) or list nesting depth
  lineStart?: number
  lineEnd?: number
}

export interface BlockSummary {
  id: string
  type: BlockType
  preview: string // first 50 chars
  order: number
}

export interface PendingDiff {
  id: string
  blockId: string
  action: 'update' | 'add' | 'delete'
  oldContent: string
  newContent: string
  reason: string
  docId?: string // for multi-document support
}

// Multi-document types
export type DocumentType = 'lesson' | 'guide' | 'worksheet' | 'custom'

export interface EditorDocument {
  id: string
  name: string
  type: DocumentType
  content: string
  blocks: Block[]
  isDirty: boolean
  createdAt: Date
}

export interface DiffChange {
  type: 'add' | 'remove' | 'unchanged'
  value: string
}

export interface ParseResult {
  blocks: Block[]
  markdown: string
}
