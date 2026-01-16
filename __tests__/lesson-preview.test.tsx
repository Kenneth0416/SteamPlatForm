import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { LessonPreview } from "@/components/steam-agent/lesson-preview"
import { getTranslation } from "@/lib/translations"
import { useEditorStore } from "@/stores/editorStore"

const markdownEditorMock = jest.fn()
jest.mock("@/components/markdown-editor", () => ({
  __esModule: true,
  MarkdownEditor: (props: any) => {
    markdownEditorMock(props)
    return (
      <div data-testid="markdown-editor" data-value={props.value}>
        <button onClick={() => props.onChange("updated markdown")}>emit-change</button>
        <button onClick={props.onToggleExpand}>call-toggle-expand</button>
        <button onClick={props.onToggleEdit}>call-toggle-edit</button>
      </div>
    )
  },
}))

const documentTabsMock = jest.fn()
jest.mock("@/components/editor/document-tabs", () => ({
  __esModule: true,
  DocumentTabs: (props: any) => {
    documentTabsMock(props)
    return <div data-testid="document-tabs">tabs</div>
  },
}))

jest.mock("@/lib/translations", () => ({
  __esModule: true,
  getTranslation: jest.fn(),
}))

jest.mock("@/stores/editorStore", () => ({
  __esModule: true,
  useEditorStore: jest.fn(),
}))

describe("LessonPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getTranslation as jest.Mock).mockReturnValue({
      previewTitle: "Preview",
      emptyStateTitle: "Empty",
      emptyStateDescription: "Describe",
      generating: "Generating...",
      streaming: "Streaming...",
    })
    ;(useEditorStore as jest.Mock).mockReturnValue({ documents: [] })
  })

  it("renders the loading card when generating", () => {
    render(
      <LessonPreview
        lang="en"
        lesson="# draft"
        isGenerating
        isDocumentStreaming
      />,
    )

    expect(screen.getByText("Generating...")).toBeInTheDocument()
    expect(screen.queryByTestId("markdown-editor")).not.toBeInTheDocument()
  })

  it("shows markdown and streaming indicator while documents stream", async () => {
    const onLessonUpdate = jest.fn()
    ;(useEditorStore as jest.Mock).mockReturnValue({ documents: [{ id: "doc-1" }] })
    const user = userEvent.setup()

    render(
      <LessonPreview
        lang="en"
        lesson="Partial document"
        isGenerating={false}
        isDocumentStreaming
        onLessonUpdate={onLessonUpdate}
        onAddDocument={jest.fn()}
      />,
    )

    expect(screen.getByTestId("markdown-editor")).toHaveAttribute("data-value", "Partial document")
    expect(screen.getByTestId("document-streaming-indicator")).toHaveTextContent("Streaming...")
    expect(documentTabsMock).toHaveBeenCalledWith(expect.objectContaining({ onAddDocument: expect.any(Function) }))
    const card = document.querySelector('[data-document-streaming]')
    expect(card).toHaveAttribute("data-document-streaming", "true")

    await user.click(screen.getByRole("button", { name: "emit-change" }))
    expect(onLessonUpdate).toHaveBeenCalledWith("updated markdown")
  })

  it("renders empty state when there is no content and not streaming", () => {
    render(
      <LessonPreview
        lang="en"
        lesson=""
        isGenerating={false}
        isDocumentStreaming={false}
      />,
    )

    expect(screen.getByText("Empty")).toBeInTheDocument()
    expect(screen.queryByTestId("markdown-editor")).not.toBeInTheDocument()
    const card = document.querySelector('[data-document-streaming]')
    expect(card).toBeNull()
  })

  it("keeps the preview visible while streaming empty markdown", () => {
    render(
      <LessonPreview
        lang="en"
        lesson=""
        isGenerating={false}
        isDocumentStreaming
      />,
    )

    expect(screen.getByTestId("markdown-editor")).toHaveAttribute("data-value", "")
    expect(screen.getByTestId("document-streaming-indicator")).toBeInTheDocument()
    expect(screen.queryByText("Empty")).not.toBeInTheDocument()
    const card = document.querySelector('[data-document-streaming]')
    expect(card).toHaveAttribute("data-document-streaming", "true")
  })

  it("allows editing and expansion toggles from header and editor callbacks", async () => {
    const user = userEvent.setup()

    render(
      <LessonPreview
        lang="en"
        lesson="# Draft content"
        isGenerating={false}
        isDocumentStreaming={false}
      />,
    )

    const iconButtons = Array.from(screen.getAllByRole("button")).filter(button => button.textContent === "")
    expect(iconButtons).toHaveLength(2)

    await user.click(iconButtons[0])
    await user.click(iconButtons[1])

    let lastProps = markdownEditorMock.mock.calls[markdownEditorMock.mock.calls.length - 1]?.[0]
    expect(lastProps?.isExpanded).toBe(true)
    expect(lastProps?.isEditing).toBe(true)

    await user.click(screen.getByRole("button", { name: "call-toggle-expand" }))
    await user.click(screen.getByRole("button", { name: "call-toggle-edit" }))

    lastProps = markdownEditorMock.mock.calls[markdownEditorMock.mock.calls.length - 1]?.[0]
    expect(lastProps?.isExpanded).toBe(false)
    expect(lastProps?.isEditing).toBe(false)
  })
})
