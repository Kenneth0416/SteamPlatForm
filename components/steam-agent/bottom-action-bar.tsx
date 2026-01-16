"use client"

import type { Lang, LessonRequirements } from "@/types/lesson"
import { getTranslation } from "@/lib/translations"
import { Button } from "@/components/ui/button"
import { Save, FileDown, Copy, Library, Loader2 } from "lucide-react"
import { exportLessonPdf, exportLessonWord, saveLesson } from "@/lib/api"
import { updateDocument } from "@/lib/editor/api"
import { useEditorStore } from "@/stores/editorStore"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { loadSettings } from "@/lib/settingsStorage"
import { downloadBlob } from "@/lib/download"
import { useState } from "react"

interface BottomActionBarProps {
  lang: Lang
  currentLesson: string
  currentRequirements: LessonRequirements | null
  currentLessonId?: string
  onSaveSuccess?: (id: string) => void
}

export function BottomActionBar({
  lang,
  currentLesson,
  currentRequirements,
  currentLessonId,
  onSaveSuccess,
}: BottomActionBarProps) {
  const t = getTranslation(lang)
  const { toast } = useToast()
  const router = useRouter()
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingWord, setIsExportingWord] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const hasLessonContent = Boolean(currentLesson && currentLesson.trim())
  const { documents, setDocuments } = useEditorStore()

  const sanitizeFilename = (value: string) =>
    value
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/[\\/:*?"<>|]/g, "")
      .trim()

  const inferLessonTitle = (markdown: string) => {
    const match = markdown.match(/^\s*#\s+(.+?)\s*$/m)
    const raw = match?.[1] || (lang === "en" ? "lesson" : "課程")
    const sanitized = sanitizeFilename(raw)
    return sanitized || (lang === "en" ? "lesson" : "課程")
  }

  const makeExportFilename = (markdown: string, ext: "pdf" | "docx") => {
    const title = inferLessonTitle(markdown)
    const normalized = title.replace(/\s+/g, "-").slice(0, 120)
    return `${normalized}.${ext}`
  }

  const runPdfExport = () => {
    if (!hasLessonContent || isExportingPdf || isExportingWord) return

    setIsExportingPdf(true)
    const settings = loadSettings()

    exportLessonPdf(currentLesson, "detailed", settings.includeImages)
      .then((blob) => {
        downloadBlob(blob, makeExportFilename(currentLesson, "pdf"))
      })
      .catch((error) => {
        toast({
          title: lang === "en" ? "Error" : "錯誤",
          description:
            lang === "en"
              ? (error as Error)?.message || "Failed to export PDF"
              : (error as Error)?.message || "PDF 匯出失敗",
          variant: "destructive",
        })
      })
      .finally(() => {
        setIsExportingPdf(false)
      })
  }

  const runWordExport = () => {
    if (!hasLessonContent || isExportingPdf || isExportingWord) return

    setIsExportingWord(true)
    const settings = loadSettings()

    exportLessonWord(currentLesson, "detailed", settings.includeImages)
      .then((blob) => {
        downloadBlob(blob, makeExportFilename(currentLesson, "docx"))
      })
      .catch((error) => {
        toast({
          title: lang === "en" ? "Error" : "錯誤",
          description:
            lang === "en"
              ? (error as Error)?.message || "Failed to export Word document"
              : (error as Error)?.message || "Word 匯出失敗",
          variant: "destructive",
        })
      })
      .finally(() => {
        setIsExportingWord(false)
      })
  }

  const handleSave = async () => {
    if (!currentLesson || !currentRequirements || isSaving) return

    setIsSaving(true)
    try {
      // Save lesson
      const saved = await saveLesson(currentLesson, currentRequirements, currentLessonId)

      if (saved === 'auth_required') {
        toast({
          title: lang === "en" ? "Login Required" : "需要登入",
          description: lang === "en" ? "Please login to save lessons" : "請登入以儲存課程",
          variant: "destructive",
        })
        router.push('/auth/login')
        return
      }

      if (saved && onSaveSuccess) {
        onSaveSuccess(saved.id)
      }

      // Save all dirty documents
      const dirtyDocs = documents.filter(d => d.isDirty)
      if (dirtyDocs.length > 0) {
        await Promise.all(
          dirtyDocs.map(doc => updateDocument(doc.id, { content: doc.content }))
        )
        // Mark documents as clean
        setDocuments(documents.map(d => ({ ...d, isDirty: false })))
      }

      toast({
        title: lang === "en" ? "Success" : "成功",
        description: lang === "en" ? `Lesson saved successfully!` : `課程已成功儲存！`,
      })
    } catch (error) {
      toast({
        title: lang === "en" ? "Error" : "錯誤",
        description: lang === "en" ? "Failed to save" : "儲存失敗",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDuplicate = () => {
    // TODO: implement lesson duplication
    console.log("[v0] Duplicate lesson:", currentLesson)
    toast({
      title: lang === "en" ? "Coming Soon" : "即將推出",
      description: lang === "en" ? "Duplicate functionality coming soon!" : "複製功能即將推出！",
    })
  }

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <Button asChild variant="outline" size="sm">
            <Link href="/library">
              <Library className="h-4 w-4 mr-2" />
              {t.library.myLessons}
            </Link>
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={!currentLesson || isSaving} variant="default" size="sm">
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t.save}
            </Button>
            <Button
              onClick={runPdfExport}
              disabled={!hasLessonContent || isExportingPdf || isExportingWord}
              variant="outline"
              size="sm"
            >
              {isExportingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {t.exportPdf}
            </Button>
            <Button
              onClick={runWordExport}
              disabled={!hasLessonContent || isExportingPdf || isExportingWord}
              variant="outline"
              size="sm"
            >
              {isExportingWord ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {t.exportWord}
            </Button>
            <Button onClick={handleDuplicate} disabled={!currentLesson} variant="outline" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              {t.duplicate}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
