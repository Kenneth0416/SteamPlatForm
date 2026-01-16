/** @jest-environment node */

import type { ExportLesson } from "@/lib/export/types"
import React from "react"

type PdfSnapshot = { texts: string[]; images: string[] }

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
  if (typeof node === "object" && node.props) {
    if (typeof node.props.src === "string") snapshot.images.push(node.props.src)
    collectSnapshot(node.props.children, snapshot)
  }
}

function mockReactPdfRenderer() {
  const wrap = (tag: string) => {
    const C = ({ children, ...props }: any) => React.createElement(tag, props, children)
    C.displayName = tag
    return C
  }

  const Image = (props: any) => React.createElement("img", props)

  const pdf = (doc: any) => ({
    toBuffer: async () => {
      const snapshot: PdfSnapshot = { texts: [], images: [] }
      collectSnapshot(doc, snapshot)
      return Buffer.from(JSON.stringify(snapshot), "utf8")
    },
  })

  return {
    Document: wrap("Document"),
    Page: wrap("Page"),
    Text: wrap("Text"),
    View: wrap("View"),
    Image,
    pdf,
  }
}

function baseLesson(): ExportLesson {
  return {
    title: "Lesson Title",
    overview: "",
    gradeLevel: "",
    subject: "",
    duration: "",
    objectives: [],
    materials: [],
    sections: [],
    activities: [],
    assessment: [],
    standards: [],
  }
}

describe("generatePdf (mocked renderer)", () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it("covers tables, bullets, ordered lists, section items, and image handling", async () => {
    jest.doMock("@react-pdf/renderer", () => mockReactPdfRenderer())
    const { generatePdf } = await import("@/lib/export/pdf/generator")

    const lesson: ExportLesson = {
      ...baseLesson(),
      title: "Lesson Title",
      gradeLevel: "3",
      subject: "Science",
      duration: "45 min",
      activities: ["Do the thing"],
      assessment: ["Exit ticket"],
      sections: [
        { title: "Overview", content: "Should be filtered", items: [] },
        {
          title: "Custom Section",
          content: [
            "Paragraph line",
            "",
            "| A | B |",
            "| - | - |",
            "",
            "- Bullet item",
            "1. Ordered item",
            "![alt](https://example.com/image-only.png)",
            "Text before ![inline](https://example.com/inline.png) text after",
          ].join("\n"),
          items: ["Extra item"],
        },
      ],
    }

    const buffer = await generatePdf(lesson, "detailed", true)
    const snapshot = JSON.parse(buffer.toString("utf8")) as PdfSnapshot

    expect(snapshot.images).toEqual(
      expect.arrayContaining([
        "https://example.com/image-only.png",
        "https://example.com/inline.png",
      ]),
    )

    const text = snapshot.texts.join("\n")
    expect(text).toContain("Custom Section")
    expect(text).toContain("| A | B |")
    expect(text).toContain("Bullet item")
    expect(text).toContain("Ordered item")
    expect(text).toContain("Extra item")

    expect(text).not.toContain("Should be filtered")
  })

  it("renders inline markdown styles and uses alt text when images are excluded", async () => {
    jest.doMock("@react-pdf/renderer", () => mockReactPdfRenderer())
    const { generatePdf } = await import("@/lib/export/pdf/generator")

    const lesson: ExportLesson = {
      ...baseLesson(),
      title: "Inline Styles",
      overview:
        "Intro with **Bold** _Italic_ `Code` ~~Strike~~ and [Link](https://example.com). " +
        "Before ![Alt Text](https://example.com/inline.png) after.",
      objectives: ["![Only](https://example.com/objective.png)"],
    }

    const buffer = await generatePdf(lesson, "standard", false)
    const snapshot = JSON.parse(buffer.toString("utf8")) as PdfSnapshot

    const text = snapshot.texts.join("\n")
    expect(text).toContain("Bold")
    expect(text).toContain("Italic")
    expect(text).toContain("Code")
    expect(text).toContain("Strike")
    expect(text).toContain("Link (https://example.com)")
    expect(text).toContain("Alt Text")
    expect(snapshot.images).toHaveLength(0)
  })

  it("handles code blocks, tables, and image-only lines", async () => {
    jest.doMock("@react-pdf/renderer", () => mockReactPdfRenderer())
    const { generatePdf } = await import("@/lib/export/pdf/generator")

    const lesson: ExportLesson = {
      ...baseLesson(),
      title: "Complex Content",
      objectives: ["![Only](https://example.com/objective.png)"],
      sections: [
        {
          title: "Blocks",
          content: [
            "```mermaid",
            "graph TD",
            "A-->B",
            "```",
            "```js",
            "const a = 1",
            "```",
            "| A | B |",
            "| - | - |",
            "![Portrait|200:500](https://example.com/portrait.png)",
            "- Bullet with ![Inline|200:500](https://example.com/inline.png) text",
            "1. Ordered *item*",
          ].join("\n"),
          items: ["![Item Image](https://example.com/item.png)"],
        },
      ],
    }

    const buffer = await generatePdf(lesson, "detailed", true)
    const snapshot = JSON.parse(buffer.toString("utf8")) as PdfSnapshot

    expect(snapshot.images).toEqual(
      expect.arrayContaining([
        "https://example.com/objective.png",
        "https://example.com/portrait.png",
        "https://example.com/inline.png",
        "https://example.com/item.png",
      ]),
    )

    const text = snapshot.texts.join("\n")
    expect(text).toContain("[Mermaid Diagram]")
    expect(text).toContain("const a = 1")
    expect(text).toContain("| A | B |")
    expect(text).toContain("Ordered")
    expect(text).toContain("item")
  })

  it("registers the PDF font when the renderer exposes Font.register", async () => {
    const register = jest.fn()
    jest.doMock("@react-pdf/renderer", () => ({
      ...mockReactPdfRenderer(),
      Font: { register },
    }))

    const { generatePdf } = await import("@/lib/export/pdf/generator")
    await generatePdf(baseLesson(), "standard", false)

    expect(register).toHaveBeenCalled()
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        family: "NotoSansTC",
        fonts: expect.arrayContaining([
          expect.objectContaining({
            src: expect.stringContaining("NotoSansTC-Regular.ttf"),
          }),
        ]),
      }),
    )
  })

  it("renders Traditional Chinese title, paragraph, lists, and mixed characters", async () => {
    jest.doMock("@react-pdf/renderer", () => mockReactPdfRenderer())
    const { generatePdf } = await import("@/lib/export/pdf/generator")

    const lesson: ExportLesson = {
      ...baseLesson(),
      title: "繁體中文標題",
      overview: "這是一段繁體中文內容，混合简体中文與繁體中文。",
      objectives: ["理解傳統字形", "比較繁體與简体差異"],
      sections: [
        {
          title: "課堂活動",
          content: [
            "段落：繁體中文測試內容。",
            "- 小組討論傳統文化",
            "1. 完成練習",
          ].join("\n"),
          items: ["整理學習筆記"],
        },
      ],
    }

    const buffer = await generatePdf(lesson, "detailed", false)
    const snapshot = JSON.parse(buffer.toString("utf8")) as PdfSnapshot

    const text = snapshot.texts.join("\n")
    expect(text).toContain("繁體中文標題")
    expect(text).toContain("這是一段繁體中文內容，混合简体中文與繁體中文。")
    expect(text).toContain("理解傳統字形")
    expect(text).toContain("比較繁體與简体差異")
    expect(text).toContain("段落：繁體中文測試內容。")
    expect(text).toContain("小組討論傳統文化")
    expect(text).toContain("完成練習")
    expect(text).toContain("整理學習筆記")
  })

  it("normalizes unknown templates and renders minimal layout output", async () => {
    jest.doMock("@react-pdf/renderer", () => mockReactPdfRenderer())
    const { generatePdf } = await import("@/lib/export/pdf/generator")

    const lesson: ExportLesson = {
      ...baseLesson(),
      title: "Minimal Template",
      assessment: ["評量：完成任務"],
    }

    const minimalBuffer = await generatePdf(lesson, "minimal", false)
    const minimalSnapshot = JSON.parse(minimalBuffer.toString("utf8")) as PdfSnapshot
    expect(minimalSnapshot.texts.join("\n")).toContain("評量：完成任務")

    const normalizedBuffer = await generatePdf(lesson, "unknown" as any, false)
    const normalizedSnapshot = JSON.parse(normalizedBuffer.toString("utf8")) as PdfSnapshot
    const normalizedText = normalizedSnapshot.texts.join("\n")
    expect(normalizedText).toContain("Template:")
    expect(normalizedText).toContain("standard")
  })

  it("falls back when the renderer lacks buffer generation functions", async () => {
    jest.doMock("@react-pdf/renderer", () => ({
      Document: () => null,
      Page: () => null,
      Text: () => null,
      View: () => null,
      Image: () => null,
    }))

    const { generatePdf } = await import("@/lib/export/pdf/generator")
    const buffer = await generatePdf(
      {
        ...baseLesson(),
        gradeLevel: "5",
        subject: "Math",
        duration: "30 min",
      },
      "standard",
      false,
    )

    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF")
  })

  it("falls back to the minimal PDF builder when the renderer import fails", async () => {
    jest.doMock("@react-pdf/renderer", () => {
      throw new Error("missing dependency")
    })

    const { generatePdf } = await import("@/lib/export/pdf/generator")
    const lesson: ExportLesson = {
      ...baseLesson(),
      title: "Paren (Test) and Backslash \\\\",
      overview: "Overview line",
      objectives: ["Obj 1"],
      materials: ["Mat 1"],
      activities: ["Act 1"],
      assessment: ["Assess 1"],
      standards: ["Std 1"],
      sections: [{ title: "Extra", content: "Hello (world)", items: ["Item (1)"] }],
    }

    const buffer = await generatePdf(lesson, "detailed", false)
    const s = buffer.toString("utf8")

    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF")
    expect(s).toContain("Template: detailed")
    expect(s).toContain("Sections")
    expect(s).toContain("Paren \\(Test\\) and Backslash \\\\\\\\")
    expect(s).toContain("Hello \\(world\\)")
    expect(s).toContain("Item \\(1\\)")
  })
})
