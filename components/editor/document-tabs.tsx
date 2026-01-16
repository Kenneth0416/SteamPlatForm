'use client'

import { useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { deleteDocument } from '@/lib/editor/api'
import { cn } from '@/lib/utils'
import { Trash2, Plus, FileText } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DocumentTabsProps {
  onAddDocument?: () => void
}

export function DocumentTabs({ onAddDocument }: DocumentTabsProps) {
  const { documents, activeDocId, switchDocument, removeDocument } = useEditorStore()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteDocument(deleteTarget.id)
      removeDocument(deleteTarget.id)
    } catch {
      // Silent fail
    }
    setDeleteTarget(null)
  }

  return (
    <>
      <div className="flex items-center bg-muted rounded-lg p-1 min-w-0 overflow-hidden">
        {/* Scrollable tabs container with padding for shadow */}
        <div className="flex-1 overflow-x-auto scrollbar-none min-w-0 px-0.5 -mx-0.5">
          <div className="flex items-center gap-1 py-0.5">
            {documents.length === 0 ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-background rounded-md shadow-sm hover:bg-accent transition-colors cursor-default whitespace-nowrap">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>Lesson Plan</span>
              </div>
            ) : (
              documents.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => switchDocument(doc.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap shrink-0',
                    activeDocId === doc.id
                      ? 'bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[100px] truncate">
                    {doc.name}
                  </span>
                  {doc.isDirty && <span className="text-primary">•</span>}
                  {documents.length > 1 && (
                    <Trash2
                      className="h-3 w-3 ml-0.5 opacity-60 hover:opacity-100 hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget({ id: doc.id, name: doc.name })
                      }}
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
        {/* Fixed add button */}
        {onAddDocument && (
          <button
            onClick={onAddDocument}
            className="p-1.5 rounded-md hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-1"
            title="Add document"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除文檔</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deleteTarget?.name}」嗎？此操作不可復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
