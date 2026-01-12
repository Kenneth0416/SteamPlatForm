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

import { useEditorStore } from '@/stores/editorStore'
import type { Block, PendingDiff } from '@/lib/editor/types'

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
})
