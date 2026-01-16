'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

// Typewriter effect hook - only starts when text is finalized
function useTypewriter(text: string, speed: number = 15, enabled: boolean = true) {
  const [displayed, setDisplayed] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const prevTextRef = useRef('')

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayed(text || '')
      setIsTyping(false)
      return
    }

    // Only start typewriter if text changed and is longer
    if (text === prevTextRef.current) return
    prevTextRef.current = text

    setIsTyping(true)
    let i = displayed.length // Continue from where we left off

    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i++
      } else {
        setIsTyping(false)
        clearInterval(timer)
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text, speed, enabled])

  return { displayed: enabled ? displayed : text, isTyping }
}

// Message component with typewriter effect
function TypewriterMessage({ content, isNew }: { content: string; isNew: boolean }) {
  const { displayed, isTyping } = useTypewriter(content, 8, isNew)

  return (
    <p className="whitespace-pre-wrap">
      {displayed}
      {isTyping && <span className="animate-pulse">|</span>}
    </p>
  )
}

export function EditorChatPanel() {
  const [input, setInput] = useState('')
  const [latestAiMsgId, setLatestAiMsgId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const {
    blocks,
    documents,
    activeDocId,
    chatMessages,
    addChatMessage,
    updateChatMessage,
    setPendingDiffs,
    addPendingDiff,
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

    addChatMessage({ id: `msg-${Date.now()}`, role: 'user', content: userMessage })
    setLoading(true)

    const aiMessageId = `msg-${Date.now()}-ai`
    addChatMessage({ id: aiMessageId, role: 'assistant', content: '' })
    setLatestAiMsgId(aiMessageId)

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    let contentBuffer = ''

    try {
      const response = await fetch('/api/editor/command/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          blocks,
          documents,
          activeDocId,
          chatHistory: chatMessages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to process command')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          console.log('[EditorChat] SSE line:', line)
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              console.log('[EditorChat] Parsed event:', event.type, event.data?.slice?.(0, 50))

              if (event.type === 'content') {
                contentBuffer += event.data
                console.log('[EditorChat] Content buffer updated, length:', contentBuffer.length)
                updateChatMessage(aiMessageId, contentBuffer)
              } else if (event.type === 'diff') {
                addPendingDiff(event.data)
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      if (!contentBuffer) {
        updateChatMessage(aiMessageId, 'Done.')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        updateChatMessage(aiMessageId, contentBuffer || '(Stopped)')
      } else {
        updateChatMessage(aiMessageId, 'Sorry, an error occurred while processing your request.')
      }
    } finally {
      abortControllerRef.current = null
      setLoading(false)
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
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
              {message.role === 'assistant' && message.id === latestAiMsgId && message.content ? (
                <TypewriterMessage content={message.content} isNew={true} />
              ) : (
                <p className="whitespace-pre-wrap">{message.content || (isLoading && message.role === 'assistant' ? '...' : '')}</p>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
          {isLoading ? (
            <Button
              onClick={handleStop}
              size="icon"
              variant="destructive"
              className="shrink-0"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!input.trim()}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
