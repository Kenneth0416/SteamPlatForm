/** @jest-environment node */

import fs from "node:fs"
import path from "node:path"
import { parseMarkdownToLesson } from "@/lib/export/parser"
import { generatePdf } from "@/lib/export/pdf/generator"
import { generateDocx } from "@/lib/export/word/generator"

function loadRealLessonMarkdown(): string {
  const filePath = path.join(__dirname, "fixtures", "lesson-sample.md")
  return fs.readFileSync(filePath, "utf8")
}

describe("Export integration", () => {
  it("end-to-end: markdown → parse → generate PDF → verify buffer", async () => {
    const markdown = loadRealLessonMarkdown()
    const lesson = parseMarkdownToLesson(markdown)

    expect(lesson.title).toBe("Balloon Rocket Challenge: Forces & Motion")
    expect(lesson.objectives.length).toBeGreaterThan(0)
    expect(lesson.materials.length).toBeGreaterThan(0)

    const pdfBuffer = await generatePdf(lesson, "standard", false)
    expect(pdfBuffer.subarray(0, 4).toString("utf8")).toBe("%PDF")
    expect(pdfBuffer.length).toBeGreaterThan(20)
    expect(pdfBuffer.toString("utf8")).toContain("%%EOF")
  })

  it("end-to-end: markdown → parse → generate DOCX → verify buffer", async () => {
    const markdown = loadRealLessonMarkdown()
    const lesson = parseMarkdownToLesson(markdown)

    const docxBuffer = await generateDocx(lesson, "standard", false)
    expect(docxBuffer.subarray(0, 2).toString("utf8")).toBe("PK")
    expect(docxBuffer.length).toBeGreaterThan(20)
    expect(docxBuffer.toString("latin1")).toContain("word/document.xml")
  })
})
