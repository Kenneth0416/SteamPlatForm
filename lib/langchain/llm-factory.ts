import { ChatOpenAI } from "@langchain/openai"

export interface LLMClientOptions {
  model?: string
  apiKey?: string
  baseURL?: string
  temperature?: number
  maxTokens?: number
}

export type LLMClientPreset = "lessonGeneration" | "documentEditing" | "chatCompletion"

const PRESETS: Record<LLMClientPreset, LLMClientOptions> = {
  lessonGeneration: {
    // Use deepseek-reasoner for higher quality curriculum planning
    // Falls back to deepseek-chat if REASONER_FOR_LESSON is not set
    model: process.env.REASONER_FOR_LESSON === "true" ? "deepseek-reasoner" : undefined,
    temperature: 0.7,
    maxTokens: 8192, // Increased from 4096 to accommodate reasoner's longer outputs
  },
  documentEditing: {
    temperature: 0.2,
    maxTokens: 8192,
  },
  chatCompletion: {
    temperature: 0.2,
    maxTokens: 4096,
  },
}

/**
 * Create a DeepSeek LLM client with optional configuration
 */
export function createLLMClient(
  options: LLMClientOptions | LLMClientPreset = "lessonGeneration"
): ChatOpenAI {
  // Check if options is a preset string
  const presetOptions = typeof options === "string" ? PRESETS[options] : undefined
  const config = presetOptions || options

  const apiKey = (typeof options === "object" ? options.apiKey : undefined) || process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set")
  }

  // Determine model to use
  const model = config?.model || process.env.DEEPSEEK_MODEL || "deepseek-chat"

  // Log model selection for monitoring
  if (presetOptions) {
    console.log(`[LLM Factory] Using preset "${options}" with model: ${model}`)
    if (model.includes("reasoner")) {
      console.log(`[LLM Factory] ⚠️  Reasoner model enabled - expect higher latency but better quality`)
    }
  }

  return new ChatOpenAI({
    model,
    apiKey,
    configuration: {
      baseURL: config?.baseURL || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    },
    temperature: config?.temperature ?? 0.7,
    maxTokens: config?.maxTokens ?? 4096,
  })
}
