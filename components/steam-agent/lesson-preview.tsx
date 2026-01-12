"use client"

import { useState, useEffect, useCallback } from "react"
import type { Lang } from "@/types/lesson"
import type { PendingDiff } from "@/lib/editor/types"
import { getTranslation } from "@/lib/translations"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, Eye, Edit3, Maximize2, Minimize2 } from "lucide-react"
import { MarkdownEditor } from "@/components/markdown-editor"

interface LessonPreviewProps {
  lang: Lang
  lesson: string
  isGenerating: boolean
  onLessonUpdate?: (lesson: string) => void
  pendingDiffs?: PendingDiff[]
  onApplyDiff?: (diffId: string) => void
  onRejectDiff?: (diffId: string) => void
  onApplyAllDiffs?: () => void
  onRejectAllDiffs?: () => void
}

export function LessonPreview({ lang, lesson, isGenerating, onLessonUpdate, pendingDiffs, onApplyDiff, onRejectDiff, onApplyAllDiffs, onRejectAllDiffs }: LessonPreviewProps) {
  const t = getTranslation(lang)
  const [isStreaming, setIsStreaming] = useState(false)
  const [markdown, setMarkdown] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (lesson && lesson.trim() && !isGenerating) {
      setIsStreaming(true)
      const timer = setTimeout(() => {
        setMarkdown(lesson)
        setIsStreaming(false)
      }, 500)
      return () => clearTimeout(timer)
    } else if (!lesson) {
      setMarkdown("")
      setIsStreaming(false)
    }
  }, [lesson, isGenerating])

  const handleMarkdownChange = useCallback((newMarkdown: string) => {
    setMarkdown(newMarkdown)
    onLessonUpdate?.(newMarkdown)
  }, [onLessonUpdate])

  if (isGenerating) {
    return (
      <Card className="h-full flex flex-col !gap-0 !py-0">
        <CardHeader className="!px-8 !pt-8 !pb-4">
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

  if (isStreaming) {
    return (
      <Card className="h-full flex flex-col !gap-0 !py-0">
        <CardHeader className="!px-8 !pt-8 !pb-4">
          <CardTitle>{t.previewTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {lang === "en" ? "Rendering lesson plan..." : "渲染課程計畫..."}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!markdown) {
    return (
      <Card className="h-full flex flex-col !gap-0 !py-0">
        <CardHeader className="!px-8 !pt-8 !pb-4">
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
    <Card className="h-full flex flex-col !gap-0 !py-0">
      <CardHeader className="!px-8 !pt-8 !pb-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle>{t.previewTitle}</CardTitle>
        <div className="flex gap-1">
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
