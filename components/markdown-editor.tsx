"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { MermaidDiagram } from "@/components/mermaid-diagram"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Minimize2, Eye, Edit3, Check, X, CheckCheck, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WysiwygEditor } from "@/components/wysiwyg-editor"
import type { Lang } from "@/types/lesson"
import type { PendingDiff } from "@/lib/editor/types"
import { generateWordDiff } from "@/lib/editor/diff"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  isEditing: boolean
  isExpanded: boolean
  onToggleExpand?: () => void
  onToggleEdit?: () => void
  className?: string
  placeholder?: string
  lang?: Lang
  pendingDiffs?: PendingDiff[]
  onApplyDiff?: (diffId: string) => void
  onRejectDiff?: (diffId: string) => void
  onApplyAllDiffs?: () => void
  onRejectAllDiffs?: () => void
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border-b pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left text-xl font-semibold mt-6 mb-3 hover:text-primary transition-colors"
      >
        {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        {title}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function DiffHighlightPanel({
  diffs,
  onApply,
  onReject,
  onApplyAll,
  onRejectAll
}: {
  diffs: PendingDiff[]
  onApply?: (diffId: string) => void
  onReject?: (diffId: string) => void
  onApplyAll?: () => void
  onRejectAll?: () => void
}) {
  if (diffs.length === 0) return null

  return (
    <div className="mb-4 p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-muted-foreground">
          Pending Changes ({diffs.length})
        </div>
        {diffs.length > 1 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onRejectAll}>
              <XCircle className="h-3 w-3 mr-1" />
              Reject All
            </Button>
            <Button size="sm" onClick={onApplyAll}>
              <CheckCheck className="h-3 w-3 mr-1" />
              Apply All
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {diffs.map((diff) => (
          <div key={diff.id} className="text-sm border rounded p-2 bg-background">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">
                {diff.action === 'update' ? 'Edit' : diff.action === 'add' ? 'Add' : 'Delete'} - {diff.reason}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onReject?.(diff.id)}>
                  <X className="h-3 w-3 text-red-500" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onApply?.(diff.id)}>
                  <Check className="h-3 w-3 text-green-500" />
                </Button>
              </div>
            </div>
            {diff.action === 'delete' ? (
              <div className="bg-red-100 dark:bg-red-900/30 p-1 rounded">
                <span className="text-red-800 dark:text-red-300 line-through">{diff.oldContent}</span>
              </div>
            ) : diff.action === 'add' ? (
              <div className="bg-green-100 dark:bg-green-900/30 p-1 rounded">
                <span className="text-green-800 dark:text-green-300">
                  {(() => {
                    try {
                      const parsed = JSON.parse(diff.newContent)
                      return parsed.content
                    } catch {
                      return diff.newContent
                    }
                  })()}
                </span>
              </div>
            ) : (
              <div className="font-mono text-xs whitespace-pre-wrap">
                {generateWordDiff(diff.oldContent, diff.newContent).map((change, i) => (
                  <span
                    key={i}
                    className={cn(
                      change.type === 'add' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                      change.type === 'remove' && 'bg-red-100 text-red-800 line-through dark:bg-red-900/30 dark:text-red-300'
                    )}
                  >
                    {change.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface H1Group {
  title: string
  headerContent: string
  sections: { title: string; content: string }[]
}

export function MarkdownEditor({ value, onChange, isEditing, isExpanded, onToggleExpand, onToggleEdit, className, placeholder, lang = 'en', pendingDiffs, onApplyDiff, onRejectDiff, onApplyAllDiffs, onRejectAllDiffs }: MarkdownEditorProps) {
  const [sections, setSections] = useState<{ title: string; content: string }[]>([])
  const [header, setHeader] = useState("")
  const [h1Groups, setH1Groups] = useState<H1Group[]>([])
  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Parse markdown into sections with H1 support (skip in edit mode, debounce for streaming)
  useEffect(() => {
    if (isEditing) return
    if (!value || !value.trim()) {
      setHeader("")
      setSections([])
      setH1Groups([])
      return
    }

    // Debounce parsing to avoid excessive updates during streaming
    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current)
    }
    parseTimeoutRef.current = setTimeout(() => {
      const lines = value.split("\n")
    const groups: H1Group[] = []
    let globalHeader: string[] = []
    let currentH1: H1Group | null = null
    let currentH2: { title: string; content: string[] } | null = null
    let h1HeaderLines: string[] = []

    for (const line of lines) {
      // Check for H1 (but not H2)
      if (line.startsWith("# ") && !line.startsWith("## ")) {
        // Save previous H2 if exists
        if (currentH2 && currentH1) {
          currentH1.sections.push({ title: currentH2.title, content: currentH2.content.join("\n") })
          currentH2 = null
        }
        // Save previous H1 if exists
        if (currentH1) {
          currentH1.headerContent = h1HeaderLines.join("\n")
          groups.push(currentH1)
        }
        currentH1 = { title: line.slice(2), headerContent: "", sections: [] }
        h1HeaderLines = []
      } else if (line.startsWith("## ")) {
        // Save previous H2 if exists
        if (currentH2 && currentH1) {
          currentH1.sections.push({ title: currentH2.title, content: currentH2.content.join("\n") })
        } else if (currentH1) {
          currentH1.headerContent = h1HeaderLines.join("\n")
          h1HeaderLines = []
        }
        currentH2 = { title: line.slice(3), content: [] }
      } else if (currentH2) {
        currentH2.content.push(line)
      } else if (currentH1) {
        h1HeaderLines.push(line)
      } else {
        globalHeader.push(line)
      }
    }

    // Finalize last H2 and H1
    if (currentH2 && currentH1) {
      currentH1.sections.push({ title: currentH2.title, content: currentH2.content.join("\n") })
    } else if (currentH1 && h1HeaderLines.length > 0) {
      currentH1.headerContent = h1HeaderLines.join("\n")
    }
    if (currentH1) {
      groups.push(currentH1)
    }

    // If we have H1 groups, use the new structure
    if (groups.length > 0) {
      setHeader(globalHeader.join("\n"))
      setH1Groups(groups)
      setSections([])
    } else {
      // Fallback to old H2-only parsing for backward compatibility
      const parsed: { title: string; content: string }[] = []
      let headerLines: string[] = []
      let currentSection: { title: string; content: string[] } | null = null

      for (const line of lines) {
        if (line.startsWith("## ")) {
          if (currentSection) {
            parsed.push({ title: currentSection.title, content: currentSection.content.join("\n") })
          } else {
            setHeader(headerLines.join("\n"))
          }
          currentSection = { title: line.slice(3), content: [] }
        } else if (currentSection) {
          currentSection.content.push(line)
        } else {
          headerLines.push(line)
        }
      }
      if (currentSection) {
        parsed.push({ title: currentSection.title, content: currentSection.content.join("\n") })
      } else {
        setHeader(headerLines.join("\n"))
      }
      setSections(parsed)
      setH1Groups([])
    }
    }, 100) // 100ms debounce

    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current)
      }
    }
  }, [value, isEditing])

  const markdownComponents = useMemo(() => ({
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>,
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-3 text-sm leading-relaxed">{children}</p>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside mb-3 space-y-1 text-sm">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-sm">{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li className="text-muted-foreground">{children}</li>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>,
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      const match = /language-(\w+)/.exec(className || "")
      if (match?.[1] === "mermaid") {
        return <MermaidDiagram chart={String(children).trim()} />
      }
      return <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
    },
    pre: ({ children }: { children?: React.ReactNode }) => {
      const child = children as React.ReactElement<{ className?: string }>
      if (child?.props?.className?.includes("language-mermaid")) {
        return <div className="my-4 bg-muted/50 rounded-lg p-4">{children}</div>
      }
      return <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-3 text-xs">{children}</pre>
    },
  }), [])

  return (
    <div className={cn("relative flex flex-col h-full", isExpanded && "fixed inset-4 z-50 bg-background rounded-lg shadow-2xl border", className)}>
      {isExpanded && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {onToggleExpand && (
            <Button
              aria-label="Collapse editor"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleExpand}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          )}
          {onToggleEdit && (
            <Button
              aria-label={isEditing ? "View preview" : "Edit content"}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onMouseDown={(e) => {
                e.preventDefault()
                onToggleEdit()
              }}
            >
              {isEditing ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      )}
      {isEditing ? (
        <WysiwygEditor
          value={value}
          onChange={onChange}
          lang={lang}
          placeholder={placeholder}
          className={cn(isExpanded && "h-full")}
        />
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="pb-16">
            {pendingDiffs && pendingDiffs.length > 0 && (
              <DiffHighlightPanel
                diffs={pendingDiffs}
                onApply={onApplyDiff}
                onReject={onRejectDiff}
                onApplyAll={onApplyAllDiffs}
                onRejectAll={onRejectAllDiffs}
              />
            )}
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
              {header}
            </ReactMarkdown>
            {h1Groups.length > 0 ? (
              h1Groups.map((group, gi) => (
                <CollapsibleSection key={`h1-${gi}`} title={group.title} defaultOpen={gi < 2}>
                  {group.headerContent && (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                      {group.headerContent}
                    </ReactMarkdown>
                  )}
                  {group.sections.map((section, si) => (
                    <CollapsibleSection key={`h2-${gi}-${si}`} title={section.title} defaultOpen={false}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                        {section.content}
                      </ReactMarkdown>
                    </CollapsibleSection>
                  ))}
                </CollapsibleSection>
              ))
            ) : (
              sections.map((section, i) => (
                <CollapsibleSection key={i} title={section.title} defaultOpen={false}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                    {section.content}
                  </ReactMarkdown>
                </CollapsibleSection>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
