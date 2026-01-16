import { render, screen, fireEvent } from "@testing-library/react"
import Home from "@/app/page"
import { Header } from "@/components/layout/header"
import { useSession, signOut } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAutoSave } from "@/hooks/useAutoSave"
import { useEditorStore } from "@/stores/editorStore"

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}))

jest.mock("@/hooks/useAutoSave", () => ({
  useAutoSave: jest.fn(),
}))

jest.mock("@/stores/editorStore", () => ({
  useEditorStore: jest.fn(),
}))

jest.mock("@/components/steam-agent/lesson-requirements-form", () => ({
  LessonRequirementsForm: () => <div data-testid="lesson-form" />,
}))

jest.mock("@/components/steam-agent/lesson-preview", () => ({
  LessonPreview: () => <div data-testid="lesson-preview" />,
}))

jest.mock("@/components/steam-agent/chat-panel", () => ({
  ChatPanel: () => <div data-testid="chat-panel" />,
}))

jest.mock("@/components/steam-agent/bottom-action-bar", () => ({
  BottomActionBar: () => <div data-testid="bottom-bar" />,
}))

jest.mock("@/components/editor/new-document-dialog", () => ({
  NewDocumentDialog: () => <div data-testid="new-doc-dialog" />,
}))

jest.mock("@/lib/settingsStorage", () => ({
  loadSettings: jest.fn(() => ({})),
}))

jest.mock("@/lib/api", () => ({
  generateLessonDraft: jest.fn(),
  getLessonById: jest.fn(),
  updateLesson: jest.fn(),
}))

jest.mock("@/lib/editor/api", () => ({
  fetchDocuments: jest.fn(),
  createDocument: jest.fn(),
  generateDocumentStream: jest.fn(),
}))

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const mockUseSession = useSession as jest.Mock
const mockSignOut = signOut as jest.Mock
const mockUseSearchParams = useSearchParams as jest.Mock
const mockUseRouter = useRouter as jest.Mock
const mockUseAutoSave = useAutoSave as jest.Mock
const mockUseEditorStore = useEditorStore as jest.Mock

const baseStoreState = {
  documents: [],
  markdown: "",
  activeDocId: null,
  streamingDocId: null,
  setDocuments: jest.fn(),
  addDocument: jest.fn(),
  updateDocumentContent: jest.fn(),
  appendDocumentContent: jest.fn(),
  setStreamingDocId: jest.fn(),
}

describe("client auth redirect cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSearchParams.mockReturnValue({ get: () => null })
    mockUseRouter.mockReturnValue({ push: jest.fn() })
    mockUseEditorStore.mockReturnValue({ ...baseStoreState })
  })

  it("does not trigger client redirects when unauthenticated", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null })

    render(<Home />)

    expect(mockUseRouter).not.toHaveBeenCalled()
    expect(mockUseAutoSave).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    )
  })

  it("renders authenticated UI and admin navigation in the header", () => {
    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: { user: { name: "Jamie", role: "admin" } },
    })

    const { container } = render(
      <Header lang="en" onLangChange={jest.fn()} />,
    )

    expect(screen.getByText("Welcome, Jamie")).toBeInTheDocument()
    expect(container.querySelector('a[href="/admin"]')).toBeInTheDocument()
  })

  it("does not show admin navigation for non-admin users", () => {
    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: { user: { name: "Alex", role: "user" } },
    })

    const { container } = render(
      <Header lang="en" onLangChange={jest.fn()} />,
    )

    expect(screen.getByText("Welcome, Alex")).toBeInTheDocument()
    expect(container.querySelector('a[href="/admin"]')).toBeNull()
  })

  it("invokes signOut from the header", () => {
    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: { user: { name: "Alex", role: "user" } },
    })

    render(<Header lang="en" onLangChange={jest.fn()} />)

    fireEvent.click(screen.getByTitle("Logout"))

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/auth/login" })
  })

  it("shows the back button and custom title when configured", () => {
    mockUseSession.mockReturnValue({ status: "authenticated", data: null })

    const { container } = render(
      <Header lang="en" onLangChange={jest.fn()} title="Settings" showBackButton />,
    )

    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(container.querySelector('a[href="/"]')).toBeInTheDocument()
  })
})
