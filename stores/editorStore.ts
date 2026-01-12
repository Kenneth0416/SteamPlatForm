import { create } from 'zustand'
import type { Block, PendingDiff, BlockType } from '@/lib/editor/types'
import { parseMarkdown, blocksToMarkdown, updateBlockContent, addBlock, deleteBlock } from '@/lib/editor/parser'

const MAX_UNDO_STACK = 20

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface EditorState {
  // Document state
  lessonId: string | null
  blocks: Block[]
  markdown: string

  // Undo/Redo stacks (snapshots)
  undoStack: Block[][]
  redoStack: Block[][]

  // Pending diffs from LLM
  pendingDiffs: PendingDiff[]

  // Chat history
  chatMessages: ChatMessage[]

  // Loading states
  isLoading: boolean
  isSaving: boolean

  // Actions
  setLessonId: (id: string) => void
  setMarkdown: (markdown: string) => void
  setBlocks: (blocks: Block[]) => void

  // Edit operations
  updateBlock: (blockId: string, content: string) => void
  addBlockAfter: (afterBlockId: string | null, type: BlockType, content: string, level?: number) => void
  removeBlock: (blockId: string) => void

  // Undo/Redo
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Diff operations
  addPendingDiff: (diff: PendingDiff) => void
  setPendingDiffs: (diffs: PendingDiff[]) => void
  applyDiff: (diffId: string) => void
  rejectDiff: (diffId: string) => void
  applyAllDiffs: () => void
  rejectAllDiffs: () => void

  // Chat
  addChatMessage: (message: ChatMessage) => void
  clearChat: () => void

  // Loading
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void

  // Reset
  reset: () => void
}

function pushUndo(state: EditorState, blocks: Block[]): Partial<EditorState> {
  const newStack = [...state.undoStack, blocks].slice(-MAX_UNDO_STACK)
  return { undoStack: newStack, redoStack: [] }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  lessonId: null,
  blocks: [],
  markdown: '',
  undoStack: [],
  redoStack: [],
  pendingDiffs: [],
  chatMessages: [],
  isLoading: false,
  isSaving: false,

  setLessonId: (id) => set({ lessonId: id }),

  setMarkdown: (markdown) => {
    const { blocks } = parseMarkdown(markdown)
    set({ markdown, blocks })
  },

  setBlocks: (blocks) => {
    const markdown = blocksToMarkdown(blocks)
    set({ blocks, markdown })
  },

  updateBlock: (blockId, content) => {
    const state = get()
    const newBlocks = updateBlockContent(state.blocks, blockId, content)
    const markdown = blocksToMarkdown(newBlocks)
    set({
      ...pushUndo(state, state.blocks),
      blocks: newBlocks,
      markdown,
    })
  },

  addBlockAfter: (afterBlockId, type, content, level) => {
    const state = get()
    const { blocks: newBlocks } = addBlock(state.blocks, afterBlockId, type, content, level)
    const markdown = blocksToMarkdown(newBlocks)
    set({
      ...pushUndo(state, state.blocks),
      blocks: newBlocks,
      markdown,
    })
  },

  removeBlock: (blockId) => {
    const state = get()
    const newBlocks = deleteBlock(state.blocks, blockId)
    const markdown = blocksToMarkdown(newBlocks)
    set({
      ...pushUndo(state, state.blocks),
      blocks: newBlocks,
      markdown,
    })
  },

  undo: () => {
    const state = get()
    if (state.undoStack.length === 0) return

    const previous = state.undoStack[state.undoStack.length - 1]
    const newUndoStack = state.undoStack.slice(0, -1)
    const newRedoStack = [...state.redoStack, state.blocks].slice(-MAX_UNDO_STACK)

    set({
      blocks: previous,
      markdown: blocksToMarkdown(previous),
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    })
  },

  redo: () => {
    const state = get()
    if (state.redoStack.length === 0) return

    const next = state.redoStack[state.redoStack.length - 1]
    const newRedoStack = state.redoStack.slice(0, -1)
    const newUndoStack = [...state.undoStack, state.blocks].slice(-MAX_UNDO_STACK)

    set({
      blocks: next,
      markdown: blocksToMarkdown(next),
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    })
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  addPendingDiff: (diff) => {
    set(state => ({ pendingDiffs: [...state.pendingDiffs, diff] }))
  },

  setPendingDiffs: (diffs) => set({ pendingDiffs: diffs }),

  applyDiff: (diffId) => {
    const state = get()
    const diff = state.pendingDiffs.find(d => d.id === diffId)
    if (!diff) return

    let newBlocks = state.blocks

    if (diff.action === 'update') {
      newBlocks = updateBlockContent(state.blocks, diff.blockId, diff.newContent)
    } else if (diff.action === 'add') {
      try {
        const parsed = JSON.parse(diff.newContent)
        const afterId = diff.blockId === '__start__' ? null : diff.blockId
        const result = addBlock(state.blocks, afterId, parsed.type, parsed.content, parsed.level)
        newBlocks = result.blocks
      } catch {
        return
      }
    } else if (diff.action === 'delete') {
      newBlocks = deleteBlock(state.blocks, diff.blockId)
    }

    const markdown = blocksToMarkdown(newBlocks)
    set({
      ...pushUndo(state, state.blocks),
      blocks: newBlocks,
      markdown,
      pendingDiffs: state.pendingDiffs.filter(d => d.id !== diffId),
    })
  },

  rejectDiff: (diffId) => {
    set(state => ({
      pendingDiffs: state.pendingDiffs.filter(d => d.id !== diffId),
    }))
  },

  applyAllDiffs: () => {
    const state = get()
    let newBlocks = state.blocks

    for (const diff of state.pendingDiffs) {
      if (diff.action === 'update') {
        newBlocks = updateBlockContent(newBlocks, diff.blockId, diff.newContent)
      } else if (diff.action === 'add') {
        try {
          const parsed = JSON.parse(diff.newContent)
          const afterId = diff.blockId === '__start__' ? null : diff.blockId
          const result = addBlock(newBlocks, afterId, parsed.type, parsed.content, parsed.level)
          newBlocks = result.blocks
        } catch {
          continue
        }
      } else if (diff.action === 'delete') {
        newBlocks = deleteBlock(newBlocks, diff.blockId)
      }
    }

    const markdown = blocksToMarkdown(newBlocks)
    set({
      ...pushUndo(state, state.blocks),
      blocks: newBlocks,
      markdown,
      pendingDiffs: [],
    })
  },

  rejectAllDiffs: () => set({ pendingDiffs: [] }),

  addChatMessage: (message) => {
    set(state => ({ chatMessages: [...state.chatMessages, message] }))
  },

  clearChat: () => set({ chatMessages: [] }),

  setLoading: (loading) => set({ isLoading: loading }),
  setSaving: (saving) => set({ isSaving: saving }),

  reset: () => set({
    lessonId: null,
    blocks: [],
    markdown: '',
    undoStack: [],
    redoStack: [],
    pendingDiffs: [],
    chatMessages: [],
    isLoading: false,
    isSaving: false,
  }),
}))
