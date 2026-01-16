import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { DocumentManager } from '../document-manager'
import { BlockIndexService } from '../block-index'
import { ReadWriteGuard } from './middleware'
import type { PendingDiff } from '../types'

export interface MultiDocToolContext {
  documentManager: DocumentManager
  blockIndex: BlockIndexService
  guard: ReadWriteGuard
  pendingDiffs: PendingDiff[]
  pendingDiffsByDoc: Map<string, PendingDiff[]>
  onDiffCreated?: (diff: PendingDiff) => void
  // Callback to update blockIndex when switching documents
  onDocumentSwitch?: (docId: string, blocks: import('../types').Block[]) => void
}

export function createListDocumentsTool(ctx: MultiDocToolContext) {
  return new DynamicStructuredTool({
    name: 'list_documents',
    description: 'List all open documents. Call this to see available documents before switching.',
    schema: z.object({}),
    func: async () => {
      const docs = ctx.documentManager.getAllDocuments()
      const activeId = ctx.documentManager.getActiveDocId()

      if (docs.length === 0) {
        return 'No documents open.'
      }

      const lines = docs.map(d => {
        const marker = d.id === activeId ? '→' : ' '
        const dirty = d.isDirty ? '*' : ''
        return `${marker} [${d.id}] ${d.name}${dirty} (${d.type}, ${d.blocks.length} blocks)`
      })

      return `Documents (${docs.length}):\n${lines.join('\n')}\n\n→ = active document, * = unsaved changes`
    },
  })
}

export function createSwitchDocumentTool(ctx: MultiDocToolContext) {
  return new DynamicStructuredTool({
    name: 'switch_document',
    description: 'Switch to a different document. After switching, all block operations will target the new document.',
    schema: z.object({
      docId: z.string().describe('The document ID to switch to'),
    }),
    func: async ({ docId }) => {
      const doc = ctx.documentManager.getDocument(docId)
      if (!doc) {
        const available = ctx.documentManager.getAllDocuments().map(d => d.id).join(', ')
        return `Error: Document "${docId}" not found. Available: ${available}`
      }

      const success = ctx.documentManager.setActiveDocument(docId)
      if (!success) {
        return `Error: Failed to switch to document "${docId}"`
      }

      // Reset guard for new document context
      ctx.guard.reset()

      // Update blockIndex to point to new document's blocks
      if (ctx.onDocumentSwitch) {
        ctx.onDocumentSwitch(docId, doc.blocks)
      }

      // Update pendingDiffs reference to the new document's diffs
      const docDiffs = ctx.pendingDiffsByDoc.get(docId) || []
      ctx.pendingDiffs.length = 0
      ctx.pendingDiffs.push(...docDiffs)

      return `Switched to: ${doc.name} (${doc.type}, ${doc.blocks.length} blocks)\nYou can now use list_blocks, read_blocks, edit_blocks on this document.`
    },
  })
}
