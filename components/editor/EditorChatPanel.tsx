'use client'

import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EditorChatPanel() {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    blocks,
    chatMessages,
    addChatMessage,
    setPendingDiffs,
    isLoading,
    setLoading,
  } = useEditorStore()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages])

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    const messageId = `msg-${Date.now()}`
    addChatMessage({ id: messageId, role: 'user', content: userMessage })
    setLoading(true)

    try {
      const response = await fetch('/api/editor/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          blocks,
          chatHistory: chatMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to process command')
      }

      const data = await response.json()

      addChatMessage({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.response,
      })

      if (data.pendingDiffs && data.pendingDiffs.length > 0) {
        setPendingDiffs(data.pendingDiffs)
      }
    } catch (error) {
      addChatMessage({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, an error occurred while processing your request.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="font-medium">AI Editor</h3>
        <p className="text-xs text-muted-foreground">
          Describe what changes you want to make
        </p>
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-4">
          {chatMessages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <p>Try commands like:</p>
              <ul className="mt-2 space-y-1">
                <li>"Change the title to..."</li>
                <li>"Add a new section about..."</li>
                <li>"Delete the second paragraph"</li>
              </ul>
            </div>
          )}

          {chatMessages.map(message => (
            <div
              key={message.id}
              className={cn(
                'rounded-lg p-3 text-sm',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-8'
                  : 'bg-muted mr-8'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your edit..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
