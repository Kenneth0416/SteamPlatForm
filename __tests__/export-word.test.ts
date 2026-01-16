/** @jest-environment node */

import { parseMarkdownToLesson } from "@/lib/export/parser"
import type { ExportTemplate } from "@/lib/export/types"
import { generateDocx } from "@/lib/export/word/generator"
import { POST } from "@/app/api/export/word/route"
import * as docx from "docx"

const { Packer } = docx

function createSampleMarkdown() {
  return [
    "# Balloon Rocket Challenge",
    "",
    "**Grade:** 3 | **Subject:** Science | **Duration:** 45 min",
    "",
    "A hands-on STEAM activity about forces and motion.",
    "",
    "## Learning Objectives",
    "- Explain how thrust moves an object",
    "- Record observations during testing",
    "",
    "## Materials",
    "- Balloon",
    "- String",
    "- Tape",
    "",
    "## Activities",
    "1. Build the rocket",
    "2. Test and iterate",
    "",
    "## Assessment",
    "- Student explains cause/effect",
    "- Student records observations",
    "",
    "## Standards",
    "- NGSS 3-PS2-1",
  ].join("\n")
}

describe("Word export", () => {
  it("generates a valid DOCX buffer (zip header)", async () => {
    const lesson = parseMarkdownToLesson(createSampleMarkdown())
    const buffer = await generateDocx(lesson, "standard", false)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK")
    expect(buffer.toString("latin1")).toContain("word/document.xml")
  })

  it("generates a DOCX buffer from an ExportLesson object", async () => {
    const lesson = {
      title: "Unit Test Lesson",
      overview: "Overview text",
      gradeLevel: "5",
      subject: "Science",
      duration: "30 min",
      objectives: ["Obj 1", "Obj 2"],
      materials: ["A", "B"],
      sections: [{ title: "Extra", content: "Some content", items: ["item 1"] }],
      activities: ["Do the thing", "Measure"],
      assessment: ["Exit ticket"],
      standards: ["NGSS X"],
    }

    const buffer = await generateDocx(lesson, "standard", false)
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK")
    expect(buffer.toString("latin1")).toContain("word/document.xml")
  })

  it("generates valid DOCX for different templates", async () => {
    const lesson = parseMarkdownToLesson(createSampleMarkdown())

    const templates: ExportTemplate[] = ["standard", "detailed", "minimal"]
    const buffers = await Promise.all(templates.map(t => generateDocx(lesson, t, false)))

    for (const buffer of buffers) {
      expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK")
    }

    expect(buffers[0].equals(buffers[1])).toBe(false)
    expect(buffers[0].equals(buffers[2])).toBe(false)
    expect(buffers[1].equals(buffers[2])).toBe(false)
  })

  it("changes output when includeImages toggles", async () => {
    const lesson = parseMarkdownToLesson([
      "# Title",
      "",
      "## Section",
      "![alt](https://example.com/image.png)",
      "",
      "- Item",
    ].join("\n"))

    const withoutImages = await generateDocx(lesson, "standard", false)
    const withImages = await generateDocx(lesson, "standard", true)

    expect(withoutImages.subarray(0, 2).toString("utf8")).toBe("PK")
    expect(withImages.subarray(0, 2).toString("utf8")).toBe("PK")
    expect(withoutImages.equals(withImages)).toBe(false)
  })

  it("renders extra sections with code blocks and list formats", async () => {
    const lesson = {
      title: "Unit Test Lesson",
      overview: "",
      gradeLevel: "",
      subject: "",
      duration: "",
      objectives: [],
      materials: [],
      activities: [],
      assessment: [],
      standards: [],
      sections: [
        {
          title: "1. Setup",
          content: [
            "```ts",
            "const x = 1",
            "```",
            "",
            "- Bullet item",
            "1. Ordered item",
            "![alt](https://example.com/image.png)",
            "Plain paragraph",
          ].join("\n"),
          items: ["Item list value"],
        },
      ],
    }

    const withoutImages = await generateDocx(lesson, "standard", false)
    const withImages = await generateDocx(lesson, "standard", true)

    expect(withoutImages.subarray(0, 2).toString("utf8")).toBe("PK")
    expect(withImages.subarray(0, 2).toString("utf8")).toBe("PK")
    expect(withoutImages.equals(withImages)).toBe(false)
  })

  it("API route returns correct DOCX headers", async () => {
    const request = new Request("http://localhost/api/export/word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: createSampleMarkdown(),
        template: "standard",
        includeImages: false,
        lang: "en",
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="lesson.docx"')

    const buffer = Buffer.from(await response.arrayBuffer())
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK")
  })

  it("API route returns 400 for missing markdown", async () => {
    const request = new Request("http://localhost/api/export/word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "" }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json).toEqual({ error: "Missing markdown" })
  })

  it("API route returns 400 for malformed JSON", async () => {
    const request = new Request("http://localhost/api/export/word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not valid json",
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json).toEqual({ error: "Missing markdown" })
  })

  it("API route returns 400 when markdown is not a string", async () => {
    const request = new Request("http://localhost/api/export/word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: 123 }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json).toEqual({ error: "Missing markdown" })
  })

  it("API route returns 500 when DOCX generation fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    const packerSpy = jest
      .spyOn(Packer, "toBuffer")
      .mockRejectedValueOnce(new Error(""))

    const request = new Request("http://localhost/api/export/word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: createSampleMarkdown() }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json).toEqual({ error: "Failed to export Word document" })

    packerSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  it("embeds Mermaid PNG images when includeImages is true", async () => {
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    const markdown = [
      "# Lesson with Mermaid",
      "",
      "## Flow",
      `![Mermaid Diagram|400:300](data:image/png;base64,${pngBase64})`,
      "",
      "Some text after the diagram.",
    ].join("\n")

    const lesson = parseMarkdownToLesson(markdown)
    const buffer = await generateDocx(lesson, "standard", true)

    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK")
    // DOCX 包含 media 文件夹表示有图片
    expect(buffer.toString("latin1")).toContain("word/media/")
  })

  it("does not embed Mermaid images when includeImages is false", async () => {
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    const markdown = [
      "# Lesson with Mermaid",
      "",
      "## Flow",
      `![Mermaid Diagram|400:300](data:image/png;base64,${pngBase64})`,
    ].join("\n")

    const lesson = parseMarkdownToLesson(markdown)
    const buffer = await generateDocx(lesson, "standard", false)

    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK")
    // 不包含图片时不应有 media 文件夹
    expect(buffer.toString("latin1")).not.toContain("word/media/")
  })
})
