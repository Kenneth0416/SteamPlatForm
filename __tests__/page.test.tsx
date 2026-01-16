"use client"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { EditorDocument } from "@/lib/editor/types"
import type { LessonRequirements } from "@/types/lesson"
import Home from "@/app/page"
import { useEditorStore as mockedUseEditorStore } from "@/stores/editorStore"
import { useAutoSave as mockedUseAutoSave } from "@/hooks/useAutoSave"

const baseRequirements: LessonRequirements = {
  gradeLevel: "p4-6",
  numberOfSessions: 3,
  durationPerSession: 45,
  steamDomains: ["S"],
  lessonTopic: "Robotics",
  schoolThemes: ["Innovation"],
  teachingApproach: "project",
  difficultyLevel: "beginner",
  notes: "Some notes",
}

const makeDocument = (overrides?: Partial<EditorDocument>): EditorDocument => ({
  id: "doc-1",
  name: "Doc 1",
  type: "lesson",
  content: "doc content",
  blocks: [],
  isDirty: false,
  createdAt: new Date(),
  ...overrides,
})

const defaultStoreState = () => ({
  documents: [makeDocument()],
  markdown: "store markdown",
  activeDocId: "doc-1",
  streamingDocId: null as string | null,
  setDocuments: jest.fn(),
  addDocument: jest.fn(),
  updateDocumentContent: jest.fn(),
  appendDocumentContent: jest.fn(),
  setStreamingDocId: jest.fn(),
})

const mockUseSearchParams = jest.fn()
const mockUseRouter = jest.fn()
const mockUseSession = jest.fn()
const mockLoadSettings = jest.fn()
const mockGenerateLessonDraft = jest.fn()
const mockGetLessonById = jest.fn()
const mockUpdateLesson = jest.fn()
const mockFetchDocuments = jest.fn()
const mockCreateDocument = jest.fn()
const mockGenerateDocumentStream = jest.fn()
const mockUpdateDocument = jest.fn()
const mockUseEditorStore = jest.fn()
const toastSuccess = jest.fn()
const toastError = jest.fn()
const lessonPreviewMock = jest.fn()
const mockUseAutoSave = mockedUseAutoSave as jest.MockedFunction<typeof mockedUseAutoSave>

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => mockUseRouter(),
}))

jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

jest.mock("@/lib/settingsStorage", () => ({
  loadSettings: () => mockLoadSettings(),
}))

jest.mock("@/lib/api", () => ({
  generateLessonDraft: (...args: unknown[]) => mockGenerateLessonDraft(...args),
  getLessonById: (...args: unknown[]) => mockGetLessonById(...args),
  updateLesson: (...args: unknown[]) => mockUpdateLesson(...args),
}))

jest.mock("@/lib/editor/api", () => ({
  fetchDocuments: (...args: unknown[]) => mockFetchDocuments(...args),
  createDocument: (...args: unknown[]) => mockCreateDocument(...args),
  generateDocumentStream: (...args: unknown[]) => mockGenerateDocumentStream(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
}))

jest.mock("@/stores/editorStore", () => {
  const mocked = (...args: unknown[]) => mockUseEditorStore(...args)
  mocked.setState = jest.fn()
  return {
    __esModule: true,
    useEditorStore: mocked,
  }
})

jest.mock("@/hooks/useAutoSave", () => ({
  useAutoSave: jest.fn(),
}))

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

jest.mock("@/components/layout/header", () => ({
  Header: () => <div data-testid="header" />,
}))

jest.mock("@/components/steam-agent/lesson-requirements-form", () => ({
  LessonRequirementsForm: ({ onGenerate, onSwitchToChat }: any) => (
    <div data-testid="lesson-form">
      <button data-testid="generate-lesson" onClick={() => onGenerate?.(baseRequirements)}>
        generate lesson
      </button>
      <button data-testid="switch-to-chat" onClick={() => onSwitchToChat?.()}>
        switch to chat
      </button>
    </div>
  ),
}))

jest.mock("@/components/steam-agent/chat-panel", () => ({
  ChatPanel: ({ onLessonUpdate, onBackToForm, onMessagesChange, onDiffsChange }: any) => (
    <div data-testid="chat-panel">
      <button data-testid="chat-update-lesson" onClick={() => onLessonUpdate?.("chat lesson")}>
        update lesson
      </button>
      <button data-testid="chat-back" onClick={() => onBackToForm?.()}>
        back
      </button>
      <button
        data-testid="chat-set-messages"
        onClick={() =>
          onMessagesChange?.([
            { id: "1", role: "assistant", text: "thinking", isThinking: true },
            { id: "2", role: "assistant", text: "keep me" },
            { id: "3", role: "assistant", text: "streaming", isStreaming: true },
          ])
        }
      >
        messages
      </button>
      <button
        data-testid="chat-set-diffs"
        onClick={() =>
          onDiffsChange?.([
            { id: "diff-1", blockId: "b1", action: "update", oldContent: "old", newContent: "new", reason: "because" },
          ])
        }
      >
        diffs
      </button>
    </div>
  ),
}))

jest.mock("@/components/steam-agent/lesson-preview", () => ({
  LessonPreview: (props: any) => {
    lessonPreviewMock(props)
    return (
      <div data-testid="lesson-preview">
        <button data-testid="apply-diff" onClick={() => props.onApplyDiff?.("diff-1")}>
          apply diff
        </button>
        <button data-testid="reject-diff" onClick={() => props.onRejectDiff?.("diff-1")}>
          reject diff
        </button>
        <button data-testid="apply-all-diffs" onClick={() => props.onApplyAllDiffs?.()}>
          apply all
        </button>
        <button data-testid="reject-all-diffs" onClick={() => props.onRejectAllDiffs?.()}>
          reject all
        </button>
        <button data-testid="add-document" onClick={() => props.onAddDocument?.()}>
          add document
        </button>
      </div>
    )
  },
}))

jest.mock("@/components/steam-agent/bottom-action-bar", () => ({
  BottomActionBar: ({ onSaveSuccess }: any) => (
    <div data-testid="bottom-bar">
      <button data-testid="save-lesson" onClick={() => onSaveSuccess?.("lesson-123")}>
        save
      </button>
    </div>
  ),
}))

jest.mock("@/components/editor/new-document-dialog", () => ({
  NewDocumentDialog: ({ open, onGenerate, onOpenChange }: any) => (
    <div data-testid="new-doc-dialog">
      <span data-testid="dialog-open">{open ? "open" : "closed"}</span>
      <button data-testid="close-dialog" onClick={() => onOpenChange?.(false)}>
        close
      </button>
      <button
        data-testid="generate-blank-doc"
        onClick={() => onGenerate?.("blank", "Custom Doc", "en")}
      >
        blank doc
      </button>
      <button data-testid="generate-streaming-doc" onClick={() => onGenerate?.("worksheet", undefined, "en")}>
        streaming doc
      </button>
      <button data-testid="generate-streaming-doc-default-lang" onClick={() => onGenerate?.("worksheet")}>
        streaming doc default
      </button>
    </div>
  ),
}))

describe("Home page streaming state", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAutoSave.mockClear()
    mockUseSession.mockReturnValue({ status: "authenticated" })
    mockUseSearchParams.mockReturnValue({ get: () => null })
    mockUseRouter.mockReturnValue({ push: jest.fn() })
    mockLoadSettings.mockReturnValue({})
    const initialStoreState = defaultStoreState()
    ;(mockUseEditorStore as jest.Mock).mockReturnValue(initialStoreState)
    ;(mockedUseEditorStore as any).setState = jest.fn((updater: any) => {
      const update = typeof updater === "function" ? updater(initialStoreState) : updater
      Object.assign(initialStoreState, update)
    })
    mockGenerateLessonDraft.mockResolvedValue("Generated lesson")
    mockGetLessonById.mockResolvedValue(null)
    mockFetchDocuments.mockResolvedValue([])
    mockCreateDocument.mockResolvedValue(makeDocument())
    mockGenerateDocumentStream.mockResolvedValue(undefined)
    mockUpdateDocument.mockResolvedValue(undefined)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ updatedLesson: "updated lesson" }),
    }) as any
  })

  it("initializes auto-save with store markdown and identifiers", () => {
    render(<Home />)

    expect(mockUseAutoSave).toHaveBeenCalled()
    const callArgs = mockUseAutoSave.mock.calls[0]?.[0]
    expect(callArgs).toMatchObject({
      currentLesson: "store markdown",
      currentRequirements: null,
      currentLessonId: undefined,
      streamingDocId: null,
      enabled: true,
    })
  })

  it("passes streaming state separately from generating", () => {
    const storeState = {
      ...defaultStoreState(),
      streamingDocId: "doc-stream",
      markdown: "streaming markdown",
      documents: [makeDocument()],
    }
    ;(mockUseEditorStore as jest.Mock).mockReturnValue(storeState)

    render(<Home />)

    const lastCall = lessonPreviewMock.mock.calls[lessonPreviewMock.mock.calls.length - 1][0]
    expect(lastCall.lesson).toBe("streaming markdown")
    expect(lastCall.isGenerating).toBe(false)
    expect(lastCall.isDocumentStreaming).toBe(true)
  })

  it("invokes page handlers without coupling streaming and generation states", async () => {
    const storeState = defaultStoreState()
    storeState.setStreamingDocId = jest.fn((id: string | null) => {
      storeState.streamingDocId = id
    })
    ;(mockUseEditorStore as jest.Mock).mockImplementation(() => storeState)
    ;(mockedUseEditorStore as any).setState = jest.fn((updater: any) => {
      const update = typeof updater === "function" ? updater(storeState) : updater
      Object.assign(storeState, update)
    })

    let resolveLesson!: (value: string) => void
    mockGenerateLessonDraft.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveLesson = resolve
        }),
    )

    render(<Home />)

    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-lesson"))
    })
    const generatingCall = lessonPreviewMock.mock.calls.find(call => call[0].isGenerating === true)
    expect(generatingCall).toBeTruthy()

    await act(async () => {
      resolveLesson("Final lesson")
    })

    fireEvent.click(screen.getByTestId("chat-set-diffs"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("apply-diff"))
    })
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/apply-change",
      expect.objectContaining({ method: "POST" }),
    )

    fireEvent.click(screen.getByTestId("reject-diff"))
    fireEvent.click(screen.getByTestId("chat-set-diffs"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("apply-all-diffs"))
    })
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/apply-change",
      expect.objectContaining({ method: "POST" }),
    )
    fireEvent.click(screen.getByTestId("reject-all-diffs"))

    await act(async () => {
      fireEvent.click(screen.getByTestId("chat-update-lesson"))
    })
    expect(storeState.updateDocumentContent).toHaveBeenCalledWith("doc-1", "chat lesson")

    fireEvent.click(screen.getByTestId("add-document"))
    expect(toastError).toHaveBeenCalled()

    fireEvent.click(screen.getByTestId("save-lesson"))
    fireEvent.click(screen.getByTestId("add-document"))
    expect(screen.getByTestId("dialog-open").textContent).toBe("open")

    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-blank-doc"))
    })
    expect(mockCreateDocument).toHaveBeenCalled()

    mockCreateDocument.mockResolvedValue(makeDocument({ id: "temp-doc", name: "Generating..." }))
    mockGenerateDocumentStream.mockImplementation(async (_params, onText: any, onComplete: any) => {
      onText("partial")
      await onComplete({ name: "Finished Doc" })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-streaming-doc"))
    })
    expect(storeState.setStreamingDocId).toHaveBeenCalledWith("temp-doc")
    expect(storeState.appendDocumentContent).toHaveBeenCalled()
    await waitFor(() => {
      expect(storeState.streamingDocId).toBeNull()
    })

    fireEvent.click(screen.getByTestId("chat-set-messages"))
    await waitFor(() => {
      expect(mockUpdateLesson).toHaveBeenCalledWith("lesson-123", {
        chatHistory: [{ id: "2", role: "assistant", text: "keep me" }],
      })
    })
    const updateCalls = mockUpdateLesson.mock.calls.length
    fireEvent.click(screen.getByTestId("chat-set-messages"))
    expect(mockUpdateLesson.mock.calls.length).toBe(updateCalls)

    fireEvent.click(screen.getByTestId("chat-back"))
    expect(screen.getByTestId("lesson-form")).toBeInTheDocument()
  })

  it("redirects unauthenticated users", () => {
    const push = jest.fn()
    mockUseRouter.mockReturnValue({ push })
    mockUseSession.mockReturnValue({ status: "unauthenticated" })

    render(<Home />)

    expect(push).toHaveBeenCalledWith("/auth/login")
  })

  it("loads existing documents and lesson data when lessonId is provided", async () => {
    const setDocuments = jest.fn()
    const storeState = { ...defaultStoreState(), setDocuments }
    ;(mockUseEditorStore as jest.Mock).mockReturnValue(storeState)
    const savedLesson = {
      id: "lesson-99",
      markdown: "saved markdown",
      requirements: baseRequirements,
      chatHistory: [{ id: "chat-1", role: "assistant", text: "hello" }],
    }
    mockUseSearchParams.mockReturnValue({ get: () => "lesson-99" })
    mockFetchDocuments.mockResolvedValue([makeDocument({ id: "existing-doc" })])
    mockGetLessonById.mockResolvedValue(savedLesson)

    render(<Home />)

    await waitFor(() => expect(setDocuments).toHaveBeenCalledWith(expect.any(Array)))
    await waitFor(() => {
      expect(mockUpdateLesson).toHaveBeenCalledWith("lesson-99", { chatHistory: savedLesson.chatHistory })
    })
  })

  it("creates an initial document from saved lesson when none exist", async () => {
    const setDocuments = jest.fn()
    const storeState = { ...defaultStoreState(), setDocuments }
    ;(mockUseEditorStore as jest.Mock).mockReturnValue(storeState)
    mockUseSearchParams.mockReturnValue({ get: () => "lesson-100" })
    mockFetchDocuments.mockResolvedValue([])
    mockGetLessonById.mockResolvedValue({
      id: "lesson-100",
      markdown: "seed markdown",
      requirements: baseRequirements,
      chatHistory: [],
    })
    const createdDoc = makeDocument({ id: "created-doc", content: "seed markdown" })
    mockCreateDocument.mockResolvedValue(createdDoc)

    render(<Home />)

    await waitFor(() => expect(setDocuments).toHaveBeenCalledWith([createdDoc]))
  })

  it("resets generation state when lesson generation fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    mockGenerateLessonDraft.mockRejectedValue(new Error("fail"))

    render(<Home />)

    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-lesson"))
    })

    await waitFor(() => {
      const lastCall = lessonPreviewMock.mock.calls[lessonPreviewMock.mock.calls.length - 1][0]
      expect(lastCall.isGenerating).toBe(false)
      expect(lastCall.lesson).toBe("")
    })
    consoleSpy.mockRestore()
  })

  it("handles document streaming errors and resets state", async () => {
    const storeState = defaultStoreState()
    storeState.setStreamingDocId = jest.fn()
    ;(mockUseEditorStore as jest.Mock).mockReturnValue(storeState)
    mockGenerateDocumentStream.mockRejectedValue(new Error("stream failed"))

    render(<Home />)

    fireEvent.click(screen.getByTestId("save-lesson"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-streaming-doc"))
    })

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Failed to generate document"))
    expect(storeState.setStreamingDocId).toHaveBeenCalledWith(null)
  })

  it("clears streaming state when generator reports an error callback", async () => {
    const storeState = defaultStoreState()
    storeState.setStreamingDocId = jest.fn()
    ;(mockUseEditorStore as jest.Mock).mockReturnValue(storeState)
    mockGenerateDocumentStream.mockImplementation(async (_params, _onText: any, _onComplete: any, onError: any) => {
      onError({ message: "" })
    })

    render(<Home />)

    fireEvent.click(screen.getByTestId("save-lesson"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-streaming-doc"))
    })

    expect(storeState.setStreamingDocId).toHaveBeenCalledWith(null)
    expect(toastError).toHaveBeenCalledWith("Failed to generate document")
  })

  it("returns early when trying to stream without a lesson id", async () => {
    render(<Home />)

    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-streaming-doc"))
    })

    expect(mockCreateDocument).not.toHaveBeenCalled()
  })

  it("updates document metadata after streaming completes successfully", async () => {
    const storeState = { ...defaultStoreState(), documents: [makeDocument({ id: "temp-doc", name: "Generating..." })] }
    storeState.setStreamingDocId = jest.fn((id: string | null) => {
      storeState.streamingDocId = id
    })
    ;(mockUseEditorStore as jest.Mock).mockReturnValue(storeState)
    ;(mockedUseEditorStore as any).setState = jest.fn((updater: any) => {
      const update = typeof updater === "function" ? updater(storeState) : updater
      Object.assign(storeState, update)
    })
    mockCreateDocument.mockResolvedValue(makeDocument({ id: "temp-doc", name: "Generating..." }))
    mockGenerateDocumentStream.mockImplementation(async (_params, onText: any, onComplete: any) => {
      onText("stream")
      await onComplete({ name: "Final Name" })
    })

    render(<Home />)

    fireEvent.click(screen.getByTestId("save-lesson"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-streaming-doc"))
    })

    expect(storeState.setStreamingDocId).toHaveBeenCalledWith(null)
    expect(toastSuccess).toHaveBeenCalledWith("Document generated successfully")
  })

  it("ignores apply diff when no pending diff is found", async () => {
    render(<Home />)

    fireEvent.click(screen.getByTestId("switch-to-chat"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("apply-diff"))
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("skips apply-all when there are no pending diffs", async () => {
    render(<Home />)

    fireEvent.click(screen.getByTestId("switch-to-chat"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("apply-all-diffs"))
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("uses fallback language when template language is omitted", async () => {
    render(<Home />)

    fireEvent.click(screen.getByTestId("save-lesson"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-streaming-doc-default-lang"))
    })

    expect(mockCreateDocument).toHaveBeenCalled()
  })

  it("handles saved lessons without markdown using fallback values", async () => {
    const setDocuments = jest.fn()
    const storeState = { ...defaultStoreState(), setDocuments }
    ;(mockUseEditorStore as jest.Mock).mockReturnValue(storeState)
    mockUseSearchParams.mockReturnValue({ get: () => "lesson-no-markdown" })
    mockFetchDocuments.mockResolvedValue([makeDocument()])
    mockGetLessonById.mockResolvedValue({
      id: "lesson-no-markdown",
      markdown: "",
      requirements: baseRequirements,
      chatHistory: [],
    })

    render(<Home />)

    await waitFor(() => expect(mockGetLessonById).toHaveBeenCalledWith("lesson-no-markdown"))
    expect(setDocuments).toHaveBeenCalled()
  })

  it("handles missing saved lesson data gracefully", async () => {
    mockUseSearchParams.mockReturnValue({ get: () => "lesson-missing" })
    mockGetLessonById.mockResolvedValue(null)
    mockFetchDocuments.mockResolvedValue([makeDocument()])

    render(<Home />)

    await waitFor(() => expect(mockGetLessonById).toHaveBeenCalledWith("lesson-missing"))
    expect(mockUpdateLesson).not.toHaveBeenCalled()
  })

  it("logs diff apply failures without crashing", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("apply failed"))

    render(<Home />)

    fireEvent.click(screen.getByTestId("switch-to-chat"))
    fireEvent.click(screen.getByTestId("chat-set-diffs"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("apply-diff"))
    })

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it("logs apply-all errors and keeps state stable", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("apply all failed"))

    render(<Home />)

    fireEvent.click(screen.getByTestId("switch-to-chat"))
    fireEvent.click(screen.getByTestId("chat-set-diffs"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("apply-all-diffs"))
    })

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
