import type { ExportLesson, ExportSection } from "@/lib/export/types"

type ParsedSection = {
  title: string
  contentLines: string[]
  items: string[]
  level: number
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

function stripMarkdownEmphasis(text: string): string {
  return text.replace(/\*\*/g, "").replace(/__/g, "").trim()
}

function normalizeKey(key: string): string {
  return stripMarkdownEmphasis(key)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[：:]\s*$/g, "")
    .trim()
}

function cleanValue(value: string): string {
  return stripMarkdownEmphasis(value).replace(/\s+/g, " ").trim()
}

function titleIncludes(title: string, variants: string[]): boolean {
  const normalized = title.toLowerCase()
  return variants.some(v => normalized.includes(v.toLowerCase()))
}

function extractKeyValueSegments(line: string): Array<{ key: string; value: string }> {
  const cleaned = stripMarkdownEmphasis(line)
  const segments = cleaned
    .split("|")
    .map(s => s.trim())
    .filter(Boolean)

  const pairs: Array<{ key: string; value: string }> = []
  for (const segment of segments) {
    const match = segment.match(/^(.+?)[：:]\s*(.+)$/)
    if (match) pairs.push({ key: match[1], value: match[2] })
  }
  return pairs
}

function extractMetadataFromIntro(introLines: string[]): {
  title?: string
  overview: string
  gradeLevel: string
  subject: string
  duration: string
} {
  let gradeLevel = ""
  let subject = ""
  let duration = ""

  const overviewLines: string[] = []

  for (const rawLine of introLines) {
    const line = rawLine.trim()
    if (!line) {
      overviewLines.push("")
      continue
    }

    const pairs = extractKeyValueSegments(line)
    if (pairs.length === 0) {
      overviewLines.push(rawLine)
      continue
    }

    let consumedAsMetadata = false
    for (const { key, value } of pairs) {
      const k = normalizeKey(key)
      const v = cleanValue(value)

      if (!v) continue

      if (
        k === "grade" ||
        k === "grade level" ||
        k === "year" ||
        k === "年級" ||
        k === "年级" ||
        k === "班級" ||
        k === "班级"
      ) {
        gradeLevel = gradeLevel || v
        consumedAsMetadata = true
        continue
      }

      if (
        k === "subject" ||
        k === "domain" ||
        k === "domains" ||
        k === "領域" ||
        k === "领域" ||
        k === "科目" ||
        k === "學科" ||
        k === "学科"
      ) {
        subject = subject || v
        consumedAsMetadata = true
        continue
      }

      if (
        k === "duration" ||
        k === "time" ||
        k === "length" ||
        k === "時長" ||
        k === "时长" ||
        k === "時間" ||
        k === "时间"
      ) {
        duration = duration || v
        consumedAsMetadata = true
        continue
      }
    }

    if (!consumedAsMetadata) overviewLines.push(rawLine)
  }

  const overview = overviewLines.join("\n").trim()
  return { overview, gradeLevel, subject, duration }
}

function finalizeSection(section: ParsedSection | null): ExportSection | null {
  if (!section) return null
  const content = section.contentLines.join("\n").trim()
  const items = section.items.map(i => i.trim()).filter(Boolean)
  const title = section.title.trim()

  if (!title && !content && items.length === 0) return null
  return { title, content, items }
}

export function parseMarkdownToLesson(markdown: string): ExportLesson {
  const safeMarkdown = typeof markdown === "string" ? markdown : ""
  const text = normalizeText(safeMarkdown)

  const lesson: ExportLesson = {
    title: "",
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

  const lines = text.split("\n")
  const introLines: string[] = []
  let inCodeBlock = false
  let current: ParsedSection | null = null
  let sawAnySection = false

  const pushLine = (line: string) => {
    if (current) current.contentLines.push(line)
    else introLines.push(line)
  }

  const pushItem = (item: string) => {
    if (current) current.items.push(item)
    else introLines.push(`- ${item}`)
  }

  for (const rawLine of lines) {
    const line = rawLine

    const trimmed = line.trim()
    // Support both ``` and ''' as code block delimiters
    const fenceMatch = trimmed.match(/^(`{3}|'{3})/)
    if (fenceMatch) {
      inCodeBlock = !inCodeBlock
      pushLine(line)
      continue
    }

    // Also detect code blocks that start with "- ```" or "- '''"
    const bulletFenceMatch = trimmed.match(/^[-*]\s+(`{3}|'{3})/)
    if (bulletFenceMatch) {
      inCodeBlock = !inCodeBlock
      // Push the fence without the bullet prefix
      pushLine(trimmed.replace(/^[-*]\s+/, ""))
      continue
    }

    if (!inCodeBlock) {
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+?)\s*$/)
      if (headingMatch) {
        const level = headingMatch[1].length
        const title = headingMatch[2]

        if (level === 1 && !lesson.title) {
          lesson.title = title.trim()
          continue
        }

        if (level === 2 || level === 3) {
          const finalized = finalizeSection(current)
          if (finalized) lesson.sections.push(finalized)
          current = { title: title.trim(), contentLines: [], items: [], level }
          sawAnySection = true
          continue
        }

        pushLine(line)
        continue
      }

      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
      if (bulletMatch) {
        pushItem(bulletMatch[1])
        continue
      }

      const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
      if (orderedMatch) {
        pushItem(orderedMatch[1])
        continue
      }
    } else {
      // Inside code block - strip bullet prefix if present
      const strippedLine = trimmed.replace(/^[-*]\s+/, "")
      pushLine(strippedLine)
      continue
    }

    pushLine(line)
  }

  const last = finalizeSection(current)
  if (last) lesson.sections.push(last)

  if (!lesson.title) {
    const firstNonEmpty = lines.find(l => l.trim().length > 0) || ""
    const maybeHeading = firstNonEmpty.trim().match(/^#\s+(.+)$/)
    lesson.title = (maybeHeading?.[1] || firstNonEmpty).trim()
  }

  const { overview, gradeLevel, subject, duration } = extractMetadataFromIntro(introLines)
  lesson.overview = overview
  lesson.gradeLevel = gradeLevel
  lesson.subject = subject
  lesson.duration = duration

  if (!sawAnySection) {
    const contentLines = introLines
    const items: string[] = []
    const nonItemLines: string[] = []
    for (const introLine of contentLines) {
      const m = introLine.trim().match(/^[-*]\s+(.+)$/)
      if (m) items.push(m[1])
      else nonItemLines.push(introLine)
    }
    lesson.sections.push({
      title: "Content",
      content: nonItemLines.join("\n").trim(),
      items,
    })
  }

  const objectiveSections = lesson.sections.filter(s =>
    titleIncludes(s.title, ["learning objectives", "objectives", "學習目標", "学习目标", "教學目標", "教学目标", "目標", "目标"]),
  )
  const materialSections = lesson.sections.filter(s =>
    titleIncludes(s.title, ["materials", "準備材料", "准备材料", "材料"]),
  )
  const activitySections = lesson.sections.filter(s =>
    titleIncludes(s.title, ["activities", "activity", "活動", "活动"]),
  )
  const assessmentSections = lesson.sections.filter(s =>
    titleIncludes(s.title, ["assessment", "評量", "评价", "評估", "评估"]),
  )
  const standardsSections = lesson.sections.filter(s =>
    titleIncludes(s.title, ["standards", "standard", "標準", "标准", "對應", "对应"]),
  )
  const overviewSections = lesson.sections.filter(s => titleIncludes(s.title, ["overview", "概述", "簡介", "简介"]))

  if (overviewSections.length > 0 && overviewSections[0].content.trim()) {
    lesson.overview = overviewSections[0].content.trim()
  }

  const gatherItems = (sections: ExportSection[]): string[] =>
    sections.flatMap(s => (s.items.length > 0 ? s.items : s.content.split("\n"))).map(s => s.trim()).filter(Boolean)

  lesson.objectives = gatherItems(objectiveSections)
  lesson.materials = gatherItems(materialSections)
  lesson.assessment = gatherItems(assessmentSections)
  lesson.standards = gatherItems(standardsSections)

  if (activitySections.length > 0) {
    const activityItems = gatherItems(activitySections)
    lesson.activities = activityItems
  } else {
    lesson.activities = lesson.sections
      .filter(s => /^\s*\d+\.\s+/.test(s.title) || titleIncludes(s.title, ["activity", "活動", "活动"]))
      .map(s => s.title.trim())
      .filter(Boolean)
  }

  return lesson
}

