'use client'

import VditorEditor from '@/components/vditor-editor'
import { cn } from '@/lib/utils'
import type { Lang } from '@/types/lesson'

export interface WysiwygEditorProps {
  value: string
  onChange: (markdown: string) => void
  lang?: Lang
  className?: string
  placeholder?: string
}

/**
 * Thin wrapper around the shared Vditor editor to preserve the public API the rest of
 * the app consumes. The heavy lifting lives in `components/vditor-editor.tsx`.
 */
export function WysiwygEditor({ value, onChange, lang, className, placeholder }: WysiwygEditorProps) {
  return (
    <div
      data-testid="wysiwyg-editor"
      data-lang={lang}
      className={cn('border rounded-lg bg-background flex flex-col h-full', className)}
    >
      <VditorEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="min-h-[400px] flex-1"
      />
    </div>
  )
}
