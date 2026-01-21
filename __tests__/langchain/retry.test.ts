import { describe, it, expect, jest } from "@jest/globals"
import { withRetry, withRetryDetailed } from "@/lib/langchain/retry"

describe("Retry Utility", () => {
  describe("withRetry", () => {
    it("should return result on first successful attempt", async () => {
      const fn = jest.fn().mockResolvedValue("success")

      const result = await withRetry(fn)

      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("should retry on retryable errors", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue("success")

      const result = await withRetry(fn, { maxRetries: 2, baseDelay: 10 })

      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(2)
    }, 10000)

    it("should respect maxRetries limit", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("Network error"))

      await expect(withRetry(fn, { maxRetries: 1, baseDelay: 10 })).rejects.toThrow("Network error")
      expect(fn).toHaveBeenCalledTimes(2) // 1 initial + 1 retry
    }, 10000)

    it("should not retry on non-retryable errors", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("Invalid input"))

      await expect(withRetry(fn)).rejects.toThrow("Invalid input")
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("should use exponential backoff", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue("success")

      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 })

      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
    }, 10000)

    it("should respect custom shouldRetry function", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("Custom error"))
      const shouldRetry = jest.fn().mockReturnValue(false)

      await expect(withRetry(fn, { shouldRetry })).rejects.toThrow("Custom error")
      expect(fn).toHaveBeenCalledTimes(1)
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error))
    })

    it("should retry on 429 rate limit errors", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("429 Too Many Requests"))
        .mockResolvedValue("success")

      const result = await withRetry(fn, { baseDelay: 10 })

      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(2)
    }, 10000)

    it("should retry on 5xx server errors", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("500 Internal Server Error"))
        .mockResolvedValue("success")

      const result = await withRetry(fn, { baseDelay: 10 })

      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(2)
    }, 10000)

    it("should not retry on 4xx client errors", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("400 Bad Request"))

      await expect(withRetry(fn)).rejects.toThrow("400 Bad Request")
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("withRetryDetailed", () => {
    it("should return successful result with data and attempts", async () => {
      const fn = jest.fn().mockResolvedValue("success")

      const result = await withRetryDetailed(fn)

      expect(result.data).toBe("success")
      expect(result.error).toBeNull()
      expect(result.attempts).toBe(1)
    })

    it("should return error result after max retries", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("Network error"))

      const result = await withRetryDetailed(fn, { maxRetries: 1, baseDelay: 10 })

      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe("Network error")
      expect(result.attempts).toBe(2) // 1 initial + 1 retry
    }, 10000)

    it("should track retry attempts correctly", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue("success")

      const result = await withRetryDetailed(fn, { maxRetries: 3, baseDelay: 10 })

      expect(result.data).toBe("success")
      expect(result.error).toBeNull()
      expect(result.attempts).toBe(3) // 1 initial + 2 retries
    }, 10000)
  })
})
