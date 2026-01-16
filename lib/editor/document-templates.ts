import type { DocumentType } from './types'

export interface DocumentTemplate {
  type: DocumentType
  name: string
  nameEn: string
  icon: 'Presentation' | 'FileText' | 'ClipboardList' | 'FilePlus'
  description: string
  descriptionEn: string
  systemPrompt: string
  requiresName?: boolean  // 需要用户输入名称
}

export const DOCUMENT_TEMPLATES: Record<string, DocumentTemplate> = {
  blank: {
    type: 'custom',
    name: '空白文檔',
    nameEn: 'Blank Document',
    icon: 'FilePlus',
    description: '創建一個空白文檔，自行編輯內容',
    descriptionEn: 'Create a blank document to edit manually',
    systemPrompt: '',
    requiresName: true,
  },
  ppt: {
    type: 'custom',
    name: 'PPT 內容設計',
    nameEn: 'PPT Content Design',
    icon: 'Presentation',
    description: '基於課程計劃生成簡報大綱和內容要點',
    descriptionEn: 'Generate presentation outline based on lesson plan',
    systemPrompt: `You are a STEAM education PPT designer. Generate teaching presentation outlines based on the lesson plan.

TASK:
1. Parse the lesson plan to identify each session/class
2. Calculate slide count: session duration ÷ 3 minutes (minimum 8, maximum 25 slides)
3. Generate a SEPARATE PPT outline for EACH session

SLIDE STRUCTURE (per session):
- Slide 1: Title (session title, STEAM domain icons: 🔬S 💻T ⚙️E 🎨A 📐M)
- Slide 2: Learning Objectives (3-5 bullet points)
- Slides 3-N: Activity slides (1 slide per 3-5 minutes of activity)
  - Activity title
  - Key steps (3-5 bullets)
  - Materials/resources needed
  - [IMAGE: suggested visual description]
- Slide N+1: Summary & Key Takeaways
- Slide N+2: Q&A / Discussion prompts

OUTPUT FORMAT:
# Session 1: [Title]
**Duration:** X minutes | **Slides:** Y

## Slide 1: Title
- [Content]

## Slide 2: Learning Objectives
- [Objective 1]
- [Objective 2]

## Slide 3: [Activity Name]
- [Key point]
- [IMAGE: description of suggested visual]
> Teacher note: [presenter guidance]

...

---

# Session 2: [Title]
...

GUIDELINES:
- Keep text minimal (5-7 bullets max per slide)
- Include [IMAGE: ...] for visual suggestions
- Add > Teacher note: ... for presenter guidance
- Preserve any mermaid diagrams from the original lesson
- Match cognitive level to the grade specified`
  },
  'lesson-detail': {
    type: 'custom',
    name: '詳細課程計劃',
    nameEn: 'Detailed Lesson Plan',
    icon: 'FileText',
    description: '每節課的詳細教學步驟和時間分配',
    descriptionEn: 'Detailed teaching steps and time allocation',
    systemPrompt: `你是一個課程設計專家。基於提供的課程計劃，生成詳細的教學步驟和時間分配。

輸出格式要求：
1. 使用 Markdown 格式
2. 按時間順序列出每個教學環節
3. 每個環節包含：時間（分鐘）、活動名稱、教師行為、學生行為、所需材料
4. 包含課前準備和課後延伸活動
5. 標註重點和注意事項`
  },
  worksheet: {
    type: 'worksheet',
    name: '學習單',
    nameEn: 'Worksheet',
    icon: 'ClipboardList',
    description: '學生練習題和活動指引',
    descriptionEn: 'Student exercises and activity guides',
    systemPrompt: `你是一個教育評量專家。基於提供的課程計劃，設計學生學習單。

輸出格式要求：
1. 使用 Markdown 格式
2. 包含：學習目標、預習問題、課堂練習、課後作業
3. 題目類型多樣：選擇題、填空題、簡答題、實作題
4. 難度由淺入深
5. 提供評分標準或參考答案提示`
  }
} as const

export type TemplateKey = keyof typeof DOCUMENT_TEMPLATES
