"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface ChatMarkdownProps {
  content: string
  className?: string
}

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        h1: ({ children }) => <h1 className="text-xl font-bold my-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold my-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-bold my-1">{children}</h3>,
        p: ({ children }) => <p className="my-1">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 my-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 my-1">{children}</ol>,
        li: ({ children }) => <li className="my-0.5">{children}</li>,
        pre: ({ children }) => <pre className="bg-muted p-2 rounded overflow-x-auto my-2 text-sm">{children}</pre>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-")
          return isBlock 
            ? <code className={className}>{children}</code>
            : <code className="bg-muted px-1 rounded text-sm">{children}</code>
        },
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {children}
          </a>
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
