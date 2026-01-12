export type Lang = "en" | "zh"

export type GradeLevel = "p1-3" | "p4-6" | "s1-3" | "s4-6"

export type STEAMDomain = "S" | "T" | "E" | "A" | "M"

export type TeachingApproach = "inquiry" | "project" | "direct" | "collaborative" | "flipped"

export type DifficultyLevel = "beginner" | "intermediate" | "advanced"

export interface LessonRequirements {
  gradeLevel: GradeLevel
  numberOfSessions: number
  durationPerSession: number // in minutes
  classSize?: number
  steamDomains: STEAMDomain[]
  lessonTopic: string
  schoolThemes: string[]
  teachingApproach: TeachingApproach
  difficultyLevel: DifficultyLevel
}

export interface LessonOverview {
  title: string
  gradeLevel: string
  duration: string
  domains: STEAMDomain[]
  keywords: string[]
}

export interface LearningObjective {
  id: string
  text: string
}

export interface LessonActivity {
  id: string
  title: string
  duration: number // in minutes
  steps: string[]
  materials: string[]
  mermaidDiagram?: string // Optional mermaid diagram for activities
}

export interface AssessmentCriteria {
  criterion: string
  description: string
}

export interface LessonPlan {
  overview: LessonOverview
  learningObjectives: LearningObjective[]
  activities: LessonActivity[]
  assessment: AssessmentCriteria[]
  resources: string
  safetyConsiderations: string
  lessonFlowDiagram?: string // Optional mermaid diagram for overall lesson flow
}

export interface ToolCall {
  id: string
  name: string
  status: 'calling' | 'success' | 'error'
  result?: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  text: string
  suggestedChange?: string
  diffs?: Array<{
    id: string
    blockId: string
    action: 'update' | 'add' | 'delete'
    oldContent?: string
    newContent?: string
    reason?: string
  }>
  toolCalls?: ToolCall[]
  isThinking?: boolean // Added to indicate thinking/tool call messages
  isStreaming?: boolean // Added to indicate streaming message
}

export interface SavedLesson {
  id: string
  userId: string // Added to track ownership
  title: string
  markdown?: string
  lessonPlan: LessonPlan | { markdown: string }
  requirements: LessonRequirements
  chatHistory?: ChatMessage[]
  createdAt: string
  updatedAt: string
  tags?: string[]
  isFavorite?: boolean
  isArchived?: boolean
}

export type SortBy = "createdAt" | "updatedAt" | "title"
export type SortOrder = "asc" | "desc"
