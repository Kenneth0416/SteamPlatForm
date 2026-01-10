'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface VditorEditorProps {
  value: string
  onChange: (markdown: string) => void
  className?: string
  placeholder?: string
}

type VditorInstance = {
  setValue: (value: string) => void
  getValue?: () => string
  destroy?: () => void
}

type VditorConstructor = new (element: string, options: Record<string, unknown>) => VditorInstance

const TOOLBAR_ITEMS: (string | string[])[] = [
  'bold',
  'italic',
  'strike',
  '|',
  'headings',
  'link',
  '|',
  'list',
  'ordered-list',
  'quote',
  'code',
  'table',
  '|',
  'undo',
  'redo',
]

export function VditorEditorInner({ value, onChange, className, placeholder }: VditorEditorProps) {
  const editorIdRef = useRef(`vditor-${Math.random().toString(36).slice(2)}`)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<VditorInstance | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestValueRef = useRef<string>(value)
  const onChangeRef = useRef(onChange)
  const isSettingValueRef = useRef(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    latestValueRef.current = value

    if (!editorRef.current) return

    const editorValue = editorRef.current.getValue?.()
    if (editorValue === value) return

    isSettingValueRef.current = true
    editorRef.current.setValue(value)
    isSettingValueRef.current = false
  }, [value])

  useEffect(() => {
    let cancelled = false

    const createEditor = async () => {
      const VditorModule = await import('vditor')
      if (cancelled || !containerRef.current) return

      const Vditor = (VditorModule as { default: VditorConstructor }).default
      const handleInput = (nextValue: string) => {
        if (isSettingValueRef.current) return
        latestValueRef.current = nextValue
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null
          onChangeRef.current?.(nextValue)
        }, 300)
      }

      const handleBlur = (nextValue: string) => {
        if (isSettingValueRef.current) return
        latestValueRef.current = nextValue
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          debounceRef.current = null
        }
        onChangeRef.current?.(nextValue)
      }

      editorRef.current = new Vditor(editorIdRef.current, {
        mode: 'wysiwyg',
        toolbar: TOOLBAR_ITEMS,
        toolbarConfig: {
          // Only show our curated toolbar and hide mode switching affordances.
          pin: true,
        },
        cache: { enable: false },
        placeholder,
        theme: 'classic',
        value: latestValueRef.current,
        input: handleInput,
        blur: handleBlur,
        // Provide no-op to prevent "customWysiwygToolbar is not a function" error
        customWysiwygToolbar: () => {},
      })
    }

    createEditor()

    return () => {
      cancelled = true
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      editorRef.current?.destroy?.()
      editorRef.current = null
    }
    // We only want to initialize once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      id={editorIdRef.current}
      data-testid="vditor-editor"
      className={cn(
        'w-full rounded-lg border border-[var(--border)] bg-[var(--vditor-surface)] text-[var(--foreground)]',
        className,
      )}
      style={{
        backgroundColor: 'var(--vditor-surface)',
        color: 'var(--foreground)',
      }}
    />
  )
}

export const VditorEditor = dynamic(
  () => Promise.resolve({ default: VditorEditorInner }),
  { ssr: false },
)

export default VditorEditor
