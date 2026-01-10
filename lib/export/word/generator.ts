import type { ExportLesson, ExportSection, ExportTemplate } from "@/lib/export/types"
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"

type TemplateConfig = {
  font: string
  codeFont: string
  titleSize: number
  heading2Size: number
  heading3Size: number
  bodySize: number
  paragraphSpacingAfter: number
  headingSpacingBefore: number
  headingSpacingAfter: number
  tableCellPadding: number
}

function getTemplateConfig(template: ExportTemplate): TemplateConfig {
  switch (template) {
    case "minimal":
      return {
        font: "Calibri",
        codeFont: "Consolas",
        titleSize: 34,
        heading2Size: 26,
        heading3Size: 22,
        bodySize: 22,
        paragraphSpacingAfter: 140,
        headingSpacingBefore: 220,
        headingSpacingAfter: 120,
        tableCellPadding: 80,
      }
    case "detailed":
      return {
        font: "Calibri",
        codeFont: "Consolas",
        titleSize: 38,
        heading2Size: 30,
        heading3Size: 26,
        bodySize: 24,
        paragraphSpacingAfter: 180,
        headingSpacingBefore: 300,
        headingSpacingAfter: 160,
        tableCellPadding: 110,
      }
    case "standard":
    default:
      return {
        font: "Calibri",
        codeFont: "Consolas",
        titleSize: 36,
        heading2Size: 28,
        heading3Size: 24,
        bodySize: 24,
        paragraphSpacingAfter: 160,
        headingSpacingBefore: 260,
        headingSpacingAfter: 140,
        tableCellPadding: 100,
      }
  }
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim()
}

function parseImageFromMarkdown(text: string): { dataUrl: string; width: number; height: number } | null {
  const match = text.match(/!\[Mermaid Diagram\|(\d+):(\d+)\]\((data:image\/png;base64,[^)]+)\)/)
  if (!match) return null
  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10),
    dataUrl: match[3],
  }
}

function createImageParagraph(dataUrl: string, width: number, height: number, config: TemplateConfig): Paragraph {
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "")
  const maxWidth = 500 // Word 文档最大宽度（点）
  const scale = width > maxWidth ? maxWidth / width : 1
  const finalWidth = Math.round(width * scale)
  const finalHeight = Math.round(height * scale)

  return new Paragraph({
    spacing: { after: config.paragraphSpacingAfter },
    children: [
      new ImageRun({
        data: Buffer.from(base64Data, "base64"),
        transformation: { width: finalWidth, height: finalHeight },
        type: "png",
      }),
    ],
  })
}

function normalizeTextForDoc(text: string, includeImages: boolean): string {
  if (!includeImages) {
    const withoutImages = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "")
    return stripInlineMarkdown(withoutImages)
  }
  return stripInlineMarkdown(text)
}

function headingForSectionTitle(title: string): typeof HeadingLevel.HEADING_2 | typeof HeadingLevel.HEADING_3 {
  if (/^\s*\d+\.\s+/.test(title) || /^\s*step\s+\d+/i.test(title)) return HeadingLevel.HEADING_3
  return HeadingLevel.HEADING_2
}

function createHeading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel], config: TemplateConfig): Paragraph {
  const size =
    level === HeadingLevel.HEADING_1
      ? config.titleSize
      : level === HeadingLevel.HEADING_2
        ? config.heading2Size
        : config.heading3Size

  return new Paragraph({
    heading: level,
    spacing: { before: config.headingSpacingBefore, after: config.headingSpacingAfter },
    children: [
      new TextRun({
        text,
        bold: true,
        size,
        font: config.font,
      }),
    ],
  })
}

function createBodyParagraph(text: string, config: TemplateConfig): Paragraph {
  return new Paragraph({
    spacing: { after: config.paragraphSpacingAfter },
    children: [
      new TextRun({
        text,
        size: config.bodySize,
        font: config.font,
      }),
    ],
  })
}

function createCodeParagraph(text: string, config: TemplateConfig): Paragraph {
  return new Paragraph({
    spacing: { after: config.paragraphSpacingAfter },
    children: [
      new TextRun({
        text,
        size: config.bodySize,
        font: config.codeFont,
      }),
    ],
  })
}

function createBulletParagraph(text: string, config: TemplateConfig): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: Math.max(80, Math.floor(config.paragraphSpacingAfter * 0.75)) },
    children: [
      new TextRun({
        text,
        size: config.bodySize,
        font: config.font,
      }),
    ],
  })
}

function createNumberedParagraph(text: string, config: TemplateConfig): Paragraph {
  return new Paragraph({
    numbering: { reference: "lesson-numbering", level: 0 },
    spacing: { after: Math.max(80, Math.floor(config.paragraphSpacingAfter * 0.75)) },
    children: [
      new TextRun({
        text,
        size: config.bodySize,
        font: config.font,
      }),
    ],
  })
}

function createTwoColumnTable(
  headerLeft: string,
  headerRight: string,
  rows: string[],
  config: TemplateConfig,
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            margins: {
              top: config.tableCellPadding,
              bottom: config.tableCellPadding,
              left: config.tableCellPadding,
              right: config.tableCellPadding,
            },
            children: [createBodyParagraph(headerLeft, { ...config, paragraphSpacingAfter: 0 })],
          }),
          new TableCell({
            width: { size: 88, type: WidthType.PERCENTAGE },
            margins: {
              top: config.tableCellPadding,
              bottom: config.tableCellPadding,
              left: config.tableCellPadding,
              right: config.tableCellPadding,
            },
            children: [createBodyParagraph(headerRight, { ...config, paragraphSpacingAfter: 0 })],
          }),
        ],
      }),
      ...rows.map((text, idx) => {
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 12, type: WidthType.PERCENTAGE },
              margins: {
                top: config.tableCellPadding,
                bottom: config.tableCellPadding,
                left: config.tableCellPadding,
                right: config.tableCellPadding,
              },
              children: [createBodyParagraph(String(idx + 1), { ...config, paragraphSpacingAfter: 0 })],
            }),
            new TableCell({
              width: { size: 88, type: WidthType.PERCENTAGE },
              margins: {
                top: config.tableCellPadding,
                bottom: config.tableCellPadding,
                left: config.tableCellPadding,
                right: config.tableCellPadding,
              },
              children: [createBodyParagraph(text, { ...config, paragraphSpacingAfter: 0 })],
            }),
          ],
        })
      }),
    ],
  })
}

function renderSection(section: ExportSection, includeImages: boolean, config: TemplateConfig): Paragraph[] {
  const children: Paragraph[] = []
  const title = section.title?.trim()
  if (title) children.push(createHeading(title, headingForSectionTitle(title), config))

  const content = section.content || ""
  const lines = content.split("\n")
  let inCodeBlock = false
  let codeBlockLang = ""
  let codeBlockLines: string[] = []

  const flushCodeBlock = () => {
    if (codeBlockLines.length === 0) return
    const isMermaid = codeBlockLang.toLowerCase() === "mermaid"
    if (isMermaid) {
      // Add mermaid label
      children.push(new Paragraph({
        spacing: { before: 100, after: 50 },
        children: [new TextRun({ text: "[Mermaid Diagram]", italics: true, color: "666666", size: config.bodySize - 2 })],
      }))
    }
    for (const codeLine of codeBlockLines) {
      children.push(createCodeParagraph(codeLine, config))
    }
    codeBlockLines = []
    codeBlockLang = ""
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    const fenceMatch = trimmed.match(/^```(\w*)$/)
    if (fenceMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = fenceMatch[1] || ""
      } else {
        inCodeBlock = false
        flushCodeBlock()
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(trimmed)
      continue
    }

    if (!trimmed) continue

    // 检测 Mermaid 图片并渲染
    if (includeImages) {
      const imageInfo = parseImageFromMarkdown(rawLine)
      if (imageInfo) {
        children.push(createImageParagraph(imageInfo.dataUrl, imageInfo.width, imageInfo.height, config))
        continue
      }
    }

    const imageNormalized = normalizeTextForDoc(rawLine, includeImages)
    if (!imageNormalized) continue

    const bullet = imageNormalized.match(/^\s*[-*]\s+(.+)$/)
    if (bullet) {
      children.push(createBulletParagraph(stripInlineMarkdown(bullet[1]), config))
      continue
    }

    const ordered = imageNormalized.match(/^\s*\d+[.)]\s+(.+)$/)
    if (ordered) {
      children.push(createNumberedParagraph(stripInlineMarkdown(ordered[1]), config))
      continue
    }

    children.push(createBodyParagraph(imageNormalized, config))
  }

  flushCodeBlock()

  for (const item of section.items || []) {
    const cleaned = normalizeTextForDoc(item, includeImages)
    if (cleaned) children.push(createBulletParagraph(cleaned, config))
  }

  return children
}

export function createDocxDocument(
  lesson: ExportLesson,
  template: ExportTemplate,
  includeImages: boolean,
): Document {
  const config = getTemplateConfig(template)

  const children: (Paragraph | Table)[] = []
  children.push(createHeading(lesson.title || "Lesson", HeadingLevel.HEADING_1, config))

  const metaParts = [
    lesson.gradeLevel ? `Grade: ${lesson.gradeLevel}` : "",
    lesson.subject ? `Subject: ${lesson.subject}` : "",
    lesson.duration ? `Duration: ${lesson.duration}` : "",
  ].filter(Boolean)
  if (metaParts.length > 0) children.push(createBodyParagraph(metaParts.join(" | "), config))

  if (lesson.overview?.trim()) {
    children.push(createHeading("Overview", HeadingLevel.HEADING_2, config))
    children.push(createBodyParagraph(normalizeTextForDoc(lesson.overview, includeImages), config))
  }

  if (lesson.objectives?.length) {
    children.push(createHeading("Learning Objectives", HeadingLevel.HEADING_2, config))
    for (const obj of lesson.objectives) {
      const cleaned = normalizeTextForDoc(obj, includeImages)
      if (cleaned) children.push(createBulletParagraph(cleaned, config))
    }
  }

  if (lesson.materials?.length) {
    children.push(createHeading("Materials", HeadingLevel.HEADING_2, config))
    for (const material of lesson.materials) {
      const cleaned = normalizeTextForDoc(material, includeImages)
      if (cleaned) children.push(createBulletParagraph(cleaned, config))
    }
  }

  if (lesson.activities?.length) {
    children.push(createHeading("Activities", HeadingLevel.HEADING_2, config))
    const activityItems = lesson.activities.map(a => normalizeTextForDoc(a, includeImages)).filter(Boolean)
    if (template === "minimal") {
      for (const item of activityItems) children.push(createBulletParagraph(item, config))
    } else {
      children.push(createTwoColumnTable("#", "Activity", activityItems, config))
    }
  }

  if (lesson.assessment?.length) {
    children.push(createHeading("Assessment", HeadingLevel.HEADING_2, config))
    const assessmentItems = lesson.assessment.map(a => normalizeTextForDoc(a, includeImages)).filter(Boolean)
    if (template === "minimal") {
      for (const item of assessmentItems) children.push(createBulletParagraph(item, config))
    } else {
      children.push(createTwoColumnTable("#", "Assessment Item", assessmentItems, config))
    }
  }

  if (lesson.standards?.length) {
    children.push(createHeading("Standards", HeadingLevel.HEADING_2, config))
    for (const standard of lesson.standards) {
      const cleaned = normalizeTextForDoc(standard, includeImages)
      if (cleaned) children.push(createBulletParagraph(cleaned, config))
    }
  }

  const renderedSectionTitles = new Set(
    [
      "Overview",
      "Learning Objectives",
      "Materials",
      "Activities",
      "Assessment",
      "Standards",
    ].map(s => s.toLowerCase()),
  )

  for (const section of lesson.sections || []) {
    const sectionTitle = section.title?.trim()
    if (sectionTitle && renderedSectionTitles.has(sectionTitle.toLowerCase())) continue
    children.push(...renderSection(section, includeImages, config))
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: config.font, size: config.bodySize },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "lesson-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: "left",
            },
          ],
        },
      ],
    },
    sections: [{ properties: {}, children: children as Array<Paragraph | Table> }],
  })
}

export async function generateDocx(
  lesson: ExportLesson,
  template: ExportTemplate,
  includeImages: boolean,
): Promise<Buffer> {
  const doc = createDocxDocument(lesson, template, includeImages)
  return Packer.toBuffer(doc)
}
