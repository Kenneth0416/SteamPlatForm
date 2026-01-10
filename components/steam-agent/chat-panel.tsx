"use client"

import { useState, useRef, useEffect } from "react"
import type { Lang, ChatMessage } from "@/types/lesson"
import { getTranslation } from "@/lib/translations"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, User, Bot, ArrowLeft, Loader2, Wrench, ArrowDown } from "lucide-react"
import { ChatMarkdown } from "./chat-markdown"

interface ChatPanelProps {
  lang: Lang
  currentLesson: string
  onLessonUpdate: (lesson: string) => void
  onBackToForm?: () => void
  isGenerating?: boolean
  initialMessages?: ChatMessage[]
  onMessagesChange?: (messages: ChatMessage[]) => void
}

export function ChatPanel({ lang, currentLesson, onLessonUpdate, onBackToForm, isGenerating, initialMessages, onMessagesChange }: ChatPanelProps) {
  const t = getTranslation(lang)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || [])
  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [isApplying, setIsApplying] = useState(false)

  // 当消息变化时通知父组件
  useEffect(() => {
    if (onMessagesChange && messages.length > 0) {
      onMessagesChange(messages)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]) // 移除 onMessagesChange 依赖，因为它已被 useCallback 稳定化

  const scrollToBottom = (force = false) => {
    if (force || isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const atBottom = scrollHeight - scrollTop - clientHeight < 50
      setIsAtBottom(atBottom)
      setShowScrollButton(!atBottom && messages.length > 0)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isGenerating) {
      scrollToBottom(true)
    }
  }, [isGenerating])

  useEffect(() => {
    if (isGenerating) {
      const thinkingSteps = [
        { delay: 500, message: lang === "en" ? "Analyzing lesson requirements..." : "分析課程需求..." },
        {
          delay: 1300,
          message:
            lang === "en"
              ? "Designing learning objectives based on STEAM domains..."
              : "根據 STEAM 領域設計學習目標...",
        },
        {
          delay: 2200,
          message: lang === "en" ? "Creating activity structure and timeline..." : "創建活動結構和時間表...",
        },
        { delay: 3100, message: lang === "en" ? "Generating assessment criteria..." : "生成評估標準..." },
        { delay: 3800, message: lang === "en" ? "Finalizing lesson plan..." : "完成課程計畫..." },
      ]

      setMessages([])

      thinkingSteps.forEach(({ delay, message }) => {
        setTimeout(() => {
          const thinkingMessage: ChatMessage = {
            id: `thinking-${Date.now()}-${Math.random()}`,
            role: "system",
            text: message,
            isThinking: true,
          }
          setMessages((prev) => [...prev, thinkingMessage])
        }, delay)
      })
    }
  }, [isGenerating, lang])

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      text: inputValue,
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsSending(true)

    const aiMessageId = `msg-${Date.now() + 1}`
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: "assistant",
      text: "",
      isStreaming: true,
    }
    setMessages((prev) => [...prev, aiMessage])

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: inputValue, currentLesson, lang }),
      })

      if (!response.ok) throw new Error("Failed to send message")

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader available")

      const decoder = new TextDecoder()
      let fullText = ""
      let suggestedChange: string | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.type === "content" && parsed.content) {
                fullText += parsed.content
                // 移除标记后显示
                const displayText = fullText.replace(/\[(NEEDS_CHANGE|NO_CHANGE)\]/g, "").trim()
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMessageId ? { ...m, text: displayText } : m
                  )
                )
              } else if (parsed.type === "suggested_change") {
                // 包含用户问题和AI回复的完整对话上下文
                suggestedChange = `User: ${inputValue}\n\nAssistant: ${fullText.replace(/\[(NEEDS_CHANGE|NO_CHANGE)\]/g, "").trim()}`
              } else if (parsed.type === "done") {
                const finalText = fullText.replace(/\[(NEEDS_CHANGE|NO_CHANGE)\]/g, "").trim()
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMessageId
                      ? { ...m, text: finalText, isStreaming: false, suggestedChange }
                      : m
                  )
                )
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMessageId
            ? { ...m, text: lang === "en" ? "Sorry, an error occurred." : "抱歉，發生錯誤。", isStreaming: false }
            : m
        )
      )
    } finally {
      setIsSending(false)
    }
  }

  const handleApplyChanges = async (changeContent: string) => {
    if (!currentLesson || isApplying) return

    setIsApplying(true)

    const applyingMessage: ChatMessage = {
      id: `msg-applying-${Date.now()}`,
      role: "assistant",
      text: lang === "en" ? "Applying changes to your lesson plan..." : "正在應用修改到您的課程計畫...",
      isThinking: true,
    }
    setMessages((prev) => [...prev, applyingMessage])

    try {
      const response = await fetch("/api/apply-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLesson,
          suggestedChange: changeContent,
          lang,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to apply changes")
      }

      const { updatedLesson, summary } = await response.json()
      onLessonUpdate(updatedLesson)

      setMessages((prev) => prev.filter((m) => m.id !== applyingMessage.id))

      const confirmationMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        text: lang === "en"
          ? `Changes have been applied to your lesson plan. ${summary}. Please review the updated content in the preview section.`
          : `修改已應用到您的課程計畫。${summary}。請在預覽區域查看更新的內容。`,
      }
      setMessages((prev) => [...prev, confirmationMessage])
    } catch (error) {
      console.error("Error applying changes:", error)
      setMessages((prev) => prev.filter((m) => m.id !== applyingMessage.id))

      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        text: lang === "en"
          ? "Sorry, I couldn't apply the changes. Please try again."
          : "抱歉，無法應用修改。請重試。",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden !gap-0 !py-0">
      <CardHeader className="!px-8 !pt-8 !pb-4 flex flex-row items-center justify-between space-y-0 border-b">
        <CardTitle>{t.chatTitle}</CardTitle>
        {onBackToForm && !isGenerating && (
          <Button variant="ghost" size="sm" onClick={onBackToForm} className="h-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t.backToEdit}
          </Button>
        )}
      </CardHeader>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 relative">
        <div className="py-2 space-y-3">
          {messages.length === 0 && !isGenerating && (
            <div className="text-center text-sm text-muted-foreground py-8">
              {lang === "en" ? "Start a conversation to refine your lesson plan" : "開始對話以優化您的課程計畫"}
            </div>
          )}
          {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role !== "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {message.isThinking ? (
                      <Wrench className="h-4 w-4 text-primary animate-pulse" />
                    ) : (
                      <Bot className="h-4 w-4 text-primary" />
                    )}
                  </div>
                )}
                <div
                  className={`flex flex-col gap-2 max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 text-sm transition-opacity duration-150 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : message.isThinking
                          ? "bg-muted/50 text-muted-foreground italic flex items-center gap-2"
                          : "bg-muted"
                    }`}
                  >
                    {message.isThinking && <Loader2 className="h-3 w-3 animate-spin" />}
                    {message.isThinking ? (message.text || "") : <ChatMarkdown content={message.text || ""} />}
                  </div>
                  {message.suggestedChange && !message.isStreaming && (
                    <Button size="sm" variant="outline" onClick={() => handleApplyChanges(message.suggestedChange!)} disabled={isApplying}>
                      {isApplying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      {t.applyChanges}
                    </Button>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
          <div ref={messagesEndRef} />
        </div>

        {showScrollButton && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-4 right-4 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
            onClick={() => scrollToBottom(true)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-shrink-0 border-t px-3 py-2 bg-background">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={t.chatPlaceholder}
            disabled={isSending || !currentLesson || isGenerating}
            className="h-9"
          />
          <Button
            onClick={handleSend}
            disabled={isSending || !inputValue.trim() || !currentLesson || isGenerating}
            size="sm"
            className="h-9 px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
