"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import type { Lang, LessonRequirements, ChatMessage } from "@/types/lesson"
import type { PendingDiff } from "@/lib/editor/types"
import { generateLessonDraft, getLessonById, updateLesson } from "@/lib/api"
import { loadSettings } from "@/lib/settingsStorage"
import { Header } from "@/components/layout/header"
import { LessonRequirementsForm } from "@/components/steam-agent/lesson-requirements-form"
import { LessonPreview } from "@/components/steam-agent/lesson-preview"
import { ChatPanel } from "@/components/steam-agent/chat-panel"
import { BottomActionBar } from "@/components/steam-agent/bottom-action-bar"
import { useAutoSave } from "@/hooks/useAutoSave"
import { useEditorStore } from "@/stores/editorStore"
import { fetchDocuments, createDocument, generateDocumentStream, type GenerateDocumentStreamParams } from "@/lib/editor/api"
import { toast } from "sonner"
import { NewDocumentDialog } from "@/components/editor/new-document-dialog"
import type { TemplateKey } from "@/lib/editor/document-templates"

export default function Home() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { status } = useSession()
  const [currentLang, setCurrentLang] = useState<Lang>("en")
  const [currentLesson, setCurrentLesson] = useState<string>("")
  const [currentRequirements, setCurrentRequirements] = useState<LessonRequirements | null>(null)
  const [currentLessonId, setCurrentLessonId] = useState<string | undefined>(undefined)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showForm, setShowForm] = useState(true)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [pendingDiffs, setPendingDiffs] = useState<PendingDiff[]>([])
  const [showNewDocDialog, setShowNewDocDialog] = useState(false)
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false)
  const chatHistoryRef = useRef<ChatMessage[]>([])

  // Multi-document state from store
  const { documents, markdown: storeMarkdown, activeDocId, streamingDocId, setDocuments, addDocument, updateDocumentContent, appendDocumentContent, setStreamingDocId } = useEditorStore()
  const isDocumentStreaming = !!streamingDocId

  useAutoSave({
    currentLesson: storeMarkdown,
    currentRequirements,
    currentLessonId,
    streamingDocId,
    enabled: status === "authenticated",
  })

  // Sync store markdown with local currentLesson when document changes (skip during streaming)
  useEffect(() => {
    if (documents.length > 0 && !isDocumentStreaming) {
      setCurrentLesson(storeMarkdown)
    }
  }, [storeMarkdown, activeDocId, documents.length, isDocumentStreaming])

  useEffect(() => {
    const settings = loadSettings()
    // Apply theme if needed (TODO: implement theme switching)
    // Apply other settings as needed
  }, [])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    }
  }, [status, router])

  // Track loaded lessonId to prevent duplicate document creation
  const loadedLessonIdRef = useRef<string | null>(null)

  useEffect(() => {
    const lessonId = searchParams.get("lessonId")

    // If no lessonId in URL, reset to create new lesson
    if (!lessonId && loadedLessonIdRef.current !== null) {
      loadedLessonIdRef.current = null
      setCurrentLesson("")
      setCurrentRequirements(null)
      setCurrentLessonId(undefined)
      setChatHistory([])
      setShowForm(true)
      setDocuments([])
      setPendingDiffs([])
      return
    }

    if (lessonId && loadedLessonIdRef.current !== lessonId) {
      loadedLessonIdRef.current = lessonId
      // Load documents for this lesson
      loadDocuments(lessonId)

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
  }, [searchParams, setDocuments])

  const loadDocuments = async (lessonId: string) => {
    try {
      const docs = await fetchDocuments(lessonId)
      if (docs.length > 0) {
        setDocuments(docs)
      } else {
        // Create initial document from lesson content
        const savedLesson = await getLessonById(lessonId)
        if (savedLesson?.markdown) {
          const doc = await createDocument(lessonId, "Lesson Plan", "lesson", savedLesson.markdown)
          setDocuments([doc])
        }
      }
    } catch {
      // Silent fail - documents feature is optional
    }
  }

  const handleAddDocument = async () => {
    if (!currentLessonId) {
      toast.error("Please save the lesson first")
      return
    }
    // Ensure lesson plan document exists before adding new documents
    if (documents.length === 0 && currentLesson.trim()) {
      try {
        const doc = await createDocument(currentLessonId, "Lesson Plan", "lesson", currentLesson)
        addDocument(doc)
      } catch {
        toast.error("Failed to create lesson plan document")
        return
      }
    }
    setShowNewDocDialog(true)
  }

  const handleGenerateDocument = async (templateKey: TemplateKey, customName?: string, lang?: Lang) => {
    if (!currentLessonId) return
    const targetLang = lang ?? currentLang
    setIsGeneratingDoc(true)
    try {
      // 空白文档直接创建，不调用 LLM
      if (templateKey === 'blank' && customName) {
        const doc = await createDocument(currentLessonId, customName, 'custom', '')
        addDocument(doc)
        setShowNewDocDialog(false)
        toast.success("Document created")
        return
      }

      // Create empty document first for streaming
      const tempDoc = await createDocument(currentLessonId, 'Generating...', 'custom', '')
      addDocument(tempDoc)
      setStreamingDocId(tempDoc.id)
      setShowNewDocDialog(false)

      // Stream content into the document
      const generationParams: GenerateDocumentStreamParams & { lang?: Lang } = {
        templateKey,
        lessonId: currentLessonId,
        existingDocuments: documents.map(d => ({ name: d.name, content: d.content })),
        lang: targetLang,
      }

      await generateDocumentStream(
        generationParams,
        (text) => {
          appendDocumentContent(tempDoc.id, text)
        },
        async (result) => {
          // Update document name after streaming completes
          setStreamingDocId(null)
          // Update the document name in the database
          const { updateDocument } = await import("@/lib/editor/api")
          await updateDocument(tempDoc.id, { name: result.name })
          // Update local state
          useEditorStore.setState(state => ({
            documents: state.documents.map(d =>
              d.id === tempDoc.id ? { ...d, name: result.name } : d
            )
          }))
          toast.success("Document generated successfully")
        },
        (error) => {
          setStreamingDocId(null)
          toast.error(error.message || "Failed to generate document")
        }
      )
    } catch {
      setStreamingDocId(null)
      toast.error("Failed to generate document")
    } finally {
      setIsGeneratingDoc(false)
    }
  }

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
    // Sync to store if we have an active document
    if (activeDocId) {
      updateDocumentContent(activeDocId, updatedLesson)
    }
  }

  const handleSaveSuccess = (id: string) => {
    setCurrentLessonId(id)
    loadedLessonIdRef.current = id
  }

  const handleDiffsChange = useCallback((diffs: PendingDiff[]) => {
    setPendingDiffs(diffs)
  }, [])

  const handleApplyDiff = useCallback(async (diffId: string) => {
    const diff = pendingDiffs.find(d => d.id === diffId)
    if (!diff) return

    try {
      const response = await fetch("/api/apply-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentLesson, diffs: [diff], lang: currentLang }),
      })
      if (response.ok) {
        const { updatedLesson } = await response.json()
        setCurrentLesson(updatedLesson)
        setPendingDiffs(prev => prev.filter(d => d.id !== diffId))
      }
    } catch (error) {
      console.error("Error applying diff:", error)
    }
  }, [pendingDiffs, currentLesson, currentLang])

  const handleRejectDiff = useCallback((diffId: string) => {
    setPendingDiffs(prev => prev.filter(d => d.id !== diffId))
  }, [])

  const handleApplyAllDiffs = useCallback(async () => {
    if (pendingDiffs.length === 0) return

    try {
      const response = await fetch("/api/apply-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentLesson, diffs: pendingDiffs, lang: currentLang }),
      })
      if (response.ok) {
        const { updatedLesson } = await response.json()
        setCurrentLesson(updatedLesson)
        setPendingDiffs([])
      }
    } catch (error) {
      console.error("Error applying all diffs:", error)
    }
  }, [pendingDiffs, currentLesson, currentLang])

  const handleRejectAllDiffs = useCallback(() => {
    setPendingDiffs([])
  }, [])

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

  if (status === "loading" || status === "unauthenticated") {
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
                  onDiffsChange={handleDiffsChange}
                />
              </div>
            )}
          </div>

          {/* Right Column - Lesson Preview */}
          <div className="h-[calc(100vh-180px)]">
            <LessonPreview
              lang={currentLang}
              lesson={isDocumentStreaming ? storeMarkdown : currentLesson}
              isGenerating={isGenerating}
              isDocumentStreaming={isDocumentStreaming}
              onLessonUpdate={handleLessonUpdate}
              pendingDiffs={pendingDiffs}
              onApplyDiff={handleApplyDiff}
              onRejectDiff={handleRejectDiff}
              onApplyAllDiffs={handleApplyAllDiffs}
              onRejectAllDiffs={handleRejectAllDiffs}
              onAddDocument={handleAddDocument}
            />
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

      {/* New Document Dialog */}
      <NewDocumentDialog
        open={showNewDocDialog}
        onOpenChange={setShowNewDocDialog}
        onGenerate={handleGenerateDocument}
        lang={currentLang}
        isGenerating={isGeneratingDoc}
      />
    </div>
  )
}
