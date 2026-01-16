import { DocumentManager } from '@/lib/editor/document-manager'
import type { EditorDocument } from '@/lib/editor/types'

// Mock parseMarkdown to avoid ESM module issues
jest.mock('@/lib/editor/parser', () => ({
  parseMarkdown: (content: string) => ({
    blocks: [{ id: 'block-1', type: 'paragraph', content: content.slice(0, 50), order: 0 }],
    markdown: content,
  }),
}))

describe('DocumentManager', () => {
  const createTestDoc = (id: string, name: string, content = '# Test'): EditorDocument => ({
    id,
    name,
    type: 'custom',
    content,
    blocks: [{ id: 'block-1', type: 'heading', content: 'Test', order: 0, level: 1 }],
    isDirty: false,
    createdAt: new Date(),
  })

  describe('constructor', () => {
    it('should initialize with empty documents', () => {
      const manager = new DocumentManager()
      expect(manager.size()).toBe(0)
      expect(manager.getActiveDocument()).toBeNull()
    })

    it('should initialize with provided documents', () => {
      const docs = [createTestDoc('doc-1', 'Doc 1'), createTestDoc('doc-2', 'Doc 2')]
      const manager = new DocumentManager(docs, 'doc-2')
      expect(manager.size()).toBe(2)
      expect(manager.getActiveDocId()).toBe('doc-2')
    })

    it('should default to first document if activeDocId not found', () => {
      const docs = [createTestDoc('doc-1', 'Doc 1')]
      const manager = new DocumentManager(docs, 'invalid-id')
      expect(manager.getActiveDocId()).toBe('doc-1')
    })
  })

  describe('getAllDocuments', () => {
    it('should return all documents', () => {
      const docs = [createTestDoc('doc-1', 'Doc 1'), createTestDoc('doc-2', 'Doc 2')]
      const manager = new DocumentManager(docs)
      expect(manager.getAllDocuments()).toHaveLength(2)
    })
  })

  describe('getDocument', () => {
    it('should return document by id', () => {
      const docs = [createTestDoc('doc-1', 'Doc 1')]
      const manager = new DocumentManager(docs)
      expect(manager.getDocument('doc-1')?.name).toBe('Doc 1')
    })

    it('should return null for non-existent id', () => {
      const manager = new DocumentManager()
      expect(manager.getDocument('invalid')).toBeNull()
    })
  })

  describe('setActiveDocument', () => {
    it('should switch active document', () => {
      const docs = [createTestDoc('doc-1', 'Doc 1'), createTestDoc('doc-2', 'Doc 2')]
      const manager = new DocumentManager(docs, 'doc-1')
      expect(manager.setActiveDocument('doc-2')).toBe(true)
      expect(manager.getActiveDocId()).toBe('doc-2')
    })

    it('should return false for non-existent document', () => {
      const manager = new DocumentManager()
      expect(manager.setActiveDocument('invalid')).toBe(false)
    })
  })

  describe('addDocument', () => {
    it('should add new document and parse blocks', () => {
      const manager = new DocumentManager()
      const id = manager.addDocument({
        name: 'New Doc',
        type: 'lesson',
        content: '# Heading\n\nParagraph',
        isDirty: false,
        createdAt: new Date(),
      })
      expect(id).toMatch(/^doc-/)
      expect(manager.size()).toBe(1)
      const doc = manager.getDocument(id)
      expect(doc?.blocks.length).toBeGreaterThan(0)
    })

    it('should set as active if no active document', () => {
      const manager = new DocumentManager()
      const id = manager.addDocument({
        name: 'New Doc',
        type: 'custom',
        content: '# Test',
        isDirty: false,
        createdAt: new Date(),
      })
      expect(manager.getActiveDocId()).toBe(id)
    })
  })

  describe('removeDocument', () => {
    it('should remove document', () => {
      const docs = [createTestDoc('doc-1', 'Doc 1'), createTestDoc('doc-2', 'Doc 2')]
      const manager = new DocumentManager(docs, 'doc-1')
      expect(manager.removeDocument('doc-1')).toBe(true)
      expect(manager.size()).toBe(1)
      expect(manager.getDocument('doc-1')).toBeNull()
    })

    it('should switch active to remaining document', () => {
      const docs = [createTestDoc('doc-1', 'Doc 1'), createTestDoc('doc-2', 'Doc 2')]
      const manager = new DocumentManager(docs, 'doc-1')
      manager.removeDocument('doc-1')
      expect(manager.getActiveDocId()).toBe('doc-2')
    })

    it('should return false for non-existent document', () => {
      const manager = new DocumentManager()
      expect(manager.removeDocument('invalid')).toBe(false)
    })
  })

  describe('updateDocumentContent', () => {
    it('should update content and re-parse blocks', () => {
      const docs = [createTestDoc('doc-1', 'Doc 1', '# Old')]
      const manager = new DocumentManager(docs)
      expect(manager.updateDocumentContent('doc-1', '# New\n\nParagraph')).toBe(true)
      const doc = manager.getDocument('doc-1')
      expect(doc?.content).toBe('# New\n\nParagraph')
      expect(doc?.isDirty).toBe(true)
    })

    it('should return false for non-existent document', () => {
      const manager = new DocumentManager()
      expect(manager.updateDocumentContent('invalid', 'content')).toBe(false)
    })
  })

  describe('updateDocumentBlocks', () => {
    it('should update blocks directly', () => {
      const docs = [createTestDoc('doc-1', 'Doc 1')]
      const manager = new DocumentManager(docs)
      const newBlocks = [{ id: 'new-block', type: 'paragraph' as const, content: 'New', order: 0 }]
      expect(manager.updateDocumentBlocks('doc-1', newBlocks)).toBe(true)
      expect(manager.getDocument('doc-1')?.blocks).toEqual(newBlocks)
    })
  })

  describe('markDocumentClean', () => {
    it('should mark document as not dirty', () => {
      const docs = [createTestDoc('doc-1', 'Doc 1')]
      const manager = new DocumentManager(docs)
      manager.updateDocumentContent('doc-1', '# Changed')
      expect(manager.getDocument('doc-1')?.isDirty).toBe(true)
      manager.markDocumentClean('doc-1')
      expect(manager.getDocument('doc-1')?.isDirty).toBe(false)
    })
  })
})
