import { render } from "@testing-library/react"
import Home from "@/app/page"

const lessonPreviewMock = jest.fn()
const mockUseEditorStore = jest.fn()

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated" }),
}))

jest.mock("@/lib/settingsStorage", () => ({
  loadSettings: () => ({}),
}))

jest.mock("@/lib/api", () => ({
  generateLessonDraft: jest.fn(),
  getLessonById: jest.fn(),
  updateLesson: jest.fn(),
}))

jest.mock("@/lib/editor/api", () => ({
  fetchDocuments: jest.fn().mockResolvedValue([]),
  createDocument: jest.fn(),
  generateDocumentStream: jest.fn(),
  updateDocument: jest.fn(),
}))

jest.mock("@/stores/editorStore", () => {
  const mocked = (...args: unknown[]) => mockUseEditorStore(...args)
  mocked.setState = jest.fn()
  return {
    __esModule: true,
    useEditorStore: mocked,
  }
})

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock("@/components/layout/header", () => ({
  Header: () => <div data-testid="header" />,
}))

jest.mock("@/components/steam-agent/lesson-requirements-form", () => ({
  LessonRequirementsForm: () => <div data-testid="lesson-form" />,
}))

jest.mock("@/components/steam-agent/chat-panel", () => ({
  ChatPanel: () => <div data-testid="chat-panel" />,
}))

jest.mock("@/components/steam-agent/lesson-preview", () => ({
  LessonPreview: (props: any) => {
    lessonPreviewMock(props)
    return <div data-testid="lesson-preview" />
  },
}))

jest.mock("@/components/steam-agent/bottom-action-bar", () => ({
  BottomActionBar: () => <div data-testid="bottom-bar" />,
}))

jest.mock("@/components/editor/new-document-dialog", () => ({
  NewDocumentDialog: () => <div data-testid="new-doc-dialog" />,
}))

describe("Home streaming preview integration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("feeds the store markdown into the preview while streaming without toggling lesson loading", () => {
    mockUseEditorStore.mockReturnValue({
      documents: [
        {
          id: "doc-1",
          name: "Doc 1",
          type: "lesson",
          content: "store markdown",
          blocks: [],
          isDirty: false,
          createdAt: new Date(),
        },
      ],
      markdown: "store markdown",
      activeDocId: "doc-1",
      streamingDocId: "doc-1",
      setDocuments: jest.fn(),
      addDocument: jest.fn(),
      updateDocumentContent: jest.fn(),
      appendDocumentContent: jest.fn(),
      setStreamingDocId: jest.fn(),
    })

    render(<Home />)

    expect(lessonPreviewMock).toHaveBeenCalled()
    const lastProps = lessonPreviewMock.mock.calls[lessonPreviewMock.mock.calls.length - 1]?.[0]
    expect(lastProps.lesson).toBe("store markdown")
    expect(lastProps.isDocumentStreaming).toBe(true)
    expect(lastProps.isGenerating).toBe(false)
  })
})
