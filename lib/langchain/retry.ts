/**
 * Retry utility for LLM API calls with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number // Base delay in milliseconds
  maxDelay?: number // Maximum delay in milliseconds
  shouldRetry?: (error: unknown) => boolean
}

export interface RetryResult<T> {
  data: T | null
  error: Error | null
  attempts: number
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  shouldRetry: (error: unknown) => {
    // Retry on network errors, rate limits, and server errors (5xx)
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase()
      // Network errors
      if (errorMessage.includes("network") || errorMessage.includes("timeout") || errorMessage.includes("econnrefused")) {
        return true
      }
      // HTTP status codes (if included in error message)
      if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
        return true
      }
      if (errorMessage.includes("500") || errorMessage.includes("502") || errorMessage.includes("503") || errorMessage.includes("504")) {
        return true
      }
    }
    return false
  },
}

/**
 * Calculate delay with exponential backoff
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  // Add jitter to avoid thundering herd
  const jitter = Math.random() * baseDelay
  return Math.min(exponentialDelay + jitter, maxDelay)
}

/**
 * Execute an async function with retry and exponential backoff
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise with result or error after all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        break
      }

      // Check if we should retry this error
      if (!opts.shouldRetry(error)) {
        break
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts.baseDelay, opts.maxDelay)
      console.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms. Error: ${lastError.message}`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Execute an async function with retry and return detailed result
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise with detailed result including attempts
 */
export async function withRetryDetailed<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const data = await fn()
      return { data, error: null, attempts: attempt + 1 }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        break
      }

      const delay = calculateDelay(attempt, opts.baseDelay, opts.maxDelay)
      console.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms. Error: ${lastError.message}`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return { data: null, error: lastError!, attempts: opts.maxRetries + 1 }
}
