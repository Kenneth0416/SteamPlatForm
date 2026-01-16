import { parseMarkdownToLesson } from "@/lib/export/parser"

describe("parseMarkdownToLesson", () => {
  it("handles empty/whitespace markdown", () => {
    const empty = parseMarkdownToLesson("")
    expect(empty.title).toBe("")
    expect(empty.sections).toHaveLength(1)
    expect(empty.sections[0]).toEqual({ title: "Content", content: "", items: [] })

    const whitespace = parseMarkdownToLesson("   \n\n\t")
    expect(whitespace.title).toBe("")
    expect(whitespace.sections).toHaveLength(1)
    expect(whitespace.sections[0]).toEqual({ title: "Content", content: "", items: [] })
  })

  it("falls back to activity titles when no Activities section exists", () => {
    const markdown = [
      "# Title",
      "",
      "## 1. Warm-up",
      "Do something quick",
      "",
      "## Assessment",
      "- Exit ticket",
    ].join("\n")

    const lesson = parseMarkdownToLesson(markdown)
    expect(lesson.activities).toEqual(["1. Warm-up"])
  })

  it("uses the Overview section content when present", () => {
    const markdown = [
      "# Title",
      "",
      "Intro overview that should be replaced.",
      "",
      "## Overview",
      "This is the canonical overview.",
      "",
      "## Materials",
      "- Balloon",
    ].join("\n")

    const lesson = parseMarkdownToLesson(markdown)
    expect(lesson.overview).toBe("This is the canonical overview.")
  })

  it("splits sections on H2/H3, but keeps other heading levels as content", () => {
    const markdown = [
      "# Title",
      "",
      "## Section A",
      "A1",
      "",
      "#### Not a section",
      "still content",
      "",
      "### Section B",
      "- item 1",
      "- item 2",
      "",
      "## Section C",
      "C1",
    ].join("\n")

    const lesson = parseMarkdownToLesson(markdown)

    expect(lesson.sections.map(s => s.title)).toEqual(["Section A", "Section B", "Section C"])
    expect(lesson.sections[0].content).toContain("#### Not a section")
    expect(lesson.sections[1].items).toEqual(["item 1", "item 2"])
  })

  it("parses valid lesson Markdown into sections and lists", () => {
    const markdown = [
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
      "",
      "### 1. Build (15 min)",
      "",
      "**Steps:**",
      "1. Thread string through a straw",
      "2. Tape balloon to straw",
      "",
      "```mermaid",
      "graph TD",
      "  A[Start] --> B[Build]",
      "  B --> C[Test]",
      "  %% ## Not a real heading",
      "```",
      "",
      "| Part | Count |",
      "| --- | --- |",
      "| Balloon | 1 |",
      "",
      "## Assessment",
      "- Student explains cause/effect",
      "",
      "## Standards",
      "- NGSS 3-PS2-1",
    ].join("\n")

    const lesson = parseMarkdownToLesson(markdown)

    expect(lesson.title).toBe("Balloon Rocket Challenge")
    expect(lesson.gradeLevel).toBe("3")
    expect(lesson.subject).toBe("Science")
    expect(lesson.duration).toBe("45 min")
    expect(lesson.overview).toContain("hands-on STEAM activity")

    expect(lesson.sections.map(s => s.title)).toEqual(
      expect.arrayContaining(["Learning Objectives", "Materials", "Activities", "1. Build (15 min)", "Assessment", "Standards"]),
    )

    expect(lesson.objectives).toEqual(
      expect.arrayContaining(["Explain how thrust moves an object", "Record observations during testing"]),
    )
    expect(lesson.materials).toEqual(expect.arrayContaining(["Balloon", "String", "Tape"]))
    expect(lesson.assessment).toEqual(expect.arrayContaining(["Student explains cause/effect"]))
    expect(lesson.standards).toEqual(expect.arrayContaining(["NGSS 3-PS2-1"]))

    const buildSection = lesson.sections.find(s => s.title.includes("Build"))
    expect(buildSection?.content).toContain("```mermaid")
    expect(buildSection?.content).toContain("## Not a real heading")
    expect(buildSection?.content).toContain("| Part | Count |")
    expect(lesson.sections.some(s => s.title === "Not a real heading")).toBe(false)
  })

  it("extracts metadata from the intro section", () => {
    const markdown = [
      "# Title",
      "",
      "**Grade Level:** 6 | **Domains:** Engineering, Math | **Time:** 60 minutes",
      "",
      "## Objectives",
      "- One",
      "- Two",
    ].join("\n")

    const lesson = parseMarkdownToLesson(markdown)

    expect(lesson.title).toBe("Title")
    expect(lesson.gradeLevel).toBe("6")
    expect(lesson.subject).toBe("Engineering, Math")
    expect(lesson.duration).toBe("60 minutes")
    expect(lesson.objectives).toEqual(["One", "Two"])
  })

  it("extracts objective/material items even when section uses plain lines", () => {
    const markdown = [
      "# Title",
      "",
      "**Grade:** 6 | **Subject:** Science | **Duration:** 45 min",
      "",
      "## Objectives",
      "Understand thrust",
      "Record observations",
      "",
      "## Materials",
      "Balloon",
      "String",
    ].join("\n")

    const lesson = parseMarkdownToLesson(markdown)
    expect(lesson.objectives).toEqual(["Understand thrust", "Record observations"])
    expect(lesson.materials).toEqual(["Balloon", "String"])
  })

  it("handles malformed Markdown gracefully", () => {
    const markdown = "No headings here\n- item one\n- item two\n\nSome trailing text"

    const lesson = parseMarkdownToLesson(markdown)

    expect(lesson.title).toBe("No headings here")
    expect(lesson.sections).toHaveLength(1)
    expect(lesson.sections[0].title).toBe("Content")
    expect(lesson.sections[0].items).toEqual(["item one", "item two"])
  })

  it("does not throw on non-string input", () => {
    const lesson = parseMarkdownToLesson(null as unknown as string)
    expect(lesson.title).toBe("")
    expect(lesson.sections).toHaveLength(1)
    expect(lesson.sections[0].title).toBe("Content")
  })

  it("supports Chinese content and labels", () => {
    const markdown = [
      "# 氣球火箭挑戰",
      "",
      "**年級：** 三年級 | **科目：** 科學 | **時長：** 45 分鐘",
      "",
      "## 學習目標",
      "- 解釋推力如何移動物體",
      "- 記錄實驗觀察",
      "",
      "## 材料",
      "- 氣球",
      "- 膠帶",
      "",
      "## 評量",
      "- 能清楚描述因果關係",
    ].join("\n")

    const lesson = parseMarkdownToLesson(markdown)

    expect(lesson.title).toBe("氣球火箭挑戰")
    expect(lesson.gradeLevel).toBe("三年級")
    expect(lesson.subject).toBe("科學")
    expect(lesson.duration).toBe("45 分鐘")
    expect(lesson.objectives).toEqual(["解釋推力如何移動物體", "記錄實驗觀察"])
    expect(lesson.materials).toEqual(["氣球", "膠帶"])
    expect(lesson.assessment).toEqual(["能清楚描述因果關係"])
  })
})
