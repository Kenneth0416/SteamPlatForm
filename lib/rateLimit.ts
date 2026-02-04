import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextRequest, NextResponse } from "next/server"

// Rate limit types
export type RateLimitType = "default" | "strict" | "ai" | "export"

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

// 不同類型的速率限制配置
const limiters: Record<RateLimitType, Ratelimit | null> = {
  default: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
    analytics: true,
  }) : null,

  strict: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 requests per 15 minutes
    analytics: true,
  }) : null,

  ai: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"), // 5 AI requests per 10 minutes
    analytics: true,
  }) : null,

  export: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "5 m"), // 10 exports per 5 minutes
    analytics: true,
  }) : null,
}

/**
 * Apply rate limiting to a request
 * @param request The NextRequest object
 * @param handler The handler function to execute if rate limit allows
 * @param type The type of rate limit to apply (default: "default")
 */
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<Response>,
  type: RateLimitType = "default"
): Promise<Response> {
  const limiter = limiters[type]

  // Skip rate limiting if Redis is not configured
  if (!limiter) {
    return handler()
  }

  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "anonymous"
  const identifier = `${type}:${ip}` // Include type in identifier for separate limits

  const { success, limit, reset, remaining } = await limiter.limit(identifier)

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  const response = await handler()
  if (response.headers) {
    response.headers.set("X-RateLimit-Limit", limit.toString())
    response.headers.set("X-RateLimit-Remaining", remaining.toString())
    response.headers.set("X-RateLimit-Reset", reset.toString())
  }
  return response
}

/**
 * Get rate limit info for a specific type (for client-side display)
 */
export function getRateLimitInfo(type: RateLimitType) {
  const info = {
    default: { limit: 10, window: 60, description: "10 requests per minute" },
    strict: { limit: 5, window: 900, description: "5 requests per 15 minutes" },
    ai: { limit: 5, window: 600, description: "5 AI requests per 10 minutes" },
    export: { limit: 10, window: 300, description: "10 exports per 5 minutes" },
  }
  return info[type]
}
