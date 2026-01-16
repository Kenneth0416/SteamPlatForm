import path from "node:path"
import type { ExportLesson, ExportSection, ExportTemplate } from "@/lib/export/types"
import { getPdfStyles } from "@/lib/export/pdf/styles"

type InlineStyle = "bold" | "italic" | "code" | "strike" | "link"

type InlineTextToken = {
  type: "text"
  text: string
  style?: InlineStyle
}

type InlineImageToken = {
  type: "image"
  src: string
  alt?: string
  width?: number
  height?: number
}

type InlineToken = InlineTextToken | InlineImageToken

let pdfFontsRegistered = false

function normalizeTemplate(template: ExportTemplate): ExportTemplate {
  if (template === "detailed" || template === "minimal" || template === "standard") return template
  return "standard"
}

function isLikelyTableLine(line: string): boolean {
  const pipeCount = (line.match(/\|/g) || []).length
  if (pipeCount < 2) return false
  return /\|/.test(line)
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function parseInlineMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern = /(!?\[[^\]]*]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*]+\*|_[^_]+_)/g
  let match: RegExpExecArray | null
  let lastIndex = 0

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: text.slice(lastIndex, match.index) })
    }

    const raw = match[0]
    if (raw.startsWith("![")) {
      const imageMatch = raw.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      const src = (imageMatch?.[2] || "").trim()
      const altRaw = imageMatch?.[1]?.trim() || ""
      // 解析尺寸信息，格式: Mermaid Diagram|width:height
      const sizeMatch = altRaw.match(/^(.+?)\|(\d+):(\d+)$/)
      const alt = sizeMatch ? sizeMatch[1] : altRaw
      const width = sizeMatch ? parseInt(sizeMatch[2], 10) : undefined
      const height = sizeMatch ? parseInt(sizeMatch[3], 10) : undefined
      if (src) tokens.push({ type: "image", src, alt, width, height })
    } else if (raw.startsWith("[")) {
      const linkMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      const label = linkMatch?.[1] || raw
      const url = linkMatch?.[2]
      tokens.push({ type: "text", text: url ? `${label} (${url})` : label, style: "link" })
    } else if (raw.startsWith("**") || raw.startsWith("__")) {
      tokens.push({ type: "text", text: raw.slice(2, -2), style: "bold" })
    } else if (raw.startsWith("~~")) {
      tokens.push({ type: "text", text: raw.slice(2, -2), style: "strike" })
    } else if (raw.startsWith("`")) {
      tokens.push({ type: "text", text: raw.slice(1, -1), style: "code" })
    } else if (raw.startsWith("*") || raw.startsWith("_")) {
      tokens.push({ type: "text", text: raw.slice(1, -1), style: "italic" })
    } else {
      tokens.push({ type: "text", text: raw })
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIndex) })
  }

  return tokens.filter(token => (token.type === "text" ? token.text.length > 0 : Boolean(token.src)))
}

function buildFallbackPdf(
  lesson: ExportLesson,
  template: ExportTemplate,
  includeImages: boolean,
): Buffer {
  const lines: string[] = []
  lines.push(`Template: ${template}`)
  lines.push(`images=${includeImages ? 1 : 0}`)
  if (lesson.title) lines.push(lesson.title)
  if (lesson.gradeLevel || lesson.subject || lesson.duration) {
    lines.push(
      [lesson.gradeLevel && `Grade: ${lesson.gradeLevel}`, lesson.subject && `Subject: ${lesson.subject}`, lesson.duration && `Duration: ${lesson.duration}`]
        .filter(Boolean)
        .join("  |  "),
    )
  }
  if (lesson.overview) lines.push(lesson.overview)

  const addList = (label: string, items: string[]) => {
    if (items.length === 0) return
    lines.push("")
    lines.push(label)
    for (const item of items) lines.push(`- ${item}`)
  }

  if (template !== "minimal") {
    addList("Objectives", lesson.objectives)
    addList("Materials", lesson.materials)
  }
  addList("Assessment", lesson.assessment)
  if (template === "detailed") addList("Standards", lesson.standards)

  if (template === "detailed" && lesson.sections.length > 0) {
    lines.push("")
    lines.push("Sections")
    for (const s of lesson.sections) {
      lines.push(`## ${s.title}`)
      if (s.content) lines.push(s.content)
      for (const item of s.items) lines.push(`- ${item}`)
    }
  }

  const contentText = lines.filter(Boolean).slice(0, 120).join("\n")
  const contentStream =
    [
      "BT",
      "/F1 12 Tf",
      "50 760 Td",
      "14 TL",
      ...contentText.split("\n").map((line, idx) => `${idx === 0 ? "" : "T* " }(${escapePdfText(line)}) Tj`),
      "ET",
    ].join("\n") + "\n"

  const chunks: Buffer[] = []
  const offsets: number[] = []
  let offset = 0

  const push = (s: string) => {
    const buf = Buffer.from(s, "utf8")
    chunks.push(buf)
    offset += buf.length
  }

  const addObj = (num: number, body: string) => {
    offsets[num] = offset
    push(`${num} 0 obj\n${body}\nendobj\n`)
  }

  push("%PDF-1.4\n")
  addObj(1, "<< /Type /Catalog /Pages 2 0 R >>")
  addObj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  addObj(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  )
  addObj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  addObj(5, `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}endstream`)

  const xrefOffset = offset
  const objCount = 6
  push("xref\n")
  push(`0 ${objCount}\n`)
  push("0000000000 65535 f \n")
  for (let i = 1; i < objCount; i++) {
    const off = offsets[i] ?? 0
    push(`${String(off).padStart(10, "0")} 00000 n \n`)
  }
  push("trailer\n")
  push(`<< /Size ${objCount} /Root 1 0 R >>\n`)
  push("startxref\n")
  push(`${xrefOffset}\n`)
  push("%%EOF\n")

  return Buffer.concat(chunks)
}

function sectionLooksLikeMetadata(title: string): boolean {
  const t = title.toLowerCase()
  return (
    t.includes("learning objectives") ||
    t.includes("objectives") ||
    t.includes("materials") ||
    t.includes("assessment") ||
    t.includes("standards") ||
    t.includes("overview") ||
    t.includes("學習目標") ||
    t.includes("材料") ||
    t.includes("評量") ||
    t.includes("标准") ||
    t.includes("標準")
  )
}

export async function generatePdf(
  lesson: ExportLesson,
  template: ExportTemplate,
  includeImages: boolean,
): Promise<Buffer> {
  const normalizedTemplate = normalizeTemplate(template)
  const styles = getPdfStyles(normalizedTemplate)

  try {
    const ReactPdf: any = await import("@react-pdf/renderer")
    const { Document, Page, Text, View, Image, Font } = ReactPdf

    if (!pdfFontsRegistered && Font && typeof Font.register === "function") {
      const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansTC-Regular.ttf")
      Font.register({
        family: "NotoSansTC",
        fonts: [
          { src: fontPath, fontWeight: "normal" },
          { src: fontPath, fontWeight: 700 },
        ],
      })
      pdfFontsRegistered = true
    }

    const inlineStyles: Record<InlineStyle, Record<string, unknown>> = {
      bold: { fontWeight: 700 },
      italic: { fontStyle: "italic" },
      code: { fontFamily: "Courier", fontSize: 9.5, color: "#111827", backgroundColor: "#F3F4F6" },
      strike: { textDecoration: "line-through" },
      link: { color: "#2563EB", textDecoration: "underline" },
    }

    const buildInlineContent = (text: string) => {
      const tokens = parseInlineMarkdown(text)
      const textTokens: InlineTextToken[] = []
      const imageTokens: InlineImageToken[] = []

      for (const token of tokens) {
        if (token.type === "image") {
          imageTokens.push(token)
          if (!includeImages && token.alt) {
            textTokens.push({ type: "text", text: token.alt })
          }
        } else {
          textTokens.push(token)
        }
      }

      const textNodes =
        textTokens.length === 0
          ? (imageTokens.length > 0 ? null : text)
          : textTokens.map((token, idx) =>
              token.style ? (
                <Text key={`inline-${idx}`} style={inlineStyles[token.style]}>
                  {token.text}
                </Text>
              ) : (
                token.text
              ),
            )

      // 判断图片是否为竖向（高度 > 宽度 * 1.2）
      const imageNodes =
        includeImages && imageTokens.length > 0
          ? imageTokens.map((token, idx) => {
              const isVertical = token.width && token.height && token.height > token.width * 1.2
              const imageStyle = isVertical
                ? { ...styles.image, width: "40%", maxHeight: 400 }
                : styles.image
              return <Image key={`inline-img-${idx}`} style={imageStyle} src={token.src} />
            })
          : []

      return { textNodes, imageNodes }
    }

    const renderList = (heading: string, items: string[]) => {
      if (items.length === 0) return null
      return (
        <View wrap={false}>
          <Text style={styles.heading}>{heading}</Text>
          <View style={styles.list}>
            {items.map((item, idx) => {
              const { textNodes, imageNodes } = buildInlineContent(item)
              if (imageNodes.length > 0) {
                return (
                  <View key={`${heading}-${idx}`} style={{ marginBottom: 4 }}>
                    {textNodes && (
                      <Text style={styles.listItem}>
                        {"• "}{textNodes}
                      </Text>
                    )}
                    {imageNodes}
                  </View>
                )
              }
              if (!textNodes) return null
              return (
                <Text key={`${heading}-${idx}`} style={styles.listItem}>
                  {"• "}{textNodes}
                </Text>
              )
            })}
          </View>
        </View>
      )
    }

    const renderSectionContent = (content: string) => {
      const lines = content.split("\n")
      const textElements: any[] = []
      const imageElements: any[] = []
      let tableBuffer: string[] = []
      let codeBlockBuffer: string[] = []
      let inCodeBlock = false
      let codeBlockLang = ""

      const appendImageNode = (node: any) => {
        imageElements.push(
          <View key={`section-img-${imageElements.length}`}>
            {node}
          </View>,
        )
      }

      const appendImageNodes = (nodes: any[]) => {
        if (!includeImages || nodes.length === 0) return
        nodes.forEach(node => appendImageNode(node))
      }

      const flushTable = () => {
        if (tableBuffer.length === 0) return
        textElements.push(
          <Text key={`table-${textElements.length}`} style={styles.table}>
            {tableBuffer.join("\n")}
          </Text>,
        )
        tableBuffer = []
      }

      const flushCodeBlock = () => {
        if (codeBlockBuffer.length === 0) return
        const isMermaid = codeBlockLang.toLowerCase() === "mermaid"
        if (isMermaid) {
          // Render mermaid as a placeholder with the diagram description
          textElements.push(
            <View key={`mermaid-${textElements.length}`} style={{ backgroundColor: "#f5f5f5", padding: 10, marginVertical: 8, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>[Mermaid Diagram]</Text>
              <Text style={{ fontSize: 9, fontFamily: "Courier", color: "#333" }}>
                {codeBlockBuffer.join("\n")}
              </Text>
            </View>,
          )
        } else {
          // Render as code block
          textElements.push(
            <View key={`code-${textElements.length}`} style={{ backgroundColor: "#f5f5f5", padding: 10, marginVertical: 8, borderRadius: 4 }}>
              <Text style={{ fontSize: 9, fontFamily: "Courier", color: "#333" }}>
                {codeBlockBuffer.join("\n")}
              </Text>
            </View>,
          )
        }
        codeBlockBuffer = []
        codeBlockLang = ""
      }

      for (const rawLine of lines) {
        const line = rawLine.trimEnd()
        const trimmed = line.trim()

        // Check for code block fence
        const fenceMatch = trimmed.match(/^```(\w*)$/)
        if (fenceMatch) {
          if (!inCodeBlock) {
            flushTable()
            inCodeBlock = true
            codeBlockLang = fenceMatch[1] || ""
          } else {
            inCodeBlock = false
            flushCodeBlock()
          }
          continue
        }

        if (inCodeBlock) {
          codeBlockBuffer.push(line)
          continue
        }

        if (!trimmed) {
          flushTable()
          continue
        }

        if (isLikelyTableLine(trimmed)) {
          tableBuffer.push(line)
          continue
        }

        flushTable()

        const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
        const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
        const imageOnly = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/)

        if (imageOnly) {
          if (includeImages) {
            const altRaw = imageOnly[1] || ""
            const src = imageOnly[2]
            // 解析尺寸信息
            const sizeMatch = altRaw.match(/^(.+?)\|(\d+):(\d+)$/)
            const width = sizeMatch ? parseInt(sizeMatch[2], 10) : undefined
            const height = sizeMatch ? parseInt(sizeMatch[3], 10) : undefined
            const isVertical = width && height && height > width * 1.2
            const imageStyle = isVertical
              ? { ...styles.image, width: "40%", maxHeight: 400 }
              : styles.image
            appendImageNode(<Image style={imageStyle} src={src} />)
          }
          continue
        }

        if (bulletMatch || orderedMatch) {
          const value = (bulletMatch?.[1] || orderedMatch?.[1] || "").trim()
          if (value) {
            const { textNodes: inlineTextNodes, imageNodes: inlineImages } = buildInlineContent(value)
            appendImageNodes(inlineImages)
            if (inlineTextNodes) {
              textElements.push(
                <View key={`li-${textElements.length}`} style={{ marginBottom: 4 }}>
                  <Text style={styles.listItem}>
                    {"• "}{inlineTextNodes}
                  </Text>
                </View>,
              )
            }
          }
          continue
        }

        const { textNodes: inlineTextNodes, imageNodes: inlineImages } = buildInlineContent(line)
        appendImageNodes(inlineImages)
        if (inlineTextNodes) {
          textElements.push(
            <Text key={`p-${textElements.length}`} style={styles.paragraph}>
              {inlineTextNodes}
            </Text>,
          )
        }
      }

      flushTable()
      flushCodeBlock()

      return {
        textNodes: textElements.length ? <View style={styles.list}>{textElements}</View> : null,
        imageNodes: imageElements,
      }
    }

    const renderSection = (section: ExportSection) => {
      const buildSectionItems = (items: string[]) => {
        if (items.length === 0) return { textNodes: null, imageNodes: [] as any[] }

        const listNodes: any[] = []
        const imageNodes: any[] = []

        items.forEach((item, idx) => {
          const { textNodes: inlineTextNodes, imageNodes: inlineImages } = buildInlineContent(item)
          if (includeImages && inlineImages.length > 0) {
            inlineImages.forEach((img, imgIdx) => {
              imageNodes.push(
                <View key={`${section.title}-item-img-${imageNodes.length}-${imgIdx}`}>
                  {img}
                </View>,
              )
            })
          }

          if (inlineTextNodes) {
            listNodes.push(
              <Text key={`${section.title}-item-${idx}`} style={styles.listItem}>
                {"• "}{inlineTextNodes}
              </Text>,
            )
          }
        })

        return {
          textNodes: listNodes.length ? <View style={styles.list}>{listNodes}</View> : null,
          imageNodes,
        }
      }

      const contentNodes = section.content
        ? renderSectionContent(section.content)
        : { textNodes: null, imageNodes: [] as any[] }
      const itemNodes = buildSectionItems(section.items)
      return (
        <View key={`sec-${section.title}`}>
          <Text style={styles.heading}>{section.title}</Text>
          {contentNodes.textNodes}
          {itemNodes.textNodes}
          {contentNodes.imageNodes}
          {itemNodes.imageNodes}
        </View>
      )
    }

    const overviewContent = lesson.overview ? buildInlineContent(lesson.overview) : null

    const doc = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>{lesson.title || "Lesson"}</Text>

          {(lesson.gradeLevel || lesson.subject || lesson.duration) && (
            <Text style={styles.paragraph}>
              {[lesson.gradeLevel && `Grade: ${lesson.gradeLevel}`, lesson.subject && `Subject: ${lesson.subject}`, lesson.duration && `Duration: ${lesson.duration}`]
                .filter(Boolean)
                .join("  •  ")}
            </Text>
          )}

          {overviewContent && (overviewContent.textNodes || overviewContent.imageNodes.length > 0) && (
            <View>
              <Text style={styles.heading}>Overview</Text>
              {overviewContent.textNodes && <Text style={styles.paragraph}>{overviewContent.textNodes}</Text>}
              {overviewContent.imageNodes}
            </View>
          )}

          {normalizedTemplate !== "minimal" && renderList("Objectives", lesson.objectives)}
          {normalizedTemplate !== "minimal" && renderList("Materials", lesson.materials)}
          {renderList("Assessment", lesson.assessment)}
          {normalizedTemplate === "detailed" && renderList("Standards", lesson.standards)}

          {normalizedTemplate === "detailed" &&
            lesson.sections
              .filter(s => !sectionLooksLikeMetadata(s.title))
              .map(renderSection)}

          <Text style={styles.footer}>Template: {normalizedTemplate}</Text>
          <Text style={styles.footer}>images={includeImages ? 1 : 0}</Text>
        </Page>
      </Document>
    )

    const buffer =
      typeof ReactPdf.renderToBuffer === "function"
        ? await ReactPdf.renderToBuffer(doc)
        : typeof ReactPdf.pdf === "function"
          ? await ReactPdf.pdf(doc).toBuffer()
          : (() => {
              throw new Error("PDF renderer missing render function")
            })()
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  } catch (error) {
    console.error("PDF generation error, using fallback:", error)
    return buildFallbackPdf(lesson, normalizedTemplate, includeImages)
  }
}
