import { create } from 'zustand'
import type { Block, PendingDiff, BlockType, EditorDocument } from '@/lib/editor/types'
import { parseMarkdown, blocksToMarkdown, updateBlockContent, addBlock, deleteBlock } from '@/lib/editor/parser'

const MAX_UNDO_STACK = 20
export const DOCUMENT_SWITCH_LOCK_TIMEOUT_MS = 2000

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface EditorState {
  // Multi-document state
  documents: EditorDocument[]
  activeDocId: string | null
  pendingDiffsByDoc: Map<string, PendingDiff[]>
  streamingDocId: string | null  // Track which document is being streamed
  isDocumentSwitchLocked: boolean

  // Document state (active document)
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
  updateChatMessage: (id: string, content: string) => void
  clearChat: () => void

  // Loading
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void

  // Multi-document actions
  setDocuments: (docs: EditorDocument[]) => void
  addDocument: (doc: EditorDocument) => void
  removeDocument: (docId: string) => void
  switchDocument: (docId: string) => void
  withDocumentSwitchLock: (operation: () => void | Promise<void>) => Promise<void>
  updateDocumentContent: (docId: string, content: string) => void
  appendDocumentContent: (docId: string, content: string) => void
  markDocumentsClean: (docIds: string[]) => void
  setStreamingDocId: (docId: string | null) => void
  getActiveDocument: () => EditorDocument | null

  // Reset
  reset: () => void
}

function pushUndo(state: EditorState, blocks: Block[]): Partial<EditorState> {
  const newStack = [...state.undoStack, blocks].slice(-MAX_UNDO_STACK)
  return { undoStack: newStack, redoStack: [] }
}

function syncActiveDoc(state: EditorState, newBlocks: Block[], newMarkdown: string): Partial<EditorState> {
  if (!state.activeDocId) return {}
  return {
    documents: state.documents.map(d =>
      d.id === state.activeDocId
        ? { ...d, content: newMarkdown, blocks: newBlocks, isDirty: true }
        : d
    ),
  }
}

export const useEditorStore = create<EditorState>((set, get) => {
  const documentSwitchLock = {
    locked: false,
    queue: [] as Array<() => void>,
    timer: null as ReturnType<typeof setTimeout> | null,
  }

  const releaseDocumentSwitchLock = () => {
    if (documentSwitchLock.timer) {
      clearTimeout(documentSwitchLock.timer)
      documentSwitchLock.timer = null
    }
    documentSwitchLock.locked = false
    set({ isDocumentSwitchLocked: false })
    const next = documentSwitchLock.queue.shift()
    if (next) next()
  }

  const withDocumentSwitchLock = (operation: () => void | Promise<void>) => (
    new Promise<void>((resolve) => {
      const execute = () => {
        let finished = false
        const finalize = () => {
          if (finished) return
          finished = true
          releaseDocumentSwitchLock()
          resolve()
        }

        documentSwitchLock.locked = true
        set({ isDocumentSwitchLocked: true })
        documentSwitchLock.timer = setTimeout(() => {
          finalize()
        }, DOCUMENT_SWITCH_LOCK_TIMEOUT_MS)

        let result: void | Promise<void>
        try {
          result = operation()
        } catch {
          result = undefined
        }

        Promise.resolve(result)
          .catch(() => {})
          .finally(() => {
            finalize()
          })
      }

      if (documentSwitchLock.locked) {
        documentSwitchLock.queue.push(execute)
      } else {
        execute()
      }
    })
  )

  const clearDocumentSwitchLock = () => {
    if (documentSwitchLock.timer) {
      clearTimeout(documentSwitchLock.timer)
      documentSwitchLock.timer = null
    }
    documentSwitchLock.queue = []
    documentSwitchLock.locked = false
    set({ isDocumentSwitchLocked: false })
  }

  return {
    documents: [],
    activeDocId: null,
    pendingDiffsByDoc: new Map(),
    streamingDocId: null,
    isDocumentSwitchLocked: false,
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
      ...syncActiveDoc(state, newBlocks, markdown),
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
      ...syncActiveDoc(state, newBlocks, markdown),
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
      ...syncActiveDoc(state, newBlocks, markdown),
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
    const newPendingDiffs = state.pendingDiffs.filter(d => d.id !== diffId)
    const newMap = new Map(state.pendingDiffsByDoc)
    if (state.activeDocId) newMap.set(state.activeDocId, newPendingDiffs)
    set({
      ...pushUndo(state, state.blocks),
      blocks: newBlocks,
      markdown,
      pendingDiffs: newPendingDiffs,
      pendingDiffsByDoc: newMap,
    })
  },

  rejectDiff: (diffId) => {
    set(state => {
      const newPendingDiffs = state.pendingDiffs.filter(d => d.id !== diffId)
      const newMap = new Map(state.pendingDiffsByDoc)
      if (state.activeDocId) newMap.set(state.activeDocId, newPendingDiffs)
      return {
        pendingDiffs: newPendingDiffs,
        pendingDiffsByDoc: newMap,
      }
    })
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
    const newMap = new Map(state.pendingDiffsByDoc)
    if (state.activeDocId) newMap.set(state.activeDocId, [])
    set({
      ...pushUndo(state, state.blocks),
      blocks: newBlocks,
      markdown,
      pendingDiffs: [],
      pendingDiffsByDoc: newMap,
    })
  },

  rejectAllDiffs: () => {
    set(state => {
      const newMap = new Map(state.pendingDiffsByDoc)
      if (state.activeDocId) newMap.set(state.activeDocId, [])
      return {
        pendingDiffs: [],
        pendingDiffsByDoc: newMap,
      }
    })
  },

  addChatMessage: (message) => {
    set(state => ({ chatMessages: [...state.chatMessages, message] }))
  },

  updateChatMessage: (id, content) => {
    set(state => ({
      chatMessages: state.chatMessages.map(m =>
        m.id === id ? { ...m, content } : m
      ),
    }))
  },

  clearChat: () => set({ chatMessages: [] }),

  setLoading: (loading) => set({ isLoading: loading }),
  setSaving: (saving) => set({ isSaving: saving }),

  setDocuments: (docs) => {
    const diffMap = new Map<string, PendingDiff[]>()
    docs.forEach(d => diffMap.set(d.id, []))
    const activeId = docs.length > 0 ? docs[0].id : null
    const activeDoc = docs.find(d => d.id === activeId)
    set({
      documents: docs,
      activeDocId: activeId,
      pendingDiffsByDoc: diffMap,
      blocks: activeDoc?.blocks || [],
      markdown: activeDoc?.content || '',
    })
  },

  addDocument: (doc) => {
    set(state => {
      const newDocs = [...state.documents, doc]
      const newMap = new Map(state.pendingDiffsByDoc)
      newMap.set(doc.id, [])
      // Always activate new document
      return {
        documents: newDocs,
        pendingDiffsByDoc: newMap,
        activeDocId: doc.id,
        blocks: doc.blocks,
        markdown: doc.content,
        undoStack: [],
        redoStack: [],
      }
    })
  },

  removeDocument: (docId) => {
    get().withDocumentSwitchLock(() => {
      set(state => {
        const newDocs = state.documents.filter(d => d.id !== docId)
        const newMap = new Map(state.pendingDiffsByDoc)
        newMap.delete(docId)
        const newActiveId = state.activeDocId === docId
          ? (newDocs[0]?.id || null)
          : state.activeDocId
        const activeDoc = newDocs.find(d => d.id === newActiveId)
        return {
          documents: newDocs,
          activeDocId: newActiveId,
          pendingDiffsByDoc: newMap,
          blocks: activeDoc?.blocks || [],
          markdown: activeDoc?.content || '',
        }
      })
    })
  },

  switchDocument: (docId) => {
    get().withDocumentSwitchLock(() => {
      const state = get()
      if (docId === state.activeDocId) return
      const doc = state.documents.find(d => d.id === docId)
      if (!doc) return

      // Save current document state before switching (only mark dirty if content changed)
      const updatedDocs = state.activeDocId
        ? state.documents.map(d => {
            if (d.id !== state.activeDocId) return d
            const contentChanged = d.content !== state.markdown
            return contentChanged
              ? { ...d, content: state.markdown, blocks: state.blocks, isDirty: true }
              : d
          })
        : state.documents

      const targetDoc = updatedDocs.find(d => d.id === docId)!
      const diffs = state.pendingDiffsByDoc.get(docId) || []
      set({
        documents: updatedDocs,
        activeDocId: docId,
        blocks: targetDoc.blocks,
        markdown: targetDoc.content,
        pendingDiffs: diffs,
        undoStack: [],
        redoStack: [],
      })
    })
  },

  withDocumentSwitchLock,

  updateDocumentContent: (docId, content) => {
    set(state => {
      const { blocks } = parseMarkdown(content)
      const newDocs = state.documents.map(d =>
        d.id === docId ? { ...d, content, blocks, isDirty: true } : d
      )
      const isActive = state.activeDocId === docId
      return {
        documents: newDocs,
        ...(isActive && { blocks, markdown: content }),
      }
    })
  },

  appendDocumentContent: (docId, content) => {
    set(state => {
      const doc = state.documents.find(d => d.id === docId)
      if (!doc) return state
      const newContent = doc.content + content
      const { blocks } = parseMarkdown(newContent)
      const newDocs = state.documents.map(d =>
        d.id === docId ? { ...d, content: newContent, blocks, isDirty: true } : d
      )
      const isActive = state.activeDocId === docId
      return {
        documents: newDocs,
        ...(isActive && { blocks, markdown: newContent }),
      }
    })
  },

  markDocumentsClean: (docIds) => {
    if (docIds.length === 0) return
    set(state => ({
      documents: state.documents.map(doc =>
        docIds.includes(doc.id) ? { ...doc, isDirty: false } : doc
      ),
    }))
  },

  setStreamingDocId: (docId) => set({ streamingDocId: docId }),

  getActiveDocument: () => {
    const state = get()
    return state.documents.find(d => d.id === state.activeDocId) || null
  },

  reset: () => {
    clearDocumentSwitchLock()
    set({
      documents: [],
      activeDocId: null,
      pendingDiffsByDoc: new Map(),
      streamingDocId: null,
      isDocumentSwitchLocked: false,
      lessonId: null,
      blocks: [],
      markdown: '',
      undoStack: [],
      redoStack: [],
      pendingDiffs: [],
      chatMessages: [],
      isLoading: false,
      isSaving: false,
    })
  },
  }
})
