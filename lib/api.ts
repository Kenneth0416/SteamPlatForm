import type {
  LessonRequirements,
  SavedLesson,
  SortBy,
  SortOrder,
} from "@/types/lesson"
import type { PdfTemplate, WordTemplate } from "@/types/settings"
import { getCurrentUser } from "./authStorage"

// Mock delay helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const PDF_TEMPLATES = ["standard", "detailed", "minimal"] as const
const WORD_TEMPLATES = ["standard", "detailed"] as const
export const MERMAID_FALLBACK_FONT_STACK = "'Source Han Sans CN Medium', 'Noto Sans', 'DejaVu Sans', sans-serif"

function isPdfTemplate(value: unknown): value is PdfTemplate {
  return typeof value === "string" && (PDF_TEMPLATES as readonly string[]).includes(value)
}

function isWordTemplate(value: unknown): value is WordTemplate {
  return typeof value === "string" && (WORD_TEMPLATES as readonly string[]).includes(value)
}

export async function generateLessonDraft(requirements: LessonRequirements, lang: "en" | "zh" = "en"): Promise<string> {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      throw new Error("User not authenticated")
    }

    console.log("正在使用 LangChain 生成教案...", requirements, "語言:", lang)

    const response = await fetch("/api/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirements, lang }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to generate lesson")
    }

    const data = await response.json()
    console.log("LangChain 教案生成成功!")
    return data.markdown
  } catch (error) {
    console.error("LangChain API 錯誤:", error)
    console.log("回退到 Mock 數據生成教案...")
    return await generateMockLesson(requirements)
  }
}

// 保留原有的 mock 數據生成函數作為備用方案
async function generateMockLesson(requirements: LessonRequirements): Promise<string> {
  await delay(2000)

  return `# ${requirements.lessonTopic || "STEAM Project"} - ${requirements.gradeLevel.toUpperCase()} Lesson

**Grade:** ${requirements.gradeLevel} | **Duration:** ${requirements.numberOfSessions} sessions × ${requirements.durationPerSession} minutes

**Domains:** ${requirements.steamDomains.join(", ")}

**Keywords:** hands-on, collaborative, inquiry-based, problem-solving

## Learning Objectives

1. Students will understand core concepts of ${requirements.lessonTopic}.
2. Students will apply scientific inquiry methods to investigate problems.
3. Students will collaborate effectively in teams to design and prototype solutions.
4. Students will communicate their findings and present their work to peers.

## Lesson Flow

\`\`\`mermaid
graph TB
    A[Session 1: Introduction] --> B[Session 2: Research & Design]
    B --> C[Session 3: Build & Test]
    C --> D[Final Presentation]
\`\`\`

## Activities

### 1. Introduction & Problem Definition (${requirements.durationPerSession} min)

\`\`\`mermaid
graph TD
    A[Present Challenge] --> B[Class Discussion]
    B --> C[Form Teams]
    C --> D[Brainstorm Ideas]
\`\`\`

**Steps:**
1. Present challenge and real-world context
2. Facilitate class discussion on existing knowledge
3. Break students into teams of 4-5
4. Teams brainstorm initial ideas and questions

**Materials:**
- Whiteboard
- Markers
- Post-it notes
- Laptops or tablets

### 2. Research & Design (${requirements.durationPerSession} min)

**Steps:**
1. Teams research topic using provided resources
2. Students sketch initial designs and prototypes
3. Peer feedback session
4. Refine designs based on feedback

**Materials:**
- Sketch paper
- Colored pencils
- Reference materials

### 3. Build & Test (${requirements.durationPerSession} min)

**Steps:**
1. Teams build their prototypes
2. Test prototypes and record observations
3. Iterate on designs based on test results
4. Prepare presentation materials

**Materials:**
- Building materials (varies by project)
- Testing equipment
- Documentation sheets

## Assessment

### Understanding of Concepts
Demonstrates clear understanding of core STEAM concepts through written and oral explanations.

### Problem-Solving Skills
Applies creative thinking and systematic approaches to solve challenges.

### Collaboration
Works effectively in teams, contributes ideas, and respects diverse perspectives.

### Presentation Quality
Clearly communicates process, findings, and learning outcomes.

## Resources

Recommended readings and online resources. Additional materials available in school library.

## Safety Considerations

Ensure proper supervision when using tools or equipment. Review safety protocols before hands-on activities. Maintain clean workspace.`
}

export async function sendChatMessage(
  message: string,
  currentLesson: string,
): Promise<{ reply: string; suggestedChange?: string }> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, currentLesson }),
    })

    if (!response.ok) {
      throw new Error("Chat request failed")
    }

    return await response.json()
  } catch (error) {
    console.error("聊天 API 錯誤:", error)
    return { reply: "Sorry, an error occurred. Please try again." }
  }
}

export async function getAllSavedLessons(
  searchQuery?: string,
  filters?: {
    userId?: string
    gradeLevels?: string[]
    domains?: string[]
    dateFrom?: string
    dateTo?: string
    showArchived?: boolean
    showFavoriteOnly?: boolean
  },
  sortBy: SortBy = "updatedAt",
  sortOrder: SortOrder = "desc",
): Promise<SavedLesson[]> {
  try {
    const currentUser = getCurrentUser()
    const userId = filters?.userId || currentUser?.id

    const params = new URLSearchParams()
    if (userId) params.append("userId", userId)
    if (searchQuery) params.append("search", searchQuery)
    if (sortBy) params.append("sortBy", sortBy)
    if (sortOrder) params.append("sortOrder", sortOrder)
    if (filters?.showArchived) params.append("showArchived", "true")
    if (filters?.showFavoriteOnly) params.append("showFavoriteOnly", "true")
    if (filters?.gradeLevels?.length) params.append("gradeLevels", filters.gradeLevels.join(","))
    if (filters?.domains?.length) params.append("domains", filters.domains.join(","))
    if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom)
    if (filters?.dateTo) params.append("dateTo", filters.dateTo)

    const res = await fetch(`/api/lessons?${params.toString()}`)
    if (!res.ok) throw new Error("Failed to fetch lessons")

    const data = await res.json()
    return data.lessons || []
  } catch (error) {
    console.error("Error fetching lessons:", error)
    return []
  }
}

export async function saveLesson(markdown: string, requirements: LessonRequirements, existingId?: string): Promise<SavedLesson | null | 'auth_required'> {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser) return 'auth_required'

    // Extract title from markdown
    const titleMatch = markdown.match(/^# (.+)$/m)
    const title = titleMatch?.[1] || "Untitled Lesson"

    if (existingId) {
      const res = await fetch(`/api/lessons/${existingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, requirements }),
      })
      if (!res.ok) throw new Error("Failed to update lesson")
      const data = await res.json()
      return data.lesson
    } else {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          title,
          markdown,
          requirements,
        }),
      })
      if (!res.ok) throw new Error("Failed to save lesson")
      const data = await res.json()
      return data.lesson
    }
  } catch (error) {
    console.error("Error saving lesson:", error)
    return null
  }
}

export async function updateLesson(id: string, updates: Partial<SavedLesson>): Promise<SavedLesson | null> {
  try {
    const res = await fetch(`/api/lessons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error("Failed to update lesson")
    const data = await res.json()
    return data.lesson
  } catch (error) {
    console.error("Error updating lesson:", error)
    return null
  }
}

export async function getLessonById(id: string): Promise<SavedLesson | null> {
  try {
    const res = await fetch(`/api/lessons/${id}`)
    if (!res.ok) throw new Error("Failed to fetch lesson")
    const data = await res.json()
    return data.lesson
  } catch (error) {
    console.error("Error fetching lesson:", error)
    return null
  }
}

export async function deleteLesson(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/lessons/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete lesson")
  } catch (error) {
    console.error("Error deleting lesson:", error)
  }
}

export async function toggleFavorite(id: string): Promise<SavedLesson | null> {
  try {
    const res = await fetch(`/api/lessons/${id}`)
    if (!res.ok) throw new Error("Failed to fetch lesson")
    const data = await res.json()
    return updateLesson(id, { isFavorite: !data.lesson.isFavorite })
  } catch (error) {
    console.error("Error toggling favorite:", error)
    return null
  }
}

export async function archiveLesson(id: string): Promise<SavedLesson | null> {
  return updateLesson(id, { isArchived: true })
}

export async function duplicateLesson(id: string): Promise<SavedLesson | null> {
  try {
    const res = await fetch(`/api/lessons/${id}`)
    if (!res.ok) throw new Error("Failed to fetch lesson")
    const data = await res.json()
    return saveLesson(data.lesson.lessonPlan, data.lesson.requirements)
  } catch (error) {
    console.error("Error duplicating lesson:", error)
    return null
  }
}

export function exportLessonPdf(
  markdown: string,
  template: PdfTemplate,
  includeImages: boolean,
): Promise<Blob>;
/**
 * @deprecated Use `PdfTemplate` for `template` (from `types/settings.ts`).
 * This overload exists for backward compatibility with older callers.
 */
export function exportLessonPdf(
  markdown: string,
  template: string,
  includeImages: boolean,
): Promise<Blob>;
export async function exportLessonPdf(
  markdown: string,
  template: PdfTemplate | string,
  includeImages: boolean,
): Promise<Blob> {
  const normalizedTemplate: PdfTemplate = isPdfTemplate(template) ? template : "standard"
  const preparedMarkdown = await preprocessMarkdownForPdf(markdown, includeImages)
  const res = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown: preparedMarkdown, template: normalizedTemplate, includeImages }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || "Failed to export PDF")
  }

  return await res.blob()
}

async function preprocessMarkdownForPdf(markdown: string, includeImages: boolean): Promise<string> {
  if (!includeImages) return markdown
  if (typeof window === "undefined") return markdown
  try {
    return await replaceMermaidBlocksWithImages(markdown)
  } catch (error) {
    console.error("Failed to render mermaid for PDF export:", error)
    return markdown
  }
}

export async function replaceMermaidBlocksWithImages(markdown: string): Promise<string> {
  const mermaidModule = await import("mermaid")
  const mermaid = mermaidModule.default
  const fontFamily = MERMAID_FALLBACK_FONT_STACK
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    flowchart: {
      useMaxWidth: true,
      htmlLabels: false,
    },
    themeVariables: {
      fontFamily,
      fontFamilyMono: fontFamily,
      fontFamilySecondary: fontFamily,
    },
  })

  const pattern = /```mermaid\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null
  let lastIndex = 0
  let diagramIndex = 0
  let output = ""

  while ((match = pattern.exec(markdown))) {
    const chart = match[1]?.trim()
    output += markdown.slice(lastIndex, match.index)
    if (chart) {
      const id = `export-mermaid-${Date.now()}-${diagramIndex++}`
      const { svg } = await mermaid.render(id, chart)
      // 在浏览器端直接转换为 PNG，避免服务端字体问题
      const { dataUrl: pngDataUrl, width, height } = await svgToPngInBrowser(svg)
      // 在 alt 中包含尺寸信息，格式: Mermaid Diagram|width:height
      output += `![Mermaid Diagram|${Math.round(width)}:${Math.round(height)}](${pngDataUrl})`
    } else {
      output += match[0]
    }
    lastIndex = pattern.lastIndex
  }

  output += markdown.slice(lastIndex)
  return output
}

async function svgToPngInBrowser(svgString: string): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    // 从 SVG 中提取尺寸
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml")
    const svgEl = svgDoc.documentElement

    // 获取 viewBox 或 width/height
    const viewBox = svgEl.getAttribute("viewBox")
    let width = parseFloat(svgEl.getAttribute("width") || "0")
    let height = parseFloat(svgEl.getAttribute("height") || "0")

    if (viewBox && (!width || !height)) {
      const parts = viewBox.split(/\s+|,/).map(Number)
      if (parts.length >= 4) {
        width = width || parts[2]
        height = height || parts[3]
      }
    }

    // 默认尺寸
    width = width || 800
    height = height || 600

    const base64 = btoa(unescape(encodeURIComponent(svgString)))
    const dataUrl = `data:image/svg+xml;base64,${base64}`

    img.onload = () => {
      const canvas = document.createElement("canvas")
      const scale = 3 // 高清渲染，提高到 3 倍以保证 PDF 缩放后清晰
      const finalWidth = img.naturalWidth || width
      const finalHeight = img.naturalHeight || height
      canvas.width = finalWidth * scale
      canvas.height = finalHeight * scale
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Failed to get canvas context"))
        return
      }
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, finalWidth, finalHeight)
      resolve({ dataUrl: canvas.toDataURL("image/png"), width: finalWidth, height: finalHeight })
    }

    img.onerror = () => {
      reject(new Error("Failed to load SVG image"))
    }

    img.src = dataUrl
  })
}

export function exportLessonWord(
  markdown: string,
  template: WordTemplate,
  includeImages: boolean,
): Promise<Blob>;
/**
 * @deprecated Use `WordTemplate` for `template` (from `types/settings.ts`).
 * This overload exists for backward compatibility with older callers.
 */
export function exportLessonWord(
  markdown: string,
  template: string,
  includeImages: boolean,
): Promise<Blob>;
export async function exportLessonWord(
  markdown: string,
  template: WordTemplate | string,
  includeImages: boolean,
): Promise<Blob> {
  const normalizedTemplate: WordTemplate = isWordTemplate(template) ? template : "standard"
  const preparedMarkdown = await preprocessMarkdownForPdf(markdown, includeImages)
  const res = await fetch("/api/export/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown: preparedMarkdown, template: normalizedTemplate, includeImages }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || "Failed to export Word document")
  }

  return await res.blob()
}
