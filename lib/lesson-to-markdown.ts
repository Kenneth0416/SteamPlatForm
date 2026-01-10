import type { LessonPlan, Lang } from "@/types/lesson"
import { getTranslation } from "@/lib/translations"

export function lessonToMarkdown(lesson: LessonPlan, lang: Lang): string {
  const t = getTranslation(lang)
  const lines: string[] = []

  // Title
  lines.push(`# ${lesson.overview.title}`)
  lines.push("")
  lines.push(`**${lang === "en" ? "Grade" : "年級"}:** ${lesson.overview.gradeLevel} | **${lang === "en" ? "Duration" : "時長"}:** ${lesson.overview.duration}`)
  lines.push("")
  lines.push(`**${lang === "en" ? "Domains" : "領域"}:** ${lesson.overview.domains.map(d => t.domains[d]).join(", ")}`)
  lines.push("")
  lines.push(`**${lang === "en" ? "Keywords" : "關鍵詞"}:** ${lesson.overview.keywords.join(", ")}`)
  lines.push("")

  // Learning Objectives
  lines.push(`## ${t.learningObjectives}`)
  lines.push("")
  lesson.learningObjectives.forEach((obj, i) => {
    lines.push(`${i + 1}. ${obj.text}`)
  })
  lines.push("")

  // Lesson Flow Diagram
  if (lesson.lessonFlowDiagram) {
    lines.push(`## ${t.lessonFlow}`)
    lines.push("")
    lines.push("```mermaid")
    lines.push(lesson.lessonFlowDiagram)
    lines.push("```")
    lines.push("")
  }

  // Activities
  lines.push(`## ${t.activities}`)
  lines.push("")
  lesson.activities.forEach((activity, i) => {
    lines.push(`### ${i + 1}. ${activity.title} (${activity.duration} min)`)
    lines.push("")
    if (activity.mermaidDiagram) {
      lines.push("```mermaid")
      lines.push(activity.mermaidDiagram)
      lines.push("```")
      lines.push("")
    }
    lines.push(`**${t.steps}:**`)
    activity.steps.forEach((step, j) => {
      lines.push(`${j + 1}. ${step}`)
    })
    lines.push("")
    lines.push(`**${t.materials}:**`)
    activity.materials.forEach(mat => {
      lines.push(`- ${mat}`)
    })
    lines.push("")
  })

  // Assessment
  lines.push(`## ${t.assessment}`)
  lines.push("")
  lesson.assessment.forEach(criteria => {
    lines.push(`### ${criteria.criterion}`)
    lines.push(criteria.description)
    lines.push("")
  })

  // Resources
  lines.push(`## ${t.resources}`)
  lines.push("")
  lines.push(lesson.resources)
  lines.push("")

  // Safety
  lines.push(`## ${t.safetyConsiderations}`)
  lines.push("")
  lines.push(lesson.safetyConsiderations)

  return lines.join("\n")
}

export function markdownToLesson(markdown: string, originalLesson: LessonPlan, lang: Lang): LessonPlan {
  const t = getTranslation(lang)
  const lesson = JSON.parse(JSON.stringify(originalLesson)) as LessonPlan

  // Parse title
  const titleMatch = markdown.match(/^# (.+)$/m)
  if (titleMatch) lesson.overview.title = titleMatch[1]

  // Parse learning objectives
  const objSection = markdown.match(new RegExp(`## ${t.learningObjectives}\\n\\n([\\s\\S]*?)(?=\\n## |$)`))
  if (objSection) {
    const objLines = objSection[1].trim().split("\n").filter(l => /^\d+\.\s/.test(l))
    lesson.learningObjectives = objLines.map((line, i) => ({
      id: lesson.learningObjectives[i]?.id || `obj-${Date.now()}-${i}`,
      text: line.replace(/^\d+\.\s*/, "")
    }))
  }

  // Parse activities
  const actSection = markdown.match(new RegExp(`## ${t.activities}\\n\\n([\\s\\S]*?)(?=\\n## ${t.assessment}|$)`))
  if (actSection) {
    const actBlocks = actSection[1].split(/(?=### \d+\.)/).filter(b => b.trim())
    lesson.activities = actBlocks.map((block, i) => {
      const existing = lesson.activities[i]
      const titleMatch = block.match(/### \d+\.\s*(.+?)\s*\((\d+)\s*min\)/)
      const mermaidMatch = block.match(/```mermaid\n([\s\S]*?)```/)
      const stepsMatch = block.match(new RegExp(`\\*\\*${t.steps}:\\*\\*\\n([\\s\\S]*?)(?=\\*\\*${t.materials}:|$)`))
      const matsMatch = block.match(new RegExp(`\\*\\*${t.materials}:\\*\\*\\n([\\s\\S]*?)(?=\\n### |$)`))

      return {
        id: existing?.id || `act-${Date.now()}-${i}`,
        title: titleMatch?.[1] || existing?.title || "",
        duration: parseInt(titleMatch?.[2] || "0") || existing?.duration || 0,
        mermaidDiagram: mermaidMatch?.[1]?.trim(),
        steps: stepsMatch ? stepsMatch[1].trim().split("\n").filter(l => /^\d+\.\s/.test(l)).map(l => l.replace(/^\d+\.\s*/, "")) : existing?.steps || [],
        materials: matsMatch ? matsMatch[1].trim().split("\n").filter(l => /^-\s/.test(l)).map(l => l.replace(/^-\s*/, "")) : existing?.materials || []
      }
    })
  }

  // Parse assessment
  const assSection = markdown.match(new RegExp(`## ${t.assessment}\\n\\n([\\s\\S]*?)(?=\\n## ${t.resources}|$)`))
  if (assSection) {
    const assBlocks = assSection[1].split(/(?=### )/).filter(b => b.trim())
    lesson.assessment = assBlocks.map((block, i) => {
      const existing = lesson.assessment[i]
      const critMatch = block.match(/### (.+)\n([\s\S]*)/)
      return {
        criterion: critMatch?.[1]?.trim() || existing?.criterion || "",
        description: critMatch?.[2]?.trim() || existing?.description || ""
      }
    })
  }

  // Parse resources
  const resSection = markdown.match(new RegExp(`## ${t.resources}\\n\\n([\\s\\S]*?)(?=\\n## ${t.safetyConsiderations}|$)`))
  if (resSection) lesson.resources = resSection[1].trim()

  // Parse safety
  const safeSection = markdown.match(new RegExp(`## ${t.safetyConsiderations}\\n\\n([\\s\\S]*)$`))
  if (safeSection) lesson.safetyConsiderations = safeSection[1].trim()

  return lesson
}
