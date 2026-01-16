"use client"

import { useState, useCallback } from "react"
import type { Lang } from "@/types/lesson"
import type { PendingDiff } from "@/lib/editor/types"
import { getTranslation } from "@/lib/translations"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, Eye, Edit3, Maximize2, Minimize2 } from "lucide-react"
import { MarkdownEditor } from "@/components/markdown-editor"
import { DocumentTabs } from "@/components/editor/document-tabs"
import { useEditorStore } from "@/stores/editorStore"

interface LessonPreviewProps {
  lang: Lang
  lesson: string
  isGenerating: boolean
  isDocumentStreaming?: boolean
  onLessonUpdate?: (lesson: string) => void
  pendingDiffs?: PendingDiff[]
  onApplyDiff?: (diffId: string) => void
  onRejectDiff?: (diffId: string) => void
  onApplyAllDiffs?: () => void
  onRejectAllDiffs?: () => void
  onAddDocument?: () => void
}

export function LessonPreview({ lang, lesson, isGenerating, isDocumentStreaming, onLessonUpdate, pendingDiffs, onApplyDiff, onRejectDiff, onApplyAllDiffs, onRejectAllDiffs, onAddDocument }: LessonPreviewProps) {
  const t = getTranslation(lang)
  const [isEditing, setIsEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const { documents } = useEditorStore()
  const isStreamingDocument = Boolean(isDocumentStreaming && !isGenerating)

  // Use lesson prop directly as markdown
  const markdown = lesson

  const handleMarkdownChange = useCallback((newMarkdown: string) => {
    onLessonUpdate?.(newMarkdown)
  }, [onLessonUpdate])

  if (isGenerating) {
    return (
      <Card className="h-full flex flex-col !gap-0 !py-0">
        <CardHeader className="!p-4">
          <CardTitle>{t.previewTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="absolute inset-0 h-8 w-8 animate-ping rounded-full bg-primary/20" />
          </div>
          <p className="text-muted-foreground animate-pulse">{t.generating}</p>
          <div className="flex gap-1 mt-4">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!markdown && documents.length === 0 && !isStreamingDocument) {
    return (
      <Card className="h-full flex flex-col !gap-0 !py-0">
        <CardHeader className="!p-4">
          <CardTitle>{t.previewTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-4">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <div className="text-center max-w-md">
            <h3 className="font-semibold text-lg mb-2">{t.emptyStateTitle}</h3>
            <p className="text-sm text-muted-foreground">{t.emptyStateDescription}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className="h-full flex flex-col !gap-0 !py-0 relative"
      data-document-streaming={isStreamingDocument ? "true" : "false"}
    >
      <CardHeader className="!px-4 !pt-4 !pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex flex-1 min-w-0 items-center gap-3">
          <div className="flex-1 min-w-0">
            <DocumentTabs onAddDocument={onAddDocument} />
          </div>
          {isStreamingDocument && (
            <div
              className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
              data-testid="document-streaming-indicator"
              aria-live="polite"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span className="leading-none">{t.streaming}</span>
            </div>
          )}
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-2">
        <MarkdownEditor
          value={markdown}
          onChange={handleMarkdownChange}
          isEditing={isEditing}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(false)}
          onToggleEdit={() => setIsEditing(!isEditing)}
          placeholder={lang === "en" ? "Edit your lesson plan..." : "編輯您的課程計畫..."}
          lang={lang}
          className="h-full"
          pendingDiffs={pendingDiffs}
          onApplyDiff={onApplyDiff}
          onRejectDiff={onRejectDiff}
          onApplyAllDiffs={onApplyAllDiffs}
          onRejectAllDiffs={onRejectAllDiffs}
        />
      </CardContent>
    </Card>
  )
}
