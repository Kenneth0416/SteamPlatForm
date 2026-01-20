// Mock unified and remark modules
jest.mock('unified', () => ({
  unified: () => ({
    use: jest.fn().mockReturnThis(),
    parse: (md: string) => {
      const lines = md.split('\n').filter(l => l.trim())
      const children: unknown[] = []
      for (const line of lines) {
        if (line.startsWith('# ')) {
          children.push({
            type: 'heading',
            depth: 1,
            children: [{ type: 'text', value: line.slice(2) }],
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

import { DOCUMENT_SWITCH_LOCK_TIMEOUT_MS, useEditorStore } from '@/stores/editorStore'
import type { Block, EditorDocument, PendingDiff } from '@/lib/editor/types'

const flushMicrotasks = async (steps = 6) => {
  for (let i = 0; i < steps; i++) {
    await Promise.resolve()
  }
}

describe('EditorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().reset()
  })

  describe('basic state', () => {
    it('should have initial state', () => {
      const state = useEditorStore.getState()
      expect(state.lessonId).toBeNull()
      expect(state.blocks).toEqual([])
      expect(state.markdown).toBe('')
      expect(state.undoStack).toEqual([])
      expect(state.redoStack).toEqual([])
      expect(state.pendingDiffs).toEqual([])
    })

    it('should set lessonId', () => {
      useEditorStore.getState().setLessonId('lesson-1')
      expect(useEditorStore.getState().lessonId).toBe('lesson-1')
    })

    it('should set markdown and parse blocks', () => {
      useEditorStore.getState().setMarkdown('# Title\n\nParagraph')
      const state = useEditorStore.getState()
      expect(state.blocks.length).toBeGreaterThan(0)
      expect(state.blocks[0].type).toBe('heading')
    })

    it('should set blocks and generate markdown', () => {
      const blocks: Block[] = [
        { id: 'b1', type: 'heading', content: 'Test', order: 0, level: 1 },
      ]
      useEditorStore.getState().setBlocks(blocks)
      const state = useEditorStore.getState()
      expect(state.blocks).toEqual(blocks)
      expect(state.markdown).toContain('# Test')
    })
  })

  describe('edit operations', () => {
    beforeEach(() => {
      const blocks: Block[] = [
        { id: 'b1', type: 'heading', content: 'Title', order: 0, level: 1 },
        { id: 'b2', type: 'paragraph', content: 'Content', order: 1 },
      ]
      useEditorStore.getState().setBlocks(blocks)
    })

    it('should update block content', () => {
      useEditorStore.getState().updateBlock('b1', 'New Title')
      const state = useEditorStore.getState()
      expect(state.blocks[0].content).toBe('New Title')
    })

    it('should add block after specified block', () => {
      useEditorStore.getState().addBlockAfter('b1', 'paragraph', 'New paragraph')
      const state = useEditorStore.getState()
      expect(state.blocks).toHaveLength(3)
      expect(state.blocks[1].content).toBe('New paragraph')
    })

    it('should add block at beginning when afterBlockId is null', () => {
      useEditorStore.getState().addBlockAfter(null, 'heading', 'First', 1)
      const state = useEditorStore.getState()
      expect(state.blocks[0].content).toBe('First')
    })

    it('should remove block', () => {
      useEditorStore.getState().removeBlock('b1')
      const state = useEditorStore.getState()
      expect(state.blocks).toHaveLength(1)
      expect(state.blocks[0].id).toBe('b2')
    })
  })

  describe('undo/redo', () => {
    it('should no-op when stacks are empty', () => {
      useEditorStore.getState().reset()
      useEditorStore.getState().undo()
      useEditorStore.getState().redo()
      expect(useEditorStore.getState().blocks).toEqual([])
    })

    beforeEach(() => {
      const blocks: Block[] = [
        { id: 'b1', type: 'paragraph', content: 'Original', order: 0 },
      ]
      useEditorStore.getState().setBlocks(blocks)
    })

    it('should push to undo stack on edit', () => {
      useEditorStore.getState().updateBlock('b1', 'Modified')
      expect(useEditorStore.getState().undoStack).toHaveLength(1)
    })

    it('should undo changes', () => {
      useEditorStore.getState().updateBlock('b1', 'Modified')
      useEditorStore.getState().undo()
      expect(useEditorStore.getState().blocks[0].content).toBe('Original')
    })

    it('should redo changes', () => {
      useEditorStore.getState().updateBlock('b1', 'Modified')
      useEditorStore.getState().undo()
      useEditorStore.getState().redo()
      expect(useEditorStore.getState().blocks[0].content).toBe('Modified')
    })

    it('should clear redo stack on new edit', () => {
      useEditorStore.getState().updateBlock('b1', 'First')
      useEditorStore.getState().undo()
      useEditorStore.getState().updateBlock('b1', 'Second')
      expect(useEditorStore.getState().redoStack).toHaveLength(0)
    })

    it('should limit undo stack to 20 items', () => {
      for (let i = 0; i < 25; i++) {
        useEditorStore.getState().updateBlock('b1', `Edit ${i}`)
      }
      expect(useEditorStore.getState().undoStack.length).toBeLessThanOrEqual(20)
    })

    it('should report canUndo correctly', () => {
      expect(useEditorStore.getState().canUndo()).toBe(false)
      useEditorStore.getState().updateBlock('b1', 'Modified')
      expect(useEditorStore.getState().canUndo()).toBe(true)
    })

    it('should report canRedo correctly', () => {
      expect(useEditorStore.getState().canRedo()).toBe(false)
      useEditorStore.getState().updateBlock('b1', 'Modified')
      useEditorStore.getState().undo()
      expect(useEditorStore.getState().canRedo()).toBe(true)
    })
  })

  describe('pending diffs', () => {
    beforeEach(() => {
      const blocks: Block[] = [
        { id: 'b1', type: 'paragraph', content: 'Original', order: 0 },
        { id: 'b2', type: 'paragraph', content: 'Second', order: 1 },
      ]
      useEditorStore.getState().setBlocks(blocks)
    })

    it('should add pending diff', () => {
      const diff: PendingDiff = {
        id: 'diff-1',
        blockId: 'b1',
        action: 'update',
        oldContent: 'Original',
        newContent: 'Updated',
        reason: 'Test',
      }
      useEditorStore.getState().addPendingDiff(diff)
      expect(useEditorStore.getState().pendingDiffs).toHaveLength(1)
    })

    it('should apply update diff', () => {
      const diff: PendingDiff = {
        id: 'diff-1',
        blockId: 'b1',
        action: 'update',
        oldContent: 'Original',
        newContent: 'Updated',
        reason: 'Test',
      }
      useEditorStore.getState().addPendingDiff(diff)
      useEditorStore.getState().applyDiff('diff-1')

      const state = useEditorStore.getState()
      expect(state.blocks[0].content).toBe('Updated')
      expect(state.pendingDiffs).toHaveLength(0)
    })

    it('should apply add diff', () => {
      const diff: PendingDiff = {
        id: 'diff-1',
        blockId: 'b1',
        action: 'add',
        oldContent: '',
        newContent: JSON.stringify({ type: 'paragraph', content: 'New block' }),
        reason: 'Test',
      }
      useEditorStore.getState().addPendingDiff(diff)
      useEditorStore.getState().applyDiff('diff-1')

      expect(useEditorStore.getState().blocks).toHaveLength(3)
    })

    it('should apply delete diff', () => {
      const diff: PendingDiff = {
        id: 'diff-1',
        blockId: 'b1',
        action: 'delete',
        oldContent: 'Original',
        newContent: '',
        reason: 'Test',
      }
      useEditorStore.getState().addPendingDiff(diff)
      useEditorStore.getState().applyDiff('diff-1')

      expect(useEditorStore.getState().blocks).toHaveLength(1)
      expect(useEditorStore.getState().blocks[0].id).toBe('b2')
    })

    it('should reject diff', () => {
      const diff: PendingDiff = {
        id: 'diff-1',
        blockId: 'b1',
        action: 'update',
        oldContent: 'Original',
        newContent: 'Updated',
        reason: 'Test',
      }
      useEditorStore.getState().addPendingDiff(diff)
      useEditorStore.getState().rejectDiff('diff-1')

      const state = useEditorStore.getState()
      expect(state.blocks[0].content).toBe('Original')
      expect(state.pendingDiffs).toHaveLength(0)
    })

    it('should apply all diffs', () => {
      useEditorStore.getState().setPendingDiffs([
        { id: 'd1', blockId: 'b1', action: 'update', oldContent: 'Original', newContent: 'Updated1', reason: 'Test' },
        { id: 'd2', blockId: 'b2', action: 'update', oldContent: 'Second', newContent: 'Updated2', reason: 'Test' },
      ])
      useEditorStore.getState().applyAllDiffs()

      const state = useEditorStore.getState()
      expect(state.blocks[0].content).toBe('Updated1')
      expect(state.blocks[1].content).toBe('Updated2')
      expect(state.pendingDiffs).toHaveLength(0)
    })

    it('should reject all diffs', () => {
      useEditorStore.getState().setPendingDiffs([
        { id: 'd1', blockId: 'b1', action: 'update', oldContent: 'Original', newContent: 'Updated1', reason: 'Test' },
        { id: 'd2', blockId: 'b2', action: 'update', oldContent: 'Second', newContent: 'Updated2', reason: 'Test' },
      ])
      useEditorStore.getState().rejectAllDiffs()

      const state = useEditorStore.getState()
      expect(state.blocks[0].content).toBe('Original')
      expect(state.pendingDiffs).toHaveLength(0)
    })

    it('should push to undo stack when applying diff', () => {
      const diff: PendingDiff = {
        id: 'diff-1',
        blockId: 'b1',
        action: 'update',
        oldContent: 'Original',
        newContent: 'Updated',
        reason: 'Test',
      }
      useEditorStore.getState().addPendingDiff(diff)
      useEditorStore.getState().applyDiff('diff-1')

      expect(useEditorStore.getState().undoStack).toHaveLength(1)
    })
  })

  describe('chat messages', () => {
    it('should add chat message', () => {
      useEditorStore.getState().addChatMessage({
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
      })
      expect(useEditorStore.getState().chatMessages).toHaveLength(1)
    })

    it('should update an existing chat message', () => {
      useEditorStore.getState().addChatMessage({ id: 'msg-2', role: 'assistant', content: 'Other' })
      useEditorStore.getState().addChatMessage({ id: 'msg-1', role: 'user', content: 'Hello' })
      useEditorStore.getState().updateChatMessage('msg-1', 'Updated')
      const messages = useEditorStore.getState().chatMessages
      expect(messages.find(m => m.id === 'msg-1')?.content).toBe('Updated')
      expect(messages.find(m => m.id === 'msg-2')?.content).toBe('Other')
    })

    it('should clear chat', () => {
      useEditorStore.getState().addChatMessage({ id: 'msg-1', role: 'user', content: 'Hello' })
      useEditorStore.getState().clearChat()
      expect(useEditorStore.getState().chatMessages).toHaveLength(0)
    })
  })

  describe('loading states', () => {
    it('should set loading state', () => {
      useEditorStore.getState().setLoading(true)
      expect(useEditorStore.getState().isLoading).toBe(true)
    })

    it('should set saving state', () => {
      useEditorStore.getState().setSaving(true)
      expect(useEditorStore.getState().isSaving).toBe(true)
    })
  })

  describe('streaming document updates', () => {
    beforeEach(() => {
      useEditorStore.getState().setDocuments([
        {
          id: 'doc-1',
          name: 'Doc 1',
          type: 'lesson',
          content: 'Intro',
          blocks: [],
          isDirty: false,
          createdAt: new Date(),
        },
      ])
    })

    it('appends streamed content and syncs the active markdown', () => {
      useEditorStore.getState().appendDocumentContent('doc-1', ' and more')

      const state = useEditorStore.getState()
      expect(state.documents[0].content).toBe('Intro and more')
      expect(state.documents[0].isDirty).toBe(true)
      expect(state.markdown).toBe('Intro and more')
      expect(state.blocks.length).toBeGreaterThan(0)
    })

    it('updates the target document without overriding inactive markdown', () => {
      useEditorStore.getState().addDocument({
        id: 'doc-2',
        name: 'Doc 2',
        type: 'lesson',
        content: 'Doc 2 content',
        blocks: [],
        isDirty: false,
        createdAt: new Date(),
      })

      useEditorStore.getState().appendDocumentContent('doc-1', ' stream chunk')

      const state = useEditorStore.getState()
      expect(state.documents.find(d => d.id === 'doc-1')?.content).toBe('Intro stream chunk')
      expect(state.markdown).toBe('Doc 2 content')
    })
  })

  describe('document lifecycle operations', () => {
    it('syncs active document content when blocks change', () => {
      const blocks: Block[] = [{ id: 'b-sync', type: 'paragraph', content: 'Old', order: 0 }]
      useEditorStore.setState({
        documents: [
          {
            id: 'doc-sync',
            name: 'Doc Sync',
            type: 'lesson',
            content: 'Old',
            blocks,
            isDirty: false,
            createdAt: new Date(),
          },
          {
            id: 'doc-2',
            name: 'Doc 2',
            type: 'lesson',
            content: 'Second',
            blocks: [],
            isDirty: false,
            createdAt: new Date(),
          },
        ],
        activeDocId: 'doc-sync',
        blocks,
        markdown: 'Old',
        pendingDiffsByDoc: new Map([['doc-sync', []], ['doc-2', []]]),
      })

      useEditorStore.getState().updateBlock('b-sync', 'New value')

      const doc = useEditorStore.getState().documents[0]
      expect(doc.content).toContain('New value')
      expect(doc.isDirty).toBe(true)
    })

    it('removes documents and updates the active selection', () => {
      const doc1: EditorDocument = {
        id: 'doc-1',
        name: 'Doc 1',
        type: 'lesson',
        content: 'Doc 1',
        blocks: [],
        isDirty: false,
        createdAt: new Date(),
      }
      const doc2: EditorDocument = {
        id: 'doc-2',
        name: 'Doc 2',
        type: 'lesson',
        content: 'Doc 2',
        blocks: [],
        isDirty: false,
        createdAt: new Date(),
      }
      useEditorStore.setState({
        documents: [doc1, doc2],
        activeDocId: 'doc-1',
        markdown: 'Doc 1',
        pendingDiffsByDoc: new Map([['doc-1', []], ['doc-2', []]]),
      })

      useEditorStore.getState().removeDocument('doc-1')

      const state = useEditorStore.getState()
      expect(state.activeDocId).toBe('doc-2')
      expect(state.documents).toHaveLength(1)
      expect(state.markdown).toBe('Doc 2')
    })

    it('handles empty document lists when setting documents', () => {
      useEditorStore.getState().setDocuments([])
      const state = useEditorStore.getState()
      expect(state.activeDocId).toBeNull()
      expect(state.markdown).toBe('')
      expect(state.blocks).toEqual([])
    })

    it('retains the current active document when removing a different one', () => {
      const doc1: EditorDocument = {
        id: 'doc-1',
        name: 'Doc 1',
        type: 'lesson',
        content: 'Doc 1',
        blocks: [],
        isDirty: false,
        createdAt: new Date(),
      }
      const doc2: EditorDocument = {
        id: 'doc-2',
        name: 'Doc 2',
        type: 'lesson',
        content: 'Doc 2',
        blocks: [],
        isDirty: false,
        createdAt: new Date(),
      }
      useEditorStore.setState({
        documents: [doc1, doc2],
        activeDocId: 'doc-2',
        markdown: 'Doc 2',
        pendingDiffsByDoc: new Map([['doc-1', []], ['doc-2', []]]),
      })

      useEditorStore.getState().removeDocument('doc-1')

      const state = useEditorStore.getState()
      expect(state.activeDocId).toBe('doc-2')
      expect(state.documents).toHaveLength(1)
      expect(state.markdown).toBe('Doc 2')
    })

    it('switches documents and preserves dirty state and pending diffs', () => {
      const doc1: EditorDocument = {
        id: 'doc-1',
        name: 'Doc 1',
        type: 'lesson',
        content: 'Doc 1 original',
        blocks: [{ id: 'b1', type: 'paragraph', content: 'Doc 1 original', order: 0 }],
        isDirty: false,
        createdAt: new Date(),
      }
      const doc2: EditorDocument = {
        id: 'doc-2',
        name: 'Doc 2',
        type: 'lesson',
        content: 'Doc 2',
        blocks: [{ id: 'b2', type: 'paragraph', content: 'Doc 2', order: 0 }],
        isDirty: false,
        createdAt: new Date(),
      }
      const pendingMap = new Map<string, PendingDiff[]>([
        ['doc-1', []],
        ['doc-2', [{ id: 'd2', blockId: 'b2', action: 'update', oldContent: 'Doc 2', newContent: 'Doc 2 updated', reason: 'test' }]],
      ])
      useEditorStore.setState({
        documents: [doc1, doc2],
        activeDocId: 'doc-1',
        blocks: doc1.blocks,
        markdown: 'Doc 1 edited',
        pendingDiffsByDoc: pendingMap,
        pendingDiffs: [],
      })

      useEditorStore.getState().switchDocument('doc-2')

      const state = useEditorStore.getState()
      const savedDoc1 = state.documents.find(d => d.id === 'doc-1')!
      expect(savedDoc1.isDirty).toBe(true)
      expect(savedDoc1.content).toBe('Doc 1 edited')
      expect(state.activeDocId).toBe('doc-2')
      expect(state.pendingDiffs).toEqual(pendingMap.get('doc-2'))
      expect(state.markdown).toBe('Doc 2')
    })

    it('switches documents when no active document is set', () => {
      const doc: EditorDocument = {
        id: 'doc-1',
        name: 'Doc 1',
        type: 'lesson',
        content: 'Solo doc',
        blocks: [{ id: 'b1', type: 'paragraph', content: 'Solo doc', order: 0 }],
        isDirty: false,
        createdAt: new Date(),
      }
      useEditorStore.setState({
        documents: [doc],
        activeDocId: null,
        pendingDiffsByDoc: new Map(),
      })

      useEditorStore.getState().switchDocument('doc-1')

      const state = useEditorStore.getState()
      expect(state.activeDocId).toBe('doc-1')
      expect(state.markdown).toBe('Solo doc')
    })

    it('keeps documents clean when content has not changed while switching', () => {
      const doc1: EditorDocument = {
        id: 'doc-1',
        name: 'Doc 1',
        type: 'lesson',
        content: 'Stable',
        blocks: [{ id: 'b1', type: 'paragraph', content: 'Stable', order: 0 }],
        isDirty: false,
        createdAt: new Date(),
      }
      const doc2: EditorDocument = {
        id: 'doc-2',
        name: 'Doc 2',
        type: 'lesson',
        content: 'Next',
        blocks: [{ id: 'b2', type: 'paragraph', content: 'Next', order: 0 }],
        isDirty: false,
        createdAt: new Date(),
      }
      useEditorStore.setState({
        documents: [doc1, doc2],
        activeDocId: 'doc-1',
        blocks: doc1.blocks,
        markdown: 'Stable',
        pendingDiffsByDoc: new Map([['doc-1', []]]),
      })

      useEditorStore.getState().switchDocument('doc-2')

      const state = useEditorStore.getState()
      const savedDoc1 = state.documents.find(d => d.id === 'doc-1')!
      expect(savedDoc1.isDirty).toBe(false)
      expect(state.pendingDiffs).toEqual([])
    })

    it('updates document content for the active document', () => {
      const doc: EditorDocument = {
        id: 'doc-1',
        name: 'Doc 1',
        type: 'lesson',
        content: 'Original content',
        blocks: [],
        isDirty: false,
        createdAt: new Date(),
      }
      useEditorStore.setState({
        documents: [doc],
        activeDocId: 'doc-1',
        markdown: 'Original content',
        pendingDiffsByDoc: new Map([['doc-1', []]]),
      })

      useEditorStore.getState().updateDocumentContent('doc-1', 'New content')

      const state = useEditorStore.getState()
      expect(state.markdown).toBe('New content')
      expect(state.documents[0].content).toBe('New content')
    })

    it('exposes streaming helpers and active document lookup', () => {
      const doc: EditorDocument = {
        id: 'doc-1',
        name: 'Doc 1',
        type: 'lesson',
        content: 'Lookup',
        blocks: [],
        isDirty: false,
        createdAt: new Date(),
      }
      useEditorStore.setState({
        documents: [doc],
        activeDocId: 'doc-1',
        markdown: 'Lookup',
        pendingDiffsByDoc: new Map([['doc-1', []]]),
      })

      expect(useEditorStore.getState().getActiveDocument()?.id).toBe('doc-1')
      useEditorStore.getState().setStreamingDocId('doc-1')
      expect(useEditorStore.getState().streamingDocId).toBe('doc-1')
    })

    it('no-ops when switching to the same or unknown document', () => {
      const doc: EditorDocument = {
        id: 'doc-1',
        name: 'Doc 1',
        type: 'lesson',
        content: 'Content',
        blocks: [],
        isDirty: false,
        createdAt: new Date(),
      }
      useEditorStore.setState({
        documents: [doc],
        activeDocId: 'doc-1',
        markdown: 'Content',
        pendingDiffsByDoc: new Map([['doc-1', []]]),
      })

      useEditorStore.getState().switchDocument('doc-1')
      expect(useEditorStore.getState().activeDocId).toBe('doc-1')

      useEditorStore.getState().switchDocument('missing')
      expect(useEditorStore.getState().activeDocId).toBe('doc-1')
    })

    it('updates only the target document when it is not active', () => {
      const doc1: EditorDocument = {
        id: 'doc-1',
        name: 'Doc 1',
        type: 'lesson',
        content: 'Doc 1',
        blocks: [],
        isDirty: false,
        createdAt: new Date(),
      }
      const doc2: EditorDocument = {
        id: 'doc-2',
        name: 'Doc 2',
        type: 'lesson',
        content: 'Doc 2',
        blocks: [],
        isDirty: false,
        createdAt: new Date(),
      }
      useEditorStore.setState({
        documents: [doc1, doc2],
        activeDocId: 'doc-1',
        markdown: 'Doc 1',
        pendingDiffsByDoc: new Map([['doc-1', []], ['doc-2', []]]),
      })

      useEditorStore.getState().updateDocumentContent('doc-2', 'Updated doc 2')

      const state = useEditorStore.getState()
      expect(state.markdown).toBe('Doc 1')
      expect(state.documents.find(d => d.id === 'doc-2')?.content).toBe('Updated doc 2')
    })

    it('returns null for missing active document and ignores unknown append targets', () => {
      const prevState = useEditorStore.getState()
      expect(prevState.getActiveDocument()).toBeNull()

      prevState.appendDocumentContent('missing', 'chunk')
      expect(useEditorStore.getState()).toBe(prevState)
    })
  })

  describe('document switch lock', () => {
    const createDoc = (id: string, content: string): EditorDocument => ({
      id,
      name: id,
      type: 'lesson',
      content,
      blocks: [{ id: `${id}-block`, type: 'paragraph', content, order: 0 }],
      isDirty: false,
      createdAt: new Date(),
    })

    beforeEach(() => {
      useEditorStore.setState({
        documents: [createDoc('doc-1', 'Doc 1'), createDoc('doc-2', 'Doc 2'), createDoc('doc-3', 'Doc 3')],
        activeDocId: 'doc-1',
        blocks: [{ id: 'doc-1-block', type: 'paragraph', content: 'Doc 1', order: 0 }],
        markdown: 'Doc 1',
        pendingDiffsByDoc: new Map([['doc-1', []], ['doc-2', []], ['doc-3', []]]),
      })
    })

    it('queues concurrent switches and releases the lock', async () => {
      useEditorStore.getState().switchDocument('doc-2')
      useEditorStore.getState().switchDocument('doc-3')

      const midState = useEditorStore.getState()
      expect(midState.isDocumentSwitchLocked).toBe(true)
      expect(midState.activeDocId).toBe('doc-2')

      await flushMicrotasks()

      const finalState = useEditorStore.getState()
      expect(finalState.isDocumentSwitchLocked).toBe(false)
      expect(finalState.activeDocId).toBe('doc-3')
    })

    it('serializes remove operations behind a switch', async () => {
      useEditorStore.getState().switchDocument('doc-2')
      useEditorStore.getState().removeDocument('doc-2')

      const midState = useEditorStore.getState()
      expect(midState.documents).toHaveLength(3)
      expect(midState.activeDocId).toBe('doc-2')

      await flushMicrotasks(4)

      const finalState = useEditorStore.getState()
      expect(finalState.documents).toHaveLength(2)
      expect(finalState.activeDocId).toBe('doc-1')
    })

    it('releases the lock after the timeout', async () => {
      jest.useFakeTimers()
      try {
        useEditorStore.getState().withDocumentSwitchLock(() => new Promise<void>(() => {}))
        useEditorStore.getState().switchDocument('doc-2')

        expect(useEditorStore.getState().isDocumentSwitchLocked).toBe(true)

        jest.advanceTimersByTime(DOCUMENT_SWITCH_LOCK_TIMEOUT_MS + 50)
        await flushMicrotasks(4)

        const finalState = useEditorStore.getState()
        expect(finalState.isDocumentSwitchLocked).toBe(false)
        expect(finalState.activeDocId).toBe('doc-2')
      } finally {
        jest.useRealTimers()
      }
    })

    it('releases the lock when the operation throws', async () => {
      await useEditorStore.getState().withDocumentSwitchLock(() => {
        throw new Error('boom')
      })

      expect(useEditorStore.getState().isDocumentSwitchLocked).toBe(false)
    })

    it('clears the lock timer on reset', () => {
      jest.useFakeTimers()
      try {
        useEditorStore.getState().withDocumentSwitchLock(() => new Promise<void>(() => {}))
        expect(useEditorStore.getState().isDocumentSwitchLocked).toBe(true)

        useEditorStore.getState().reset()
        expect(useEditorStore.getState().isDocumentSwitchLocked).toBe(false)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('markDocumentsClean', () => {
    beforeEach(() => {
      const baseDoc: EditorDocument = {
        id: 'doc-1',
        name: 'Doc 1',
        type: 'lesson',
        content: 'Doc 1 content',
        blocks: [],
        isDirty: true,
        createdAt: new Date(),
      }
      const doc2: EditorDocument = {
        ...baseDoc,
        id: 'doc-2',
        name: 'Doc 2',
        isDirty: true,
        content: 'Doc 2 content',
      }
      const doc3: EditorDocument = {
        ...baseDoc,
        id: 'doc-3',
        name: 'Doc 3',
        isDirty: false,
        content: 'Doc 3 content',
      }

      useEditorStore.setState({
        documents: [baseDoc, doc2, doc3],
        pendingDiffsByDoc: new Map([
          ['doc-1', []],
          ['doc-2', []],
          ['doc-3', []],
        ]),
      })
    })

    it('clears dirty flags for the specified documents only', () => {
      useEditorStore.getState().markDocumentsClean(['doc-1', 'doc-3'])

      const state = useEditorStore.getState()
      expect(state.documents.find(d => d.id === 'doc-1')?.isDirty).toBe(false)
      expect(state.documents.find(d => d.id === 'doc-2')?.isDirty).toBe(true)
      expect(state.documents.find(d => d.id === 'doc-3')?.isDirty).toBe(false)
    })

    it('no-ops when given an empty id list', () => {
      useEditorStore.getState().markDocumentsClean([])

      const state = useEditorStore.getState()
      expect(state.documents.find(d => d.id === 'doc-1')?.isDirty).toBe(true)
      expect(state.documents.find(d => d.id === 'doc-2')?.isDirty).toBe(true)
      expect(state.documents.find(d => d.id === 'doc-3')?.isDirty).toBe(false)
    })

    it('ignores unknown document ids', () => {
      useEditorStore.getState().markDocumentsClean(['unknown'])

      const state = useEditorStore.getState()
      expect(state.documents.find(d => d.id === 'doc-1')?.isDirty).toBe(true)
      expect(state.documents.find(d => d.id === 'doc-2')?.isDirty).toBe(true)
      expect(state.documents.find(d => d.id === 'doc-3')?.isDirty).toBe(false)
    })
  })

  describe('diff edge cases', () => {
    it('ignores invalid add diff payloads', () => {
      useEditorStore.getState().setBlocks([{ id: 'b1', type: 'paragraph', content: 'Seed', order: 0 }])
      useEditorStore.getState().setPendingDiffs([
        { id: 'bad', blockId: '__start__', action: 'add', oldContent: '', newContent: '{bad json', reason: 'bad add' },
      ])

      useEditorStore.getState().applyDiff('bad')

      expect(useEditorStore.getState().pendingDiffs).toHaveLength(1)
    })

    it('applies add and delete actions when applying all diffs', () => {
      useEditorStore.getState().setBlocks([
        { id: 'keep', type: 'paragraph', content: 'Keep', order: 0 },
        { id: 'remove', type: 'paragraph', content: 'Remove', order: 1 },
      ])
      useEditorStore.getState().setPendingDiffs([
        { id: 'add', blockId: 'keep', action: 'add', oldContent: '', newContent: JSON.stringify({ type: 'paragraph', content: 'Added block' }), reason: 'add' },
        { id: 'del', blockId: 'remove', action: 'delete', oldContent: '', newContent: '', reason: 'delete' },
      ])

      useEditorStore.getState().applyAllDiffs()

      const state = useEditorStore.getState()
      expect(state.blocks.some(b => b.content === 'Added block')).toBe(true)
      expect(state.blocks.find(b => b.id === 'remove')).toBeUndefined()
      expect(state.pendingDiffs).toHaveLength(0)
    })

    it('adds new blocks after a specific id when applying a diff', () => {
      useEditorStore.getState().setBlocks([
        { id: 'anchor', type: 'paragraph', content: 'Anchor', order: 0 },
      ])
      useEditorStore.getState().setPendingDiffs([
        { id: 'after', blockId: 'anchor', action: 'add', oldContent: '', newContent: JSON.stringify({ type: 'paragraph', content: 'Inserted' }), reason: 'add after anchor' },
      ])

      useEditorStore.getState().applyDiff('after')

      expect(useEditorStore.getState().blocks.some(b => b.content === 'Inserted')).toBe(true)
    })

    it('returns early when a diff id is missing', () => {
      useEditorStore.getState().applyDiff('missing')
      expect(useEditorStore.getState().pendingDiffs).toEqual([])
    })

    it('skips malformed add diffs during bulk apply', () => {
      useEditorStore.getState().setBlocks([{ id: 'b1', type: 'paragraph', content: 'Only', order: 0 }])
      useEditorStore.getState().setPendingDiffs([
        { id: 'bad', blockId: 'b1', action: 'add', oldContent: '', newContent: 'not-json', reason: 'bad bulk add' },
      ])

      useEditorStore.getState().applyAllDiffs()

      const state = useEditorStore.getState()
      expect(state.blocks.find(b => b.content === 'Only')).toBeTruthy()
      expect(state.pendingDiffs).toHaveLength(0)
    })
  })

  describe('reset', () => {
    it('should reset all state', () => {
      useEditorStore.getState().setLessonId('lesson-1')
      useEditorStore.getState().setMarkdown('# Test')
      useEditorStore.getState().addChatMessage({ id: 'msg-1', role: 'user', content: 'Hello' })
      useEditorStore.getState().reset()

      const state = useEditorStore.getState()
      expect(state.lessonId).toBeNull()
      expect(state.blocks).toEqual([])
      expect(state.chatMessages).toEqual([])
    })
  })

  describe('pendingDiffs cleanup and isolation', () => {
    const createDoc = (id: string, content: string): EditorDocument => ({
      id,
      name: id,
      type: 'lesson',
      content,
      blocks: [{ id: `${id}-block`, type: 'paragraph', content, order: 0 }],
      isDirty: false,
      createdAt: new Date(),
    })

    beforeEach(() => {
      const doc1 = createDoc('doc-1', 'Doc 1')
      const doc2 = createDoc('doc-2', 'Doc 2')
      const doc3 = createDoc('doc-3', 'Doc 3')
      useEditorStore.setState({
        documents: [doc1, doc2, doc3],
        activeDocId: 'doc-1',
        blocks: doc1.blocks,
        markdown: doc1.content,
        pendingDiffsByDoc: new Map([
          ['doc-1', [{ id: 'd1', blockId: 'doc-1-block', action: 'update', oldContent: 'Doc 1', newContent: 'Doc 1 updated', reason: 'test' }]],
          ['doc-2', [{ id: 'd2', blockId: 'doc-2-block', action: 'update', oldContent: 'Doc 2', newContent: 'Doc 2 updated', reason: 'test' }]],
          ['doc-3', []],
        ]),
        pendingDiffs: [{ id: 'd1', blockId: 'doc-1-block', action: 'update', oldContent: 'Doc 1', newContent: 'Doc 1 updated', reason: 'test' }],
      })
    })

    it('cleans up pendingDiffsByDoc when document is removed', async () => {
      useEditorStore.getState().removeDocument('doc-2')
      await flushMicrotasks()

      const state = useEditorStore.getState()
      expect(state.pendingDiffsByDoc.has('doc-2')).toBe(false)
      expect(state.pendingDiffsByDoc.has('doc-1')).toBe(true)
      expect(state.pendingDiffsByDoc.has('doc-3')).toBe(true)
    })

    it('syncs pendingDiffs back to pendingDiffsByDoc when applying a diff', () => {
      useEditorStore.getState().applyDiff('d1')

      const state = useEditorStore.getState()
      expect(state.pendingDiffs).toHaveLength(0)
      expect(state.pendingDiffsByDoc.get('doc-1')).toHaveLength(0)
    })

    it('syncs pendingDiffs back to pendingDiffsByDoc when rejecting a diff', () => {
      useEditorStore.getState().rejectDiff('d1')

      const state = useEditorStore.getState()
      expect(state.pendingDiffs).toHaveLength(0)
      expect(state.pendingDiffsByDoc.get('doc-1')).toHaveLength(0)
    })

    it('syncs pendingDiffs back to pendingDiffsByDoc when applying all diffs', () => {
      useEditorStore.getState().setPendingDiffs([
        { id: 'd1', blockId: 'doc-1-block', action: 'update', oldContent: 'Doc 1', newContent: 'Doc 1 updated', reason: 'test' },
        { id: 'd1b', blockId: 'doc-1-block', action: 'update', oldContent: 'Doc 1 updated', newContent: 'Doc 1 final', reason: 'test' },
      ])
      useEditorStore.getState().applyAllDiffs()

      const state = useEditorStore.getState()
      expect(state.pendingDiffs).toHaveLength(0)
      expect(state.pendingDiffsByDoc.get('doc-1')).toHaveLength(0)
    })

    it('syncs pendingDiffs back to pendingDiffsByDoc when rejecting all diffs', () => {
      useEditorStore.getState().setPendingDiffs([
        { id: 'd1', blockId: 'doc-1-block', action: 'update', oldContent: 'Doc 1', newContent: 'Doc 1 updated', reason: 'test' },
        { id: 'd1b', blockId: 'doc-1-block', action: 'update', oldContent: 'Doc 1 updated', newContent: 'Doc 1 final', reason: 'test' },
      ])
      useEditorStore.getState().rejectAllDiffs()

      const state = useEditorStore.getState()
      expect(state.pendingDiffs).toHaveLength(0)
      expect(state.pendingDiffsByDoc.get('doc-1')).toHaveLength(0)
    })

    it('isolates pendingDiffs per document during concurrent editing', async () => {
      useEditorStore.getState().switchDocument('doc-2')
      await flushMicrotasks()

      const state = useEditorStore.getState()
      expect(state.activeDocId).toBe('doc-2')
      expect(state.pendingDiffs).toHaveLength(1)
      expect(state.pendingDiffs[0].id).toBe('d2')
      expect(state.pendingDiffsByDoc.get('doc-1')).toHaveLength(1)
      expect(state.pendingDiffsByDoc.get('doc-2')).toHaveLength(1)
    })

    it('prevents memory leak by cleaning up pendingDiffsByDoc on document removal', async () => {
      const initialSize = useEditorStore.getState().pendingDiffsByDoc.size
      expect(initialSize).toBe(3)

      useEditorStore.getState().removeDocument('doc-2')
      await flushMicrotasks()
      expect(useEditorStore.getState().pendingDiffsByDoc.size).toBe(2)

      useEditorStore.getState().removeDocument('doc-3')
      await flushMicrotasks()
      expect(useEditorStore.getState().pendingDiffsByDoc.size).toBe(1)
    })

    it('maintains pendingDiffsByDoc integrity during multiple document operations', async () => {
      const doc4 = createDoc('doc-4', 'Doc 4')
      useEditorStore.getState().addDocument(doc4)

      const state1 = useEditorStore.getState()
      expect(state1.pendingDiffsByDoc.has('doc-4')).toBe(true)
      expect(state1.pendingDiffsByDoc.get('doc-4')).toHaveLength(0)

      useEditorStore.getState().removeDocument('doc-4')
      await flushMicrotasks()

      const state2 = useEditorStore.getState()
      expect(state2.pendingDiffsByDoc.has('doc-4')).toBe(false)
    })
  })
})
