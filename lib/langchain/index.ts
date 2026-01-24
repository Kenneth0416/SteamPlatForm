import { StringOutputParser } from "@langchain/core/output_parsers"
import { getLessonPrompt, getChatPrompt } from "./prompts"
import { createLLMClient } from "./llm-factory"
import { withRetry } from "./retry"
import type { LessonRequirements } from "@/types/lesson"

export async function generateLesson(requirements: LessonRequirements, lang: "en" | "zh" = "en"): Promise<string> {
  return withRetry(async () => {
    const llm = createLLMClient("lessonGeneration")
    const prompt = getLessonPrompt(lang)
    const chain = prompt.pipe(llm).pipe(new StringOutputParser())

    return await chain.invoke({
    lessonTopic: requirements.lessonTopic || (lang === "zh" ? "STEAM 專題" : "STEAM Project"),
    gradeLevel: requirements.gradeLevel,
    numberOfSessions: requirements.numberOfSessions.toString(),
    durationPerSession: requirements.durationPerSession.toString(),
    classSize: (requirements.classSize || 25).toString(),
    steamDomains: requirements.steamDomains.join(", "),
    teachingApproach: requirements.teachingApproach,
    difficultyLevel: requirements.difficultyLevel,
    schoolThemes: requirements.schoolThemes.join(", "),
    notes: requirements.notes ? `\nAdditional Notes: ${requirements.notes}` : "",
  }, {
    runName: "generate-lesson",
    metadata: { lang, topic: requirements.lessonTopic },
  })
  })
}

export async function* generateLessonStream(requirements: LessonRequirements, lang: "en" | "zh" = "en"): AsyncGenerator<string> {
  const llm = createLLMClient("lessonGeneration")
  const prompt = getLessonPrompt(lang)
  const chain = prompt.pipe(llm)

  const stream = await chain.stream({
    lessonTopic: requirements.lessonTopic || (lang === "zh" ? "STEAM 專題" : "STEAM Project"),
    gradeLevel: requirements.gradeLevel,
    numberOfSessions: requirements.numberOfSessions.toString(),
    durationPerSession: requirements.durationPerSession.toString(),
    classSize: (requirements.classSize || 25).toString(),
    steamDomains: requirements.steamDomains.join(", "),
    teachingApproach: requirements.teachingApproach,
    difficultyLevel: requirements.difficultyLevel,
    schoolThemes: requirements.schoolThemes.join(", "),
    notes: requirements.notes ? `\nAdditional Notes: ${requirements.notes}` : "",
  }, {
    runName: "generate-lesson-stream",
    metadata: { lang, topic: requirements.lessonTopic },
  })

  for await (const chunk of stream) {
    if (chunk.content) {
      yield chunk.content.toString()
    }
  }
}

export interface ChatStreamChunk {
  type: "content" | "suggested_change" | "done"
  content?: string
}

export async function* chatWithLessonStream(
  userMessage: string,
  currentLesson: string,
  lang: "en" | "zh" = "en"
): AsyncGenerator<ChatStreamChunk> {
  const llm = createLLMClient("chatCompletion")
  const prompt = getChatPrompt(lang)
  const chain = prompt.pipe(llm)

  const stream = await chain.stream({
    currentLesson,
    userMessage,
  }, {
    runName: "chat-with-lesson-stream",
    metadata: { lang },
  })

  let fullContent = ""

  for await (const chunk of stream) {
    if (chunk.content) {
      const text = chunk.content.toString()
      fullContent += text
      yield { type: "content", content: text }
    }
  }

  // 检查是否需要显示 Apply Change 按钮
  const needsChange = fullContent.includes("[NEEDS_CHANGE]")
  if (needsChange) {
    yield { type: "suggested_change", content: "true" }
  }

  yield { type: "done" }
}

export async function chatWithLesson(
  userMessage: string,
  currentLesson: string,
  lang: "en" | "zh" = "en"
): Promise<{ reply: string; suggestedChange?: string }> {
  return withRetry(async () => {
    const llm = createLLMClient("chatCompletion")
    const prompt = getChatPrompt(lang)
    const chain = prompt.pipe(llm).pipe(new StringOutputParser())

    const result = await chain.invoke({
    currentLesson,
    userMessage,
  }, {
    runName: "chat-with-lesson",
    metadata: { lang },
  })

  // 检查是否需要显示 Apply Change 按钮
  const needsChange = result.includes("[NEEDS_CHANGE]")
  const reply = result.replace(/\[(NEEDS_CHANGE|NO_CHANGE)\]/g, "").trim()

  return {
    reply,
    suggestedChange: needsChange ? "true" : undefined,
  }
  })
}
