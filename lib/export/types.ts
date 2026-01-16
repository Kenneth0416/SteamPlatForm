export interface ExportSection {
  title: string
  content: string
  items: string[]
}

export interface ExportLesson {
  title: string
  overview: string
  gradeLevel: string
  subject: string
  duration: string
  objectives: string[]
  materials: string[]
  sections: ExportSection[]
  assessment: string[]
  standards: string[]
}

export type ExportTemplate = "standard" | "detailed" | "minimal"

