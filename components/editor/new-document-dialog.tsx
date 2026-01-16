'use client'

import { useEffect, useState } from 'react'
import { Loader2, Presentation, FileText, ClipboardList, FilePlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { DOCUMENT_TEMPLATES, type TemplateKey } from '@/lib/editor/document-templates'
import type { Lang } from '@/types/lesson'

const ICONS = {
  Presentation,
  FileText,
  ClipboardList,
  FilePlus,
} as const

interface NewDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerate: (templateKey: TemplateKey, customName?: string, lang?: Lang) => Promise<void> | void
  lang?: Lang
  isGenerating?: boolean
}

export function NewDocumentDialog({
  open,
  onOpenChange,
  onGenerate,
  lang = 'zh',
  isGenerating = false,
}: NewDocumentDialogProps) {
  const [selected, setSelected] = useState<TemplateKey | null>(null)
  const [customName, setCustomName] = useState('')
  const [selectedLang, setSelectedLang] = useState<Lang>(lang)

  useEffect(() => {
    if (!open) {
      setSelectedLang(lang)
    }
  }, [lang, open])

  const selectedTemplate = selected ? DOCUMENT_TEMPLATES[selected] : null
  const needsName = selectedTemplate?.requiresName

  const handleGenerate = async () => {
    if (!selected) return
    if (needsName && !customName.trim()) return
    await onGenerate(selected, needsName ? customName.trim() : undefined, selectedLang)
    setSelected(null)
    setCustomName('')
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelected(null)
      setCustomName('')
    }
    onOpenChange(open)
  }

  const templates = (Object.entries(DOCUMENT_TEMPLATES) as [TemplateKey, typeof DOCUMENT_TEMPLATES[TemplateKey]][])
    .sort((a, b) => (a[0] === 'blank' ? 1 : b[0] === 'blank' ? -1 : 0))

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lang === 'en' ? 'New Document' : '新增文檔'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {lang === 'en' ? 'Language' : '語言'}
            </div>
            <RadioGroup
              value={selectedLang}
              onValueChange={(value) => setSelectedLang(value as Lang)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-2"
            >
              <Label
                htmlFor="lang-en"
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors',
                  selectedLang === 'en'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  isGenerating && 'pointer-events-none opacity-50'
                )}
              >
                <RadioGroupItem value="en" id="lang-en" disabled={isGenerating} />
                English
              </Label>
              <Label
                htmlFor="lang-zh"
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors',
                  selectedLang === 'zh'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  isGenerating && 'pointer-events-none opacity-50'
                )}
              >
                <RadioGroupItem value="zh" id="lang-zh" disabled={isGenerating} />
                {lang === 'en' ? 'Traditional Chinese' : '繁體中文'}
              </Label>
            </RadioGroup>
          </div>
          <p className="text-sm text-muted-foreground">
            {lang === 'en'
              ? 'Select document type.'
              : '選擇文檔類型。'}
          </p>
          <div className="space-y-2">
            {templates.map(([key, template]) => {
              const Icon = ICONS[template.icon]
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  disabled={isGenerating}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                    selected === key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50',
                    isGenerating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Icon className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {lang === 'en' ? template.nameEn : template.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {lang === 'en' ? template.descriptionEn : template.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          {needsName && (
            <div className="pt-2">
              <Input
                placeholder={lang === 'en' ? 'Document name' : '文檔名稱'}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                disabled={isGenerating}
                autoFocus
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isGenerating}>
            {lang === 'en' ? 'Cancel' : '取消'}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!selected || isGenerating || (needsName && !customName.trim())}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {lang === 'en' ? 'Creating...' : '創建中...'}
              </>
            ) : needsName ? (
              lang === 'en' ? 'Create' : '創建'
            ) : (
              lang === 'en' ? 'Generate' : '生成文檔'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
