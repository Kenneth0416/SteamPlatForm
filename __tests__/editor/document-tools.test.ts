import { DocumentManager } from '@/lib/editor/document-manager'
import { BlockIndexService } from '@/lib/editor/block-index'
import { ReadWriteGuard } from '@/lib/editor/tools/middleware'
import { createListDocumentsTool, createSwitchDocumentTool, MultiDocToolContext } from '@/lib/editor/tools/document-tools'
import type { EditorDocument, Block, PendingDiff } from '@/lib/editor/types'

// Mock parseMarkdown
jest.mock('@/lib/editor/parser', () => ({
  parseMarkdown: (content: string) => ({
    blocks: [{ id: 'block-1', type: 'paragraph', content: content.slice(0, 50), order: 0 }],
    markdown: content,
  }),
}))

describe('Document Tools', () => {
  const createTestDoc = (id: string, name: string, type: 'lesson' | 'guide' = 'lesson'): EditorDocument => ({
    id,
    name,
    type,
    content: '# Test',
    blocks: [{ id: 'block-1', type: 'heading', content: 'Test', order: 0, level: 1 }],
    isDirty: false,
    createdAt: new Date(),
  })

  const createContext = (docs: EditorDocument[], activeId?: string): MultiDocToolContext => {
    const documentManager = new DocumentManager(docs, activeId)
    const activeDoc = documentManager.getActiveDocument()
    const blocks = activeDoc?.blocks || []
    const pendingDiffs: PendingDiff[] = []
    const pendingDiffsByDoc = new Map<string, PendingDiff[]>()
    docs.forEach(d => pendingDiffsByDoc.set(d.id, []))

    return {
      documentManager,
      blockIndex: new BlockIndexService(blocks),
      guard: new ReadWriteGuard(),
      pendingDiffs,
      pendingDiffsByDoc,
    }
  }

  describe('list_documents', () => {
    it('should list all documents with active marker', async () => {
      const docs = [
        createTestDoc('doc-1', 'Lesson Plan', 'lesson'),
        createTestDoc('doc-2', 'Teacher Guide', 'guide'),
      ]
      const ctx = createContext(docs, 'doc-1')
      const tool = createListDocumentsTool(ctx)

      const result = await tool.func({})

      expect(result).toContain('Documents (2)')
      expect(result).toContain('→ [doc-1] Lesson Plan')
      expect(result).toContain('  [doc-2] Teacher Guide')
      expect(result).toContain('→ = active document')
    })

    it('should show dirty marker for unsaved documents', async () => {
      const docs = [createTestDoc('doc-1', 'Lesson Plan')]
      docs[0].isDirty = true
      const ctx = createContext(docs)
      const tool = createListDocumentsTool(ctx)

      const result = await tool.func({})

      expect(result).toContain('Lesson Plan*')
      expect(result).toContain('* = unsaved changes')
    })

    it('should handle empty document list', async () => {
      const ctx = createContext([])
      const tool = createListDocumentsTool(ctx)

      const result = await tool.func({})

      expect(result).toBe('No documents open.')
    })
  })

  describe('switch_document', () => {
    it('should switch to specified document', async () => {
      const docs = [
        createTestDoc('doc-1', 'Lesson Plan'),
        createTestDoc('doc-2', 'Teacher Guide'),
      ]
      const ctx = createContext(docs, 'doc-1')
      const tool = createSwitchDocumentTool(ctx)

      const result = await tool.func({ docId: 'doc-2' })

      expect(result).toContain('Switched to: Teacher Guide')
      expect(ctx.documentManager.getActiveDocId()).toBe('doc-2')
    })

    it('should reset guard on switch', async () => {
      const docs = [
        createTestDoc('doc-1', 'Lesson Plan'),
        createTestDoc('doc-2', 'Teacher Guide'),
      ]
      const ctx = createContext(docs, 'doc-1')
      ctx.guard.markDocumentRead()
      ctx.guard.markBlockRead('block-1')

      const tool = createSwitchDocumentTool(ctx)
      await tool.func({ docId: 'doc-2' })

      expect(ctx.guard.hasReadDocument()).toBe(false)
      expect(ctx.guard.hasReadBlock('block-1')).toBe(false)
    })

    it('should call onDocumentSwitch callback', async () => {
      const docs = [
        createTestDoc('doc-1', 'Lesson Plan'),
        createTestDoc('doc-2', 'Teacher Guide'),
      ]
      const ctx = createContext(docs, 'doc-1')
      const switchCallback = jest.fn()
      ctx.onDocumentSwitch = switchCallback

      const tool = createSwitchDocumentTool(ctx)
      await tool.func({ docId: 'doc-2' })

      expect(switchCallback).toHaveBeenCalledWith('doc-2', docs[1].blocks)
    })

    it('should return error for non-existent document', async () => {
      const docs = [createTestDoc('doc-1', 'Lesson Plan')]
      const ctx = createContext(docs)
      const tool = createSwitchDocumentTool(ctx)

      const result = await tool.func({ docId: 'invalid' })

      expect(result).toContain('Error: Document "invalid" not found')
      expect(result).toContain('Available: doc-1')
    })

    it('should update pendingDiffs reference on switch', async () => {
      const docs = [
        createTestDoc('doc-1', 'Lesson Plan'),
        createTestDoc('doc-2', 'Teacher Guide'),
      ]
      const ctx = createContext(docs, 'doc-1')

      // Add diff to doc-2
      const doc2Diff: PendingDiff = {
        id: 'diff-1',
        blockId: 'block-1',
        action: 'update',
        oldContent: 'old',
        newContent: 'new',
        reason: 'test',
      }
      ctx.pendingDiffsByDoc.set('doc-2', [doc2Diff])

      const tool = createSwitchDocumentTool(ctx)
      await tool.func({ docId: 'doc-2' })

      expect(ctx.pendingDiffs).toHaveLength(1)
      expect(ctx.pendingDiffs[0].id).toBe('diff-1')
    })
  })
})
