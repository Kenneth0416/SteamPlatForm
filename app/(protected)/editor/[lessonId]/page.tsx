'use client'

import { useEffect, useState, use } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { EditorChatPanel } from '@/components/editor/EditorChatPanel'
import { DiffViewer } from '@/components/editor/DiffViewer'
import { DocumentTabs } from '@/components/editor/document-tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Undo2, Redo2, Save, Loader2, History, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { fetchDocuments, createDocument } from '@/lib/editor/api'
import type { EditorDocument } from '@/lib/editor/types'
import { useAutoSave } from '@/hooks/useAutoSave'

interface PageProps {
  params: Promise<{ lessonId: string }>
}

export default function EditorPage({ params }: PageProps) {
  const { lessonId } = use(params)
  const [isInitialized, setIsInitialized] = useState(false)

  const {
    markdown,
    blocks,
    pendingDiffs,
    documents,
    activeDocId,
    streamingDocId,
    setLessonId,
    setMarkdown,
    setDocuments,
    addDocument,
    updateDocumentContent,
    undo,
    redo,
    canUndo,
    canRedo,
    applyDiff,
    rejectDiff,
    applyAllDiffs,
    rejectAllDiffs,
    isSaving,
    setSaving,
    reset,
  } = useEditorStore()

  useAutoSave({
    currentLesson: markdown,
    currentRequirements: null,
    currentLessonId: lessonId,
    streamingDocId,
    enabled: isInitialized,
  })

  useEffect(() => {
    reset()
    setLessonId(lessonId)
    loadLesson()
    return () => reset()
  }, [lessonId])

  const loadLesson = async () => {
    try {
      // Load existing documents from DB
      const docs = await fetchDocuments(lessonId)

      if (docs.length > 0) {
        setDocuments(docs)
      } else {
        // Fallback: load lesson plan as first document
        const response = await fetch(`/api/lessons/${lessonId}`)
        if (!response.ok) throw new Error('Failed to load lesson')

        const lesson = await response.json()
        const content = typeof lesson.lessonPlan === 'string'
          ? lesson.lessonPlan
          : JSON.stringify(lesson.lessonPlan, null, 2)

        // Create initial document
        const doc = await createDocument(lessonId, 'Lesson Plan', 'lesson', content)
        setDocuments([doc])
      }
      setIsInitialized(true)
    } catch (error) {
      toast.error('Failed to load lesson')
    }
  }

  const handleAddDocument = async () => {
    const name = prompt('Document name:')
    if (!name) return
    try {
      const doc = await createDocument(lessonId, name, 'custom', '')
      addDocument(doc)
    } catch {
      toast.error('Failed to create document')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Create version before saving
      await fetch('/api/editor/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          blocks,
          summary: 'Manual save',
        }),
      })

      // Update lesson - 使用 PUT 方法（API 不支持 PATCH）
      await fetch(`/api/lessons/${lessonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown,  // 使用 markdown 而不是 lessonPlan
          lessonPlan: { markdown }  // 兼容旧格式
        }),
      })

      toast.success('Saved successfully')
    } catch (error) {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleApplyDiff = async (diffId: string) => {
    applyDiff(diffId)
    // Auto-save version after applying diff
    const state = useEditorStore.getState()
    try {
      await fetch('/api/editor/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          blocks: state.blocks,
          summary: 'Applied AI edit',
        }),
      })
    } catch {
      // Silent fail for version creation
    }
  }

  const handleApplyAll = async () => {
    applyAllDiffs()
    const state = useEditorStore.getState()
    try {
      await fetch('/api/editor/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          blocks: state.blocks,
          summary: 'Applied all AI edits',
        }),
      })
    } catch {
      // Silent fail
    }
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Document Tabs */}
      <DocumentTabs onAddDocument={handleAddDocument} />

      {/* Toolbar */}
      <div className="border-b p-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={!canUndo()}
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={!canRedo()}
          title="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(`/api/editor/history?lessonId=${lessonId}`, '_blank')}
          title="Version History"
        >
          <History className="h-4 w-4 mr-1" />
          History
        </Button>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Save
        </Button>
      </div>

      {/* Main content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Editor panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col">
            <div className="p-2 border-b text-sm font-medium">
              Document ({blocks.length} blocks)
            </div>
            <ScrollArea className="flex-1">
              <Textarea
                value={markdown}
                onChange={e => {
                  setMarkdown(e.target.value)
                  if (activeDocId) updateDocumentContent(activeDocId, e.target.value)
                }}
                className="min-h-full border-0 rounded-none resize-none font-mono text-sm"
                placeholder="Enter markdown content..."
              />
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Diff panel */}
        <ResizablePanel defaultSize={25} minSize={20}>
          <div className="h-full flex flex-col">
            <div className="p-2 border-b text-sm font-medium">
              Pending Changes ({pendingDiffs.length})
            </div>
            <ScrollArea className="flex-1 p-3">
              <DiffViewer
                diffs={pendingDiffs}
                onApply={handleApplyDiff}
                onReject={rejectDiff}
                onApplyAll={handleApplyAll}
                onRejectAll={rejectAllDiffs}
              />
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Chat panel */}
        <ResizablePanel defaultSize={25} minSize={20}>
          <EditorChatPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
