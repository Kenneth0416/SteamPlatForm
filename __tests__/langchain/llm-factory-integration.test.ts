import { describe, it, expect, beforeEach, afterEach } from "@jest/globals"

describe("LLM Factory - Integration Tests", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("Environment Variable Configuration", () => {
    it("should use deepseek-chat by default for lessonGeneration", () => {
      process.env.DEEPSEEK_API_KEY = "test-key"
      process.env.DEEPSEEK_MODEL = "deepseek-chat"
      process.env.REASONER_FOR_LESSON = undefined

      // Dynamic import to get fresh module
      return import("@/lib/langchain/llm-factory").then(({ createLLMClient }) => {
        const client = createLLMClient("lessonGeneration")
        expect(client).toBeDefined()
        expect(client).toHaveProperty("bindTools")
        expect(client).toHaveProperty("invoke")
        expect(client).toHaveProperty("stream")
      })
    })

    it("should read REASONER_FOR_LESSON environment variable", () => {
      process.env.DEEPSEEK_API_KEY = "test-key"
      process.env.REASONER_FOR_LESSON = "true"

      return import("@/lib/langchain/llm-factory").then(({ createLLMClient }) => {
        const client = createLLMClient("lessonGeneration")
        expect(client).toBeDefined()
        // Client should be created successfully
      })
    })

    it("should throw error when API key is missing", () => {
      delete process.env.DEEPSEEK_API_KEY

      return import("@/lib/langchain/llm-factory").then(({ createLLMClient }) => {
        expect(() => createLLMClient()).toThrow("DEEPSEEK_API_KEY is not set")
      })
    })
  })

  describe("Preset Configurations", () => {
    it("should create client for lessonGeneration preset", () => {
      process.env.DEEPSEEK_API_KEY = "test-key"

      return import("@/lib/langchain/llm-factory").then(({ createLLMClient }) => {
        const client = createLLMClient("lessonGeneration")
        expect(client).toBeDefined()
        expect(client).toHaveProperty("bindTools")
      })
    })

    it("should create client for documentEditing preset", () => {
      process.env.DEEPSEEK_API_KEY = "test-key"

      return import("@/lib/langchain/llm-factory").then(({ createLLMClient }) => {
        const client = createLLMClient("documentEditing")
        expect(client).toBeDefined()
        expect(client).toHaveProperty("bindTools")
      })
    })

    it("should create client for chatCompletion preset", () => {
      process.env.DEEPSEEK_API_KEY = "test-key"

      return import("@/lib/langchain/llm-factory").then(({ createLLMClient }) => {
        const client = createLLMClient("chatCompletion")
        expect(client).toBeDefined()
        expect(client).toHaveProperty("bindTools")
      })
    })
  })

  describe("Custom Options", () => {
    it("should accept custom model configuration", () => {
      process.env.DEEPSEEK_API_KEY = "test-key"

      return import("@/lib/langchain/llm-factory").then(({ createLLMClient }) => {
        const client = createLLMClient({
          model: "custom-model",
          temperature: 0.5,
          maxTokens: 2048,
        })
        expect(client).toBeDefined()
      })
    })
  })
})
