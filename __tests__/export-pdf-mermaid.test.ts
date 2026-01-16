import React from "react"
import { TextEncoder as NodeTextEncoder } from "util"

type PdfSnapshot = { texts: string[]; images: string[] }

if (typeof global.TextEncoder === "undefined") {
  ;(global as typeof globalThis).TextEncoder = NodeTextEncoder as typeof TextEncoder
}

if (typeof global.btoa === "undefined") {
  ;(global as typeof globalThis).btoa = (input: string) => Buffer.from(input, "binary").toString("base64")
}

// Mock browser APIs for canvas rendering
const mockToDataURL = jest.fn(() => "data:image/png;base64,mockPngData")
const mockGetContext = jest.fn(() => ({
  fillStyle: "",
  fillRect: jest.fn(),
  scale: jest.fn(),
  drawImage: jest.fn(),
}))

global.URL.createObjectURL = jest.fn(() => "blob:mock-url")
global.URL.revokeObjectURL = jest.fn()

// Mock Image
;(global as any).Image = class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ""
  width = 800
  height = 600

  get src() {
    return this._src
  }

  set src(value: string) {
    this._src = value
    if (value) {
      setTimeout(() => this.onload?.(), 0)
    }
  }
}

// Mock document.createElement for canvas
const originalCreateElement = document.createElement.bind(document)
document.createElement = ((tagName: string) => {
  if (tagName === "canvas") {
    return {
      width: 0,
      height: 0,
      getContext: mockGetContext,
      toDataURL: mockToDataURL,
    }
  }
  return originalCreateElement(tagName)
}) as typeof document.createElement

function collectSnapshot(node: any, snapshot: PdfSnapshot) {
  if (node == null || typeof node === "boolean") return
  if (Array.isArray(node)) {
    for (const child of node) collectSnapshot(child, snapshot)
    return
  }
  if (typeof node === "string" || typeof node === "number") {
    snapshot.texts.push(String(node))
    return
  }
  if (React.isValidElement(node)) {
    const props = (node as any).props || {}
    if (typeof props.src === "string") snapshot.images.push(props.src)
    collectSnapshot(props.children, snapshot)
  } else if (typeof node === "object" && (node as any).props) {
    const props = (node as any).props || {}
    if (typeof props.src === "string") snapshot.images.push(props.src)
    collectSnapshot(props.children, snapshot)
  }
}

describe("PDF export with mermaid diagrams", () => {
  beforeEach(() => {
    jest.resetModules()
    mockToDataURL.mockClear()
    mockGetContext.mockClear()
  })

  const setup = async () => {
    let appliedMermaidConfig: any
    let mermaidRenderMock: jest.Mock
    let lastDoc: any

    jest.doMock("@react-pdf/renderer", () => {
      const wrap = (tag: string) => {
        const C = ({ children, ...props }: any) => React.createElement(tag, props, children)
        C.displayName = tag
        return C
      }
      const Image = (props: any) => React.createElement("img", props)

      return {
        Document: wrap("Document"),
        Page: wrap("Page"),
        Text: wrap("Text"),
        View: wrap("View"),
        Image,
        pdf: (doc: any) => ({
          toBuffer: async () => {
            lastDoc = doc
            const snapshot: PdfSnapshot = { texts: [], images: [] }
            collectSnapshot(doc, snapshot)
            return Buffer.from(JSON.stringify(snapshot), "utf8")
          },
        }),
      }
    })

    jest.doMock("mermaid", () => {
      const initialize = jest.fn((config: unknown) => {
        appliedMermaidConfig = config
      })
      mermaidRenderMock = jest.fn(async (_id: string, chart: string) => {
        const font = (appliedMermaidConfig as any)?.themeVariables?.fontFamily ?? "unset"
        return {
          svg: `<svg><style>.node{font-family:${font};}</style><text>${chart}</text></svg>`,
        }
      })

      return {
        __esModule: true,
        default: { initialize, render: mermaidRenderMock },
      }
    })

    const { replaceMermaidBlocksWithImages, MERMAID_FALLBACK_FONT_STACK } = await import("@/lib/api")
    const { parseMarkdownToLesson } = await import("@/lib/export/parser")
    const { generatePdf } = await import("@/lib/export/pdf/generator")

    const runPipeline = async (markdown: string): Promise<{ snapshot: PdfSnapshot; preparedMarkdown: string; lesson: ReturnType<typeof parseMarkdownToLesson> }> => {
      // 客户端已将 Mermaid 渲染为 PNG，无需服务端转换
      const withPngImages = await replaceMermaidBlocksWithImages(markdown)
      const lesson = parseMarkdownToLesson(withPngImages)
      const buffer = await generatePdf(lesson, "detailed", true)
      return {
        snapshot: JSON.parse(buffer.toString("utf8")) as PdfSnapshot,
        preparedMarkdown: withPngImages,
        lesson,
      }
    }

    return {
      runPipeline,
      mermaidRenderMock: () => mermaidRenderMock,
      fontStack: MERMAID_FALLBACK_FONT_STACK,
      getDoc: () => lastDoc,
    }
  }

  it("exports a single mermaid block to a PDF image", async () => {
    const { runPipeline, mermaidRenderMock, getDoc } = await setup()

    const markdown = [
      "# Diagram Lesson",
      "## Flow",
      "```mermaid",
      "graph TD",
      "    A[开始] --> B[流程图]",
      "```",
    ].join("\n")

    const { snapshot, preparedMarkdown, lesson } = await runPipeline(markdown)

    expect(mermaidRenderMock()).toHaveBeenCalledTimes(1)
    expect(preparedMarkdown).toContain("data:image/png;base64")
    expect(JSON.stringify(getDoc() || "")).toContain("data:image/png;base64")
    expect(
      lesson.sections.some(section =>
        section.content.includes("data:image/png;base64"),
      ),
    ).toBe(true)
    expect(snapshot.images).toHaveLength(1)
    expect(snapshot.images[0]).toContain("data:image/png;base64")
  })

  it("handles multiple mermaid blocks and renders each as a separate image", async () => {
    const { runPipeline, mermaidRenderMock, getDoc } = await setup()

    const markdown = [
      "# Multi Diagram Lesson",
      "## First",
      "```mermaid",
      "graph LR",
      "    X --> Y",
      "```",
      "## Second",
      "```mermaid",
      "sequenceDiagram",
      "    participant A as 用户A",
      "    participant B as 系统B",
      "    A->>B: 请求",
      "```",
    ].join("\n")

    const { snapshot, preparedMarkdown, lesson } = await runPipeline(markdown)

    expect(mermaidRenderMock()).toHaveBeenCalledTimes(2)
    expect(preparedMarkdown.match(/data:image\/png;base64/g)?.length).toBe(2)
    expect(JSON.stringify(getDoc() || "")).toContain("data:image/png;base64")
    expect(
      lesson.sections.flatMap(section =>
        (section.content.match(/!\[Mermaid Diagram[^\]]*\]\(data:image\/png[^)]+\)/g) || []).map(match => match),
      ).length,
    ).toBe(2)
    expect(snapshot.images).toHaveLength(2)
  })
})
