"use client"

import { useEffect, useState, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { MermaidDiagram } from "@/components/mermaid-diagram"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Minimize2, Eye, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WysiwygEditor } from "@/components/wysiwyg-editor"
import type { Lang } from "@/types/lesson"

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

export function MarkdownEditor({ value, onChange, isEditing, isExpanded, onToggleExpand, onToggleEdit, className, placeholder, lang = 'en' }: MarkdownEditorProps) {
  const [sections, setSections] = useState<{ title: string; content: string }[]>([])
  const [header, setHeader] = useState("")

  // Parse markdown into sections
  useEffect(() => {
    const lines = value.split("\n")
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
    }
    setSections(parsed)
  }, [value])

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
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
              {header}
            </ReactMarkdown>
            {sections.map((section, i) => (
              <CollapsibleSection key={i} title={section.title} defaultOpen={i < 3}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                  {section.content}
                </ReactMarkdown>
              </CollapsibleSection>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
