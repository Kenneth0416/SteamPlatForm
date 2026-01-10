"use client"

import type { Lang, LessonRequirements } from "@/types/lesson"
import type { PdfTemplate, WordTemplate } from "@/types/settings"
import { getTranslation } from "@/lib/translations"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Save, FileDown, Copy, Library, Loader2, ChevronDown } from "lucide-react"
import { exportLessonPdf, exportLessonWord, saveLesson } from "@/lib/api"
import Link from "next/link"
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
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingWord, setIsExportingWord] = useState(false)
  const hasLessonContent = Boolean(currentLesson && currentLesson.trim())

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

  const runPdfExport = (template: PdfTemplate) => {
    if (!hasLessonContent || isExportingPdf || isExportingWord) return

    setIsExportingPdf(true)
    const settings = loadSettings()

    exportLessonPdf(currentLesson, template, settings.includeImages)
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

  const runWordExport = (template: WordTemplate) => {
    if (!hasLessonContent || isExportingPdf || isExportingWord) return

    setIsExportingWord(true)
    const settings = loadSettings()

    exportLessonWord(currentLesson, template, settings.includeImages)
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
    if (!currentLesson || !currentRequirements) return

    const saved = await saveLesson(currentLesson, currentRequirements, currentLessonId)

    if (saved && onSaveSuccess) {
      onSaveSuccess(saved.id)
    }

    toast({
      title: lang === "en" ? "Success" : "成功",
      description: lang === "en" ? `Lesson saved successfully!` : `課程已成功儲存！`,
    })
  }

  const handleExportPdf = () => {
    const settings = loadSettings()
    runPdfExport(settings.exportPdfTemplate)
  }

  const handleExportWord = () => {
    const settings = loadSettings()
    runWordExport(settings.exportWordTemplate)
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
            <Button onClick={handleSave} disabled={!currentLesson} variant="default" size="sm">
              <Save className="h-4 w-4 mr-2" />
              {t.save}
            </Button>
            <DropdownMenu>
              <div className="inline-flex">
                <Button
                  onClick={handleExportPdf}
                  disabled={!hasLessonContent || isExportingPdf || isExportingWord}
                  variant="outline"
                  size="sm"
                  className="rounded-r-none"
                >
                  {isExportingPdf ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  {t.exportPdf}
                </Button>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={!hasLessonContent || isExportingPdf || isExportingWord}
                    variant="outline"
                    size="sm"
                    className="rounded-l-none border-l-0 px-2"
                    aria-label={lang === "en" ? "PDF template options" : "PDF 模板選項"}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </div>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => runPdfExport("standard")}>
                  {t.settings.templateStandard}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => runPdfExport("detailed")}>
                  {t.settings.templateDetailed}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => runPdfExport("minimal")}>
                  {t.settings.templateMinimal}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <div className="inline-flex">
                <Button
                  onClick={handleExportWord}
                  disabled={!hasLessonContent || isExportingPdf || isExportingWord}
                  variant="outline"
                  size="sm"
                  className="rounded-r-none"
                >
                  {isExportingWord ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  {t.exportWord}
                </Button>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={!hasLessonContent || isExportingPdf || isExportingWord}
                    variant="outline"
                    size="sm"
                    className="rounded-l-none border-l-0 px-2"
                    aria-label={lang === "en" ? "Word template options" : "Word 模板選項"}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </div>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => runWordExport("standard")}>
                  {t.settings.templateStandard}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => runWordExport("detailed")}>
                  {t.settings.templateDetailed}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
