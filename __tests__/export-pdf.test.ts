/** @jest-environment node */

import { parseMarkdownToLesson } from "@/lib/export/parser"
import { generatePdf } from "@/lib/export/pdf/generator"
import { POST } from "@/app/api/export/pdf/route"

const sampleMarkdown = [
  "# Balloon Rocket Challenge",
  "",
  "**Grade:** 3 | **Subject:** Science | **Duration:** 45 min",
  "",
  "A hands-on STEAM activity about forces and motion.",
  "",
  "## Learning Objectives",
  "1. Explain how thrust moves an object",
  "2. Record observations during testing",
  "",
  "## Materials",
  "- Balloon",
  "- String",
  "- Tape",
  "",
  "## Activities",
  "- Build the rocket",
  "- Test and iterate",
  "",
  "## Assessment",
  "- Student explains cause/effect",
  "",
  "## Standards",
  "- NGSS 3-PS2-1",
].join("\n")

describe("PDF export", () => {
  it("generates a PDF buffer from an ExportLesson object", async () => {
    const lesson = {
      title: "Unit Test Lesson",
      overview: "Overview text",
      gradeLevel: "5",
      subject: "Science",
      duration: "30 min",
      objectives: ["Obj 1", "Obj 2"],
      materials: ["A", "B"],
      sections: [
        { title: "Activities", content: "1. Do the thing\n2. Measure", items: ["extra item"] },
      ],
      activities: ["Do the thing", "Measure"],
      assessment: ["Exit ticket"],
      standards: ["NGSS X"],
    }
    const buffer = await generatePdf(lesson, "standard", false)
    expect(buffer.slice(0, 4).toString("utf8")).toBe("%PDF")
    expect(buffer.toString("utf8")).toContain("%%EOF")
  })

  it("generates a PDF buffer", async () => {
    const lesson = parseMarkdownToLesson(sampleMarkdown)
    const buffer = await generatePdf(lesson, "standard", false)
    expect(buffer.slice(0, 4).toString("utf8")).toBe("%PDF")
  })

  it("generates different output for different templates", async () => {
    const lesson = parseMarkdownToLesson(sampleMarkdown)
    const standard = await generatePdf(lesson, "standard", false)
    const minimal = await generatePdf(lesson, "minimal", false)

    expect(standard.equals(minimal)).toBe(false)
    expect(standard.slice(0, 4).toString("utf8")).toBe("%PDF")
    expect(minimal.slice(0, 4).toString("utf8")).toBe("%PDF")
  })

  it("respects includeImages and normalizes invalid template", async () => {
    const lesson = parseMarkdownToLesson([
      "# Img Lesson",
      "",
      "## Section",
      "![alt](https://example.com/image.png)",
    ].join("\n"))

    const noImages = await generatePdf(lesson, "detailed", false)
    expect(noImages.toString("utf8")).toContain("Template: detailed")
    expect(noImages.toString("utf8")).toContain("images=0")

    const withImages = await generatePdf(lesson, "detailed", true)
    expect(withImages.toString("utf8")).toContain("Template: detailed")
    expect(withImages.toString("utf8")).not.toContain("images=0")

    const invalidTemplate = await generatePdf(lesson, "nope" as any, false)
    expect(invalidTemplate.toString("utf8")).toContain("Template: standard")
  })

  it("API route returns PDF with correct headers", async () => {
    const req = new Request("http://localhost/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: sampleMarkdown,
        template: "standard",
        includeImages: false,
        lang: "en",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/pdf")
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="lesson.pdf"')

    const body = Buffer.from(await res.arrayBuffer())
    expect(body.slice(0, 4).toString("utf8")).toBe("%PDF")
  })

  it("API route returns 400 for missing markdown", async () => {
    const req = new Request("http://localhost/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "   " }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json).toEqual({ error: "Missing markdown" })
  })

  it("API route returns 400 when markdown is not a string", async () => {
    const req = new Request("http://localhost/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: 123 }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json).toEqual({ error: "Missing markdown" })
  })

  it("API route returns 500 for malformed JSON", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    const req = new Request("http://localhost/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not valid json",
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBeTruthy()
    consoleSpy.mockRestore()
  })

  it("API route uses a default 500 error message when no message is available", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    const req = {
      json: async () => {
        throw {}
      },
    } as unknown as Request

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json).toEqual({ error: "Failed to export PDF" })
    consoleSpy.mockRestore()
  })
})
