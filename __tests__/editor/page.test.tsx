"use client"

import { act, render, waitFor } from "@testing-library/react"
import { Suspense } from "react"
import EditorPage from "@/app/editor/[lessonId]/page"
import type { EditorDocument } from "@/lib/editor/types"
import { useAutoSave as mockedUseAutoSave } from "@/hooks/useAutoSave"
import { useEditorStore as mockedUseEditorStore } from "@/stores/editorStore"

const mockUseAutoSave = mockedUseAutoSave as jest.MockedFunction<typeof mockedUseAutoSave>
const mockUseEditorStore = jest.fn()
const mockFetchDocuments = jest.fn()
const mockCreateDocument = jest.fn()

jest.mock("@/hooks/useAutoSave", () => ({
  useAutoSave: jest.fn(),
}))

jest.mock("@/lib/editor/api", () => ({
  fetchDocuments: (...args: unknown[]) => mockFetchDocuments(...args),
  createDocument: (...args: unknown[]) => mockCreateDocument(...args),
}))

jest.mock("@/stores/editorStore", () => {
  const mocked = (...args: unknown[]) => mockUseEditorStore(...args)
  mocked.getState = jest.fn()
  mocked.setState = jest.fn()
  return {
    __esModule: true,
    useEditorStore: mocked,
  }
})

jest.mock("@/components/editor/document-tabs", () => ({
  DocumentTabs: ({ onAddDocument }: any) => (
    <div data-testid="document-tabs">
      <button data-testid="add-doc" onClick={() => onAddDocument?.()}>
        add
      </button>
    </div>
  ),
}))

jest.mock("@/components/editor/DiffViewer", () => ({
  DiffViewer: () => <div data-testid="diff-viewer" />,
}))

jest.mock("@/components/editor/EditorChatPanel", () => ({
  EditorChatPanel: () => <div data-testid="editor-chat" />,
}))

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

jest.mock("@/components/ui/textarea", () => ({
  Textarea: ({ ...props }: any) => <textarea {...props} />,
}))

jest.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}))

jest.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: any) => <div>{children}</div>,
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizableHandle: ({ children }: any) => <div>{children}</div>,
}))

jest.mock("lucide-react", () => ({
  Undo2: () => null,
  Redo2: () => null,
  Save: () => null,
  Loader2: () => null,
  History: () => null,
  Plus: () => null,
}))

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
  },
}))

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
  markdown: "editor markdown",
  blocks: [],
  pendingDiffs: [],
  documents: [makeDocument()],
  activeDocId: "doc-1",
  streamingDocId: "stream-id",
  setLessonId: jest.fn(),
  setMarkdown: jest.fn(),
  setDocuments: jest.fn(),
  addDocument: jest.fn(),
  updateDocumentContent: jest.fn(),
  undo: jest.fn(),
  redo: jest.fn(),
  canUndo: jest.fn(() => false),
  canRedo: jest.fn(() => false),
  applyDiff: jest.fn(),
  rejectDiff: jest.fn(),
  applyAllDiffs: jest.fn(),
  rejectAllDiffs: jest.fn(),
  isSaving: false,
  setSaving: jest.fn(),
  reset: jest.fn(),
})

describe("Editor page auto-save integration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAutoSave.mockClear()
    const storeState = defaultStoreState()
    mockUseEditorStore.mockReturnValue(storeState)
    ;(mockedUseEditorStore as any).getState = jest.fn(() => storeState)
    ;(mockedUseEditorStore as any).setState = jest.fn()
    mockFetchDocuments.mockResolvedValue([makeDocument()])
    mockCreateDocument.mockResolvedValue(makeDocument({ id: "new-doc" }))
  })

  it("passes lesson context into useAutoSave once initialized", async () => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <EditorPage params={Promise.resolve({ lessonId: "lesson-123" })} />
        </Suspense>
      )
    })

    await waitFor(() => {
      expect(mockUseAutoSave).toHaveBeenCalledWith(
        expect.objectContaining({
          currentLesson: "editor markdown",
          currentRequirements: null,
          currentLessonId: "lesson-123",
          streamingDocId: "stream-id",
          enabled: true,
        }),
      )
    })
  })
})
