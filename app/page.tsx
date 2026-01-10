"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import type { Lang, LessonRequirements, ChatMessage } from "@/types/lesson"
import { generateLessonDraft, getLessonById, updateLesson } from "@/lib/api"
import { loadSettings } from "@/lib/settingsStorage"
import { Header } from "@/components/layout/header"
import { LessonRequirementsForm } from "@/components/steam-agent/lesson-requirements-form"
import { LessonPreview } from "@/components/steam-agent/lesson-preview"
import { ChatPanel } from "@/components/steam-agent/chat-panel"
import { BottomActionBar } from "@/components/steam-agent/bottom-action-bar"

export default function Home() {
  const searchParams = useSearchParams()
  const { status } = useSession()
  const [currentLang, setCurrentLang] = useState<Lang>("en")
  const [currentLesson, setCurrentLesson] = useState<string>("")
  const [currentRequirements, setCurrentRequirements] = useState<LessonRequirements | null>(null)
  const [currentLessonId, setCurrentLessonId] = useState<string | undefined>(undefined)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showForm, setShowForm] = useState(true)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const chatHistoryRef = useRef<ChatMessage[]>([])

  useEffect(() => {
    const settings = loadSettings()
    // Apply theme if needed (TODO: implement theme switching)
    // Apply other settings as needed
  }, [])

  useEffect(() => {
    const lessonId = searchParams.get("lessonId")
    if (lessonId) {
      getLessonById(lessonId).then((savedLesson) => {
        if (savedLesson) {
          setCurrentLesson(savedLesson.markdown || "")
          setCurrentRequirements(savedLesson.requirements)
          setCurrentLessonId(savedLesson.id)
          setChatHistory(savedLesson.chatHistory || [])
          setShowForm(false) // 直接进入对话编辑界面
        }
      })
    }
  }, [searchParams])

  const handleGenerateLesson = async (requirements: LessonRequirements) => {
    setIsGenerating(true)
    setCurrentRequirements(requirements)
    setCurrentLesson("") // Clear previous lesson
    setShowForm(false) // Switch to chat view

    // Immediately switch to chat view to show generation process
    setCurrentLesson(" ") // Set space to trigger chat view

    try {
      // Use LangChain API with language support
      const markdown = await generateLessonDraft(requirements, currentLang)
      setCurrentLesson(markdown)
    } catch (error) {
      console.error("Error generating lesson:", error)
      setCurrentLesson("") // Reset on error
    } finally {
      setIsGenerating(false)
    }
  }

  const handleBackToForm = () => {
    setShowForm(true)
  }

  const handleLessonUpdate = (updatedLesson: string) => {
    setCurrentLesson(updatedLesson)
  }

  const handleSaveSuccess = (id: string) => {
    setCurrentLessonId(id)
  }

  const handleMessagesChange = useCallback((messages: ChatMessage[]) => {
    // 过滤掉思考中和流式消息，只保存真正的对话
    const persistentMessages = messages.filter(m => !m.isThinking && !m.isStreaming)

    // 浅比较避免不必要的更新
    const prevMessages = chatHistoryRef.current
    if (
      persistentMessages.length === prevMessages.length &&
      persistentMessages.every((m, i) => m.id === prevMessages[i]?.id)
    ) {
      return // 没有变化，跳过更新
    }

    chatHistoryRef.current = persistentMessages
    setChatHistory(persistentMessages)
  }, [])

  // 保存聊天历史到数据库
  useEffect(() => {
    if (currentLessonId && chatHistory.length > 0) {
      updateLesson(currentLessonId, { chatHistory })
    }
  }, [currentLessonId, chatHistory])

  if (status === "loading") {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header lang={currentLang} onLangChange={setCurrentLang} />

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column - Form or Chat */}
          <div className="h-[calc(100vh-180px)]">
            {showForm ? (
              <div key="form" className="h-full animate-in fade-in slide-in-from-left-4 duration-500">
                <LessonRequirementsForm
                  lang={currentLang}
                  onGenerate={handleGenerateLesson}
                  isGenerating={isGenerating}
                  initialRequirements={currentRequirements}
                  hasExistingLesson={!!currentLesson.trim()}
                  onSwitchToChat={() => setShowForm(false)}
                />
              </div>
            ) : (
              <div key="chat" className="h-full animate-in fade-in slide-in-from-left-4 duration-500">
                <ChatPanel
                  lang={currentLang}
                  currentLesson={currentLesson}
                  onLessonUpdate={handleLessonUpdate}
                  onBackToForm={handleBackToForm}
                  isGenerating={isGenerating}
                  initialMessages={chatHistory}
                  onMessagesChange={handleMessagesChange}
                />
              </div>
            )}
          </div>

          {/* Right Column - Lesson Preview */}
          <div className="h-[calc(100vh-180px)]">
            <LessonPreview lang={currentLang} lesson={currentLesson} isGenerating={isGenerating} onLessonUpdate={handleLessonUpdate} />
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <BottomActionBar
        lang={currentLang}
        currentLesson={currentLesson}
        currentRequirements={currentRequirements}
        currentLessonId={currentLessonId}
        onSaveSuccess={handleSaveSuccess}
      />
    </div>
  )
}
