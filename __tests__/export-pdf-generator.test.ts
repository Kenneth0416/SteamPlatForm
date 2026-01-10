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
