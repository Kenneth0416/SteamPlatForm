import { ChatOpenAI } from "@langchain/openai"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { ChatPromptTemplate } from "@langchain/core/prompts"

type EditOperation =
  | { action: "replace"; old_text: string; new_text: string }
  | { action: "delete"; old_text: string }
  | { action: "insert_after"; anchor: string; new_text: string }
  | { action: "insert_before"; anchor: string; new_text: string }

interface EditResult {
  changes: EditOperation[]
  summary?: string
}

function createDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set")
  }

  return new ChatOpenAI({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    apiKey: apiKey,
    configuration: {
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    },
    temperature: 0.2,
  })
}

const EDIT_PROMPT_EN = `Return JSON only.
DOC:
{currentLesson}
REQ:
{suggestedChange}

Output: {{"changes":[...]}}
- replace: {{"action":"replace","old_text":"<exact substring>","new_text":"..."}}
- delete: {{"action":"delete","old_text":"<exact substring>"}}
- insert_after/before: {{"action":"insert_after","anchor":"<exact substring>","new_text":"..."}}
Rules: copy old_text/anchor exactly from DOC; keep changes minimal; make old_text/anchor unique.`

const EDIT_PROMPT_ZH = `只輸出 JSON（不要 markdown）。
文檔：
{currentLesson}
需求：
{suggestedChange}

輸出：{{"changes":[...]}}
- replace: {{"action":"replace","old_text":"<文檔精確片段>","new_text":"..."}}
- delete: {{"action":"delete","old_text":"<文檔精確片段>"}}
- insert_after/before: {{"action":"insert_after","anchor":"<文檔精確片段>","new_text":"..."}}
規則：old_text/anchor 必須直接從文檔複製；修改最小化；片段需足夠唯一。`

const MAX_LESSON_LENGTH = 50000
const MAX_CHANGE_LENGTH = 10000

function replaceAll(str: string, search: string, replace: string): string {
  return str.split(search).join(replace)
}

// Normalize text for fuzzy matching (strips markdown and whitespace)
function normalize(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1')      // *italic* → italic
    .replace(/`([^`]+)`/g, '$1')        // `code` → code
    .replace(/\s+/g, ' ')
    .trim()
}

// Find text with fuzzy matching (handles whitespace and markdown differences)
function fuzzyFind(document: string, search: string): string | null {
  // Try exact match first
  if (document.includes(search)) return search

  const normSearch = normalize(search)
  if (!normSearch) return null

  // Check if normalized search exists in normalized document
  const normDoc = normalize(document)
  if (!normDoc.includes(normSearch)) return null

  // Sliding window scan to find original substring that normalizes to normSearch
  // Use a reasonable window size based on search length (account for markdown chars)
  const minLen = normSearch.length
  const maxLen = Math.min(normSearch.length * 2 + 20, document.length)

  for (let start = 0; start < document.length - minLen + 1; start++) {
    for (let len = minLen; len <= maxLen && start + len <= document.length; len++) {
      const chunk = document.slice(start, start + len)
      if (normalize(chunk) === normSearch) {
        return chunk
      }
    }
  }

  return null
}

function applyEdits(document: string, changes: EditOperation[]): string {
  let result = document

  for (const change of changes) {
    switch (change.action) {
      case "replace": {
        const found = fuzzyFind(result, change.old_text)
        if (found) {
          result = replaceAll(result, found, change.new_text)
        } else {
          console.warn("Replace operation failed: old_text not found", { old_text: change.old_text.slice(0, 100) })
        }
        break
      }

      case "delete": {
        const found = fuzzyFind(result, change.old_text)
        if (found) {
          result = replaceAll(result, found, "")
        } else {
          console.warn("Delete operation failed: old_text not found", { old_text: change.old_text.slice(0, 100) })
        }
        break
      }

      case "insert_after": {
        const found = fuzzyFind(result, change.anchor)
        if (found) {
          result = replaceAll(result, found, found + change.new_text)
        } else {
          console.warn("Insert_after operation failed: anchor not found", { anchor: change.anchor.slice(0, 100) })
        }
        break
      }

      case "insert_before": {
        const found = fuzzyFind(result, change.anchor)
        if (found) {
          result = replaceAll(result, found, change.new_text + found)
        } else {
          console.warn("Insert_before operation failed: anchor not found", { anchor: change.anchor.slice(0, 100) })
        }
        break
      }
    }
  }

  return result
}

function parseEditResult(output: string): EditResult | null {
  try {
    // Remove markdown code blocks if present
    let jsonStr = output.trim()
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }
    return JSON.parse(jsonStr)
  } catch (error) {
    console.warn("Failed to parse edit result:", error)
    return null
  }
}

export async function applyChangeWithLLM(
  currentLesson: string,
  suggestedChange: string,
  lang: "en" | "zh" = "en"
): Promise<{ updatedLesson: string; summary: string }> {
  if (currentLesson.length > MAX_LESSON_LENGTH) {
    throw new Error(`Lesson exceeds maximum length of ${MAX_LESSON_LENGTH} characters`)
  }
  if (suggestedChange.length > MAX_CHANGE_LENGTH) {
    throw new Error(`Change request exceeds maximum length of ${MAX_CHANGE_LENGTH} characters`)
  }

  const llm = createDeepSeekClient()

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", lang === "zh" ? EDIT_PROMPT_ZH : EDIT_PROMPT_EN],
  ])

  const chain = prompt.pipe(llm).pipe(new StringOutputParser())

  const result = await chain.invoke({
    currentLesson,
    suggestedChange,
  }, {
    runName: "apply-change-agent",
    metadata: { lang, suggestedChange },
  })

  const editResult = parseEditResult(result)

  if (editResult && editResult.changes && editResult.changes.length > 0) {
    // Apply targeted edits
    const updatedLesson = applyEdits(currentLesson, editResult.changes)
    return {
      updatedLesson,
      summary: editResult.summary || (lang === "zh" ? "修改已完成" : "Changes applied")
    }
  }

  // Fallback: if parsing fails, return original
  console.warn("Failed to parse edit result, returning original document")
  return {
    updatedLesson: currentLesson,
    summary: lang === "zh" ? "無法解析修改指令" : "Could not parse edit instructions"
  }
}
