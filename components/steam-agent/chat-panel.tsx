"use client"

import { useState, useRef, useEffect } from "react"
import type { Lang, ChatMessage, ToolCall } from "@/types/lesson"
import type { PendingDiff } from "@/lib/editor/types"
import { getTranslation } from "@/lib/translations"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Square, User, Bot, ArrowLeft, Loader2, ArrowDown, CheckCircle2, XCircle, Wrench, Edit3 } from "lucide-react"
import { ChatMarkdown } from "./chat-markdown"

interface ChatPanelProps {
  lang: Lang
  currentLesson: string
  onLessonUpdate: (lesson: string) => void
  onBackToForm?: () => void
  isGenerating?: boolean
  initialMessages?: ChatMessage[]
  onMessagesChange?: (messages: ChatMessage[]) => void
  onDiffsChange?: (diffs: PendingDiff[]) => void
}

export function ChatPanel({ lang, currentLesson, onLessonUpdate, onBackToForm, isGenerating, initialMessages, onMessagesChange, onDiffsChange }: ChatPanelProps) {
  const t = getTranslation(lang)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || [])
  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [isApplying, setIsApplying] = useState(false)

  const ToolCallInline = ({ toolCall }: { toolCall: ToolCall }) => {
    const statusIcon = toolCall.status === 'calling' ? (
      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
    ) : toolCall.status === 'success' ? (
      <CheckCircle2 className="h-3 w-3 text-green-500" />
    ) : (
      <XCircle className="h-3 w-3 text-red-500" />
    )
    return (
      <span className="inline-flex items-center gap-1.5 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-mono mr-1 mb-1">
        {statusIcon}
        {toolCall.name}
      </span>
    )
  }

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
    if (!isGenerating) return

    const thinkingSteps = [
      { message: lang === "en" ? "Analyzing lesson requirements..." : "分析課程需求..." },
      { message: lang === "en" ? "Designing learning objectives based on STEAM domains..." : "根據 STEAM 領域設計學習目標..." },
      { message: lang === "en" ? "Creating activity structure and timeline..." : "創建活動結構和時間表..." },
      { message: lang === "en" ? "Generating assessment criteria..." : "生成評估標準..." },
      { message: lang === "en" ? "Finalizing lesson plan..." : "完成課程計畫..." },
    ]

    // Add first message
    const firstId = `thinking-0`
    setMessages([{ id: firstId, role: "system", text: thinkingSteps[0].message, isThinking: true }])

    const timeouts: NodeJS.Timeout[] = []
    thinkingSteps.slice(1).forEach((step, index) => {
      const timeout = setTimeout(() => {
        const prevId = `thinking-${index}`
        const newId = `thinking-${index + 1}`
        setMessages((prev) => [
          ...prev.map((m) => m.id === prevId ? { ...m, isThinking: false, isCompleted: true } : m),
          { id: newId, role: "system", text: step.message, isThinking: true }
        ])
      }, (index + 1) * 2000)
      timeouts.push(timeout)
    })

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [isGenerating, lang])

  // Mark last thinking message as completed when generation finishes
  useEffect(() => {
    if (isGenerating) return
    setMessages((prev) => prev.map((m) =>
      m.role === "system" && m.isThinking ? { ...m, isThinking: false, isCompleted: true } : m
    ))
  }, [isGenerating])

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return

    abortControllerRef.current = new AbortController()
    const abortSignal = abortControllerRef.current.signal

    // Clear previous diffs when sending new message
    onDiffsChange?.([])

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      text: inputValue,
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsSending(true)

    let aiMessageId = `msg-${Date.now() + 1}`
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: "assistant",
      text: "",
      isStreaming: true,
      toolCalls: [],
    }
    setMessages((prev) => [...prev, aiMessage])

    let fullText = ""
    let suggestedChange: string | undefined
    let collectedDiffs: ChatMessage['diffs'] = []
    let collectedToolCalls: ToolCall[] = []

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: inputValue, currentLesson, lang }),
        signal: abortSignal,
      })

      if (!response.ok) throw new Error("Failed to send message")

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader available")

      const decoder = new TextDecoder()

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
              if (parsed.type === "new_turn") {
                const currentMsgId = aiMessageId
                const finalText = fullText.replace(/\[(NEEDS_CHANGE|NO_CHANGE)\]/g, "").trim()
                const finalToolCalls = collectedToolCalls.length > 0 ? [...collectedToolCalls] : undefined
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentMsgId
                      ? { ...m, text: finalText, isStreaming: false, toolCalls: finalToolCalls }
                      : m
                  )
                )
                fullText = ""
                collectedToolCalls = []
                aiMessageId = `msg-${Date.now()}`
                const newAiMessage: ChatMessage = {
                  id: aiMessageId,
                  role: "assistant",
                  text: "",
                  isStreaming: true,
                  toolCalls: [],
                }
                setMessages((prev) => [...prev, newAiMessage])
              } else if (parsed.type === "tool_call" && parsed.toolCall) {
                const tc = parsed.toolCall as ToolCall
                const currentMsgId = aiMessageId
                const existingIdx = collectedToolCalls.findIndex(t => t.id === tc.id)
                if (existingIdx >= 0) {
                  collectedToolCalls[existingIdx] = tc
                } else {
                  collectedToolCalls.push(tc)
                }
                const toolCallsCopy = [...collectedToolCalls]
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentMsgId ? { ...m, toolCalls: toolCallsCopy } : m
                  )
                )
              } else if (parsed.type === "content" && parsed.content) {
                fullText += parsed.content
                const displayText = fullText.replace(/\[(NEEDS_CHANGE|NO_CHANGE)\]/g, "").trim()
                const currentMsgId = aiMessageId
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentMsgId ? { ...m, text: displayText } : m
                  )
                )
              } else if (parsed.type === "suggested_change") {
                suggestedChange = "true"
              } else if (parsed.type === "diff" && parsed.diff) {
                collectedDiffs.push(parsed.diff)
              } else if (parsed.type === "done") {
                const finalText = fullText.replace(/\[(NEEDS_CHANGE|NO_CHANGE)\]/g, "").trim()
                const currentMsgId = aiMessageId
                const finalToolCalls = collectedToolCalls.length > 0 ? [...collectedToolCalls] : undefined
                const finalDiffs = collectedDiffs.length > 0 ? [...collectedDiffs] : undefined
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentMsgId
                      ? { ...m, text: finalText, isStreaming: false, suggestedChange, diffs: finalDiffs, toolCalls: finalToolCalls }
                      : m
                  )
                )
                if (finalDiffs && onDiffsChange) {
                  onDiffsChange(finalDiffs as PendingDiff[])
                }
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        const finalText = fullText.replace(/\[(NEEDS_CHANGE|NO_CHANGE)\]/g, "").trim()
        const currentMsgId = aiMessageId
        const finalToolCalls = collectedToolCalls.length > 0 ? [...collectedToolCalls] : undefined
        setMessages((prev) =>
          prev.map((m) =>
            m.id === currentMsgId
              ? {
                  ...m,
                  text: finalText || m.text,
                  isStreaming: false,
                  toolCalls: finalToolCalls ?? m.toolCalls,
                }
              : m
          )
        )
      } else {
        console.error("Error sending message:", error)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMessageId
              ? { ...m, text: lang === "en" ? "Sorry, an error occurred." : "抱歉，發生錯誤。", isStreaming: false }
              : m
          )
        )
      }
    } finally {
      abortControllerRef.current = null
      setIsSending(false)
    }
  }

  const handleCancel = () => {
    abortControllerRef.current?.abort("user_cancelled")
    abortControllerRef.current = null
    setIsSending(false)
  }

  const handleApplyChanges = async (changeContent: string, diffs?: ChatMessage['diffs']) => {
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
          diffs: diffs || [],
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
    <Card className="h-full flex flex-col overflow-hidden !gap-0 !py-0 rounded-2xl bg-white shadow-lg border-purple-100">
      <CardHeader className="!px-4 !pt-4 !pb-3 flex flex-row items-center justify-between space-y-0 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-purple-600" />
          <CardTitle className="text-purple-900">{t.chatTitle}</CardTitle>
        </div>
        {onBackToForm && !isGenerating && (
          <Button variant="ghost" size="sm" onClick={onBackToForm} className="h-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t.backToEdit}
          </Button>
        )}
      </CardHeader>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 relative bg-purple-50/30">
        <div className="py-3 space-y-4">
          {messages.length === 0 && !isGenerating && (
            <div className="text-center text-sm text-purple-400 py-8">
              {lang === "en" ? "Ask to modify the lesson plan..." : "開始對話以優化您的課程計畫"}
            </div>
          )}
          {messages.map((message) => {
              return (
              <div
                key={message.id}
                className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role !== "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    {message.isThinking ? (
                      <Wrench className="h-4 w-4 text-purple-500 animate-pulse" />
                    ) : message.isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-purple-500" />
                    ) : (
                      <Bot className="h-4 w-4 text-purple-600" />
                    )}
                  </div>
                )}
                <div
                  className={`flex flex-col gap-2 max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                  {/* Message content with tool calls */}
                  {(message.text || message.isThinking || message.isCompleted || (message.toolCalls && message.toolCalls.length > 0)) && (
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm transition-opacity duration-150 ${
                        message.role === "user"
                          ? "bg-amber-100 text-amber-900"
                          : message.isThinking
                            ? "bg-purple-50 text-purple-500 italic flex items-center gap-2"
                            : message.isCompleted
                              ? "bg-purple-50 text-purple-500 flex items-center gap-2"
                              : "bg-purple-50 text-purple-900"
                      }`}
                    >
                      {message.isThinking && <Loader2 className="h-3 w-3 animate-spin" />}
                      {message.isThinking || message.isCompleted ? (
                        message.text || ""
                      ) : (
                        <>
                          {message.text && <ChatMarkdown content={message.text} />}
                          {message.toolCalls && message.toolCalls.length > 0 && (
                            <div className={message.text ? "mt-1" : ""}>
                              {message.toolCalls.map((tc) => (
                                <ToolCallInline key={tc.id} toolCall={tc} />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-amber-700" />
                  </div>
                )}
              </div>
            )})}
          <div ref={messagesEndRef} />
        </div>

        {showScrollButton && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-4 right-4 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 bg-purple-100 hover:bg-purple-200 text-purple-700"
            onClick={() => scrollToBottom(true)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-purple-100 px-3 py-3 bg-white">
        <div className="flex gap-2 items-center">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={lang === "en" ? "Ask to modify the lesson plan..." : "請輸入修改建議..."}
            disabled={isSending || !currentLesson || isGenerating}
            className="h-10 rounded-full border-purple-200 bg-white px-4 focus-visible:ring-purple-400"
          />
          {isSending ? (
            <Button
              onClick={handleCancel}
              size="icon"
              variant="destructive"
              className="h-10 w-10 rounded-full shrink-0"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || !currentLesson || isGenerating}
              size="icon"
              className="h-10 w-10 rounded-full shrink-0 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white shadow-md"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
