import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { MarkdownEditor } from "@/components/markdown-editor"

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children, components }: any) => {
    const content = typeof children === "string" ? children : Array.isArray(children) ? children.join("\n") : ""
    const elements: any[] = []
    const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/)

    if (mermaidMatch && components?.code) {
      elements.push(
        <div key="mermaid">
          {components.code({
            className: "language-mermaid",
            children: mermaidMatch[1],
          })}
        </div>,
      )
    }
    if (components?.code) {
      elements.push(
        <div key="plain-code">
          {components.code({
            className: "language-js",
            children: "const a = 1;",
          })}
        </div>,
      )
    }

    if (components?.pre) {
      elements.push(
        <div key="pre-mermaid">
          {components.pre({ children: <code className="language-mermaid">diagram</code> })}
        </div>,
      )
      elements.push(
        <div key="pre-plain">
          {components.pre({ children: <code className="language-plaintext">plain</code> })}
        </div>,
      )
    }

    const textContent = content.replace(/```mermaid[\s\S]*?```/, "").replace(/^#+\s?/gm, "").trim()
    elements.push(
      <div key="text" data-testid="markdown-text">
        {textContent}
      </div>,
    )

    return <div data-testid="react-markdown">{elements}</div>
  },
}))
jest.mock("remark-gfm", () => () => null)
jest.mock("rehype-raw", () => () => null)

const wysiwygMock = jest.fn()
jest.mock("@/components/wysiwyg-editor", () => ({
  __esModule: true,
  WysiwygEditor: (props: any) => {
    wysiwygMock(props)
    return (
      <div data-testid="wysiwyg-stub" data-placeholder={props.placeholder} data-lang={props.lang} data-classname={props.className}>
        <button onClick={() => props.onChange("next draft")}>emit-change</button>
        <button onClick={() => props.onChange(props.value)}>emit-value</button>
      </div>
    )
  },
}))

const mermaidMock = jest.fn()
jest.mock("@/components/mermaid-diagram", () => ({
  __esModule: true,
  MermaidDiagram: (props: any) => {
    mermaidMock(props)
    return <div data-testid="mermaid-diagram">{props.chart}</div>
  },
}))

describe("MarkdownEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the Vditor-backed editor in editing mode and forwards changes", async () => {
    const onChange = jest.fn()
    const user = userEvent.setup()

    render(
      <MarkdownEditor
        value="# Title"
        onChange={onChange}
        isEditing
        isExpanded
        placeholder="Start here"
        lang="en"
        onToggleEdit={jest.fn()}
      />,
    )

    expect(screen.getByTestId("wysiwyg-stub")).toBeInTheDocument()
    expect(screen.getByTestId("wysiwyg-stub")).toHaveAttribute("data-placeholder", "Start here")
    expect(screen.getByTestId("wysiwyg-stub")).toHaveAttribute("data-lang", "en")

    const lastCall = wysiwygMock.mock.calls[wysiwygMock.mock.calls.length - 1]?.[0]
    expect(lastCall).toMatchObject({
      value: "# Title",
      placeholder: "Start here",
    })
    expect(lastCall.className).toContain("h-full")

    await user.click(screen.getByRole("button", { name: "emit-change" }))
    expect(onChange).toHaveBeenCalledWith("next draft")
  })

  it("shows preview mode with collapsible sections and mermaid diagrams", async () => {
    const user = userEvent.setup()
    const value = [
      "# Lesson Plan",
      "Intro paragraph explaining the overview.",
      "## Section One",
      "Details for the first section.",
      "```mermaid",
      "flowchart TD",
      "A-->B",
      "```",
      "## Section Two",
      "Follow-up details.",
      "## Section Three",
      "Third body.",
      "## Section Four",
      "Hidden until expanded.",
    ].join("\n")

    render(
      <MarkdownEditor
        value={value}
        onChange={jest.fn()}
        isEditing={false}
        isExpanded={false}
      />,
    )

    expect(screen.getByText(/Lesson Plan/)).toBeInTheDocument()
    expect(screen.getByText("Section One")).toBeInTheDocument()
    expect(screen.getByText("Section Two")).toBeInTheDocument()
    expect(screen.getByText("Section Three")).toBeInTheDocument()
    expect(screen.getByText("Section Four")).toBeInTheDocument()

    expect(screen.getByText("Details for the first section.")).toBeInTheDocument()
    expect(screen.getByText("Follow-up details.")).toBeInTheDocument()
    expect(screen.getByText("Third body.")).toBeInTheDocument()
    expect(screen.queryByText("Hidden until expanded.")).not.toBeInTheDocument()

    const mermaid = screen.getByTestId("mermaid-diagram")
    expect(mermaid).toHaveTextContent(/flowchart TD\s*A-->B/)
    expect(mermaidMock).toHaveBeenCalledWith(expect.objectContaining({ chart: "flowchart TD\nA-->B" }))

    const toggle = screen.getByRole("button", { name: /Section One/ })
    await user.click(toggle)
    expect(screen.queryByText("Details for the first section.")).not.toBeInTheDocument()
    await user.click(toggle)
    expect(screen.getByText("Details for the first section.")).toBeInTheDocument()

    const fourthToggle = screen.getByRole("button", { name: /Section Four/ })
    await user.click(fourthToggle)
    expect(screen.getByText("Hidden until expanded.")).toBeInTheDocument()
  })

  it("invokes expand/edit controls when expanded", async () => {
    const onToggleExpand = jest.fn()
    const onToggleEdit = jest.fn()
    const user = userEvent.setup()

    render(
      <MarkdownEditor
        value="Preview only"
        onChange={jest.fn()}
        isEditing={false}
        isExpanded
        onToggleExpand={onToggleExpand}
        onToggleEdit={onToggleEdit}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Collapse editor" }))
    await user.click(screen.getByRole("button", { name: "Edit content" }))

    expect(onToggleExpand).toHaveBeenCalledTimes(1)
    expect(onToggleEdit).toHaveBeenCalledTimes(1)
  })

  it("passes mermaid fences through when edits occur", async () => {
    const onChange = jest.fn()
    const user = userEvent.setup()
    render(
      <MarkdownEditor
        value="```mermaid\nflowchart LR\nA-->B\n```"
        onChange={onChange}
        isEditing
        isExpanded={false}
      />,
    )

    await user.click(screen.getByRole("button", { name: "emit-value" }))
    const emitted = onChange.mock.calls[0][0]
    expect(emitted).toContain("```mermaid")
    expect(emitted).toContain("flowchart LR")
    expect(emitted).toContain("A-->B")
  })
})
