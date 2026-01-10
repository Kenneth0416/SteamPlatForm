import { MERMAID_FALLBACK_FONT_STACK, replaceMermaidBlocksWithImages } from "@/lib/api"
import { TextEncoder as NodeTextEncoder } from "util"

if (typeof global.TextEncoder === "undefined") {
  ;(global as typeof globalThis).TextEncoder = NodeTextEncoder as typeof TextEncoder
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

const initializeMock = jest.fn()
const renderMock = jest.fn()

let appliedConfig: any

jest.mock("mermaid", () => ({
  __esModule: true,
  default: {
    initialize: (config: unknown) => initializeMock(config),
    render: (...args: any[]) => renderMock(...args),
  },
}))

describe("replaceMermaidBlocksWithImages", () => {
  let nowSpy: jest.SpyInstance<number, []>

  beforeEach(() => {
    appliedConfig = undefined
    initializeMock.mockImplementation(config => {
      appliedConfig = config
    })
    renderMock.mockImplementation(async (_id: string, chart: string) => {
      const font = appliedConfig?.themeVariables?.fontFamily ?? "unset"
      return {
        svg: `<svg><style>.text{font-family:${font};}</style><text>${chart}</text></svg>`,
      }
    })
    nowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000)
    initializeMock.mockClear()
    renderMock.mockClear()
  })

  afterEach(() => {
    nowSpy.mockRestore()
  })

  it("applies the bundled fallback font stack to mermaid output", async () => {
    const result = await replaceMermaidBlocksWithImages(
      "Intro\n```mermaid\nflowchart TD;A-->B;\n```",
    )

    expect(initializeMock).toHaveBeenCalledTimes(1)
    expect(appliedConfig?.themeVariables).toMatchObject({
      fontFamily: MERMAID_FALLBACK_FONT_STACK,
      fontFamilyMono: MERMAID_FALLBACK_FONT_STACK,
      fontFamilySecondary: MERMAID_FALLBACK_FONT_STACK,
    })
    expect(renderMock).toHaveBeenCalledTimes(1)
    expect(renderMock).toHaveBeenCalledWith("export-mermaid-1700000000000-0", "flowchart TD;A-->B;")

    // 现在输出是 PNG data URL，alt 包含尺寸信息
    expect(result).toContain("data:image/png;base64,mockPngData")
    expect(result).toContain("![Mermaid Diagram|")
  })

  it("skips empty mermaid blocks without rendering", async () => {
    const markdown = "No chart here\n```mermaid\n   \n```"
    const result = await replaceMermaidBlocksWithImages(markdown)

    expect(renderMock).not.toHaveBeenCalled()
    expect(result).toContain("```mermaid\n   \n```")
  })
})
