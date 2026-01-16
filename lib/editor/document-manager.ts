import { parseMarkdown } from './parser'
import type { Block, EditorDocument, DocumentType } from './types'

export class DocumentManager {
  private documents: Map<string, EditorDocument> = new Map()
  private activeDocId: string | null = null

  constructor(documents: EditorDocument[] = [], activeDocId?: string) {
    for (const doc of documents) {
      this.documents.set(doc.id, doc)
    }
    if (activeDocId && this.documents.has(activeDocId)) {
      this.activeDocId = activeDocId
    } else if (documents.length > 0) {
      this.activeDocId = documents[0].id
    }
  }

  getAllDocuments(): EditorDocument[] {
    return Array.from(this.documents.values())
  }

  getDocument(docId: string): EditorDocument | null {
    return this.documents.get(docId) || null
  }

  getActiveDocument(): EditorDocument | null {
    if (!this.activeDocId) return null
    return this.documents.get(this.activeDocId) || null
  }

  getActiveDocId(): string {
    return this.activeDocId || ''
  }

  setActiveDocument(docId: string): boolean {
    if (!this.documents.has(docId)) return false
    this.activeDocId = docId
    return true
  }

  addDocument(doc: Omit<EditorDocument, 'id' | 'blocks'>): string {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const { blocks } = parseMarkdown(doc.content)
    const newDoc: EditorDocument = {
      ...doc,
      id,
      blocks,
    }
    this.documents.set(id, newDoc)
    if (!this.activeDocId) {
      this.activeDocId = id
    }
    return id
  }

  removeDocument(docId: string): boolean {
    if (!this.documents.has(docId)) return false
    this.documents.delete(docId)
    if (this.activeDocId === docId) {
      const remaining = Array.from(this.documents.keys())
      this.activeDocId = remaining.length > 0 ? remaining[0] : null
    }
    return true
  }

  updateDocumentContent(docId: string, content: string): boolean {
    const doc = this.documents.get(docId)
    if (!doc) return false
    const { blocks } = parseMarkdown(content)
    this.documents.set(docId, {
      ...doc,
      content,
      blocks,
      isDirty: true,
    })
    return true
  }

  updateDocumentBlocks(docId: string, blocks: Block[]): boolean {
    const doc = this.documents.get(docId)
    if (!doc) return false
    this.documents.set(docId, {
      ...doc,
      blocks,
      isDirty: true,
    })
    return true
  }

  markDocumentClean(docId: string): boolean {
    const doc = this.documents.get(docId)
    if (!doc) return false
    this.documents.set(docId, { ...doc, isDirty: false })
    return true
  }

  size(): number {
    return this.documents.size
  }
}
