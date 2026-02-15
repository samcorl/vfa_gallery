import type { HonoContext } from '../../../types/env'
import { Errors } from '../errors'

/**
 * Rate Limiting Middleware
 *
 * Enforces tiered rate limits based on endpoint category
 * Uses in-memory Map store with automatic cleanup of expired entries
 */

type RateLimitTier = 'GENERAL' | 'UPLOAD' | 'AUTH' | 'PUBLIC' | 'MESSAGE'

interface RateLimitTierConfig {
  maxRequests: number
  windowSeconds: number
}

const RATE_LIMIT_TIERS: Record<RateLimitTier, RateLimitTierConfig> = {
  GENERAL: { maxRequests: 100, windowSeconds: 60 },
  UPLOAD: { maxRequests: 10, windowSeconds: 3600 },
  AUTH: { maxRequests: 5, windowSeconds: 60 },
  PUBLIC: { maxRequests: 200, windowSeconds: 60 },
  MESSAGE: { maxRequests: 10, windowSeconds: 3600 },
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store for rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>()

// Global counter for cleanup trigger
let globalCheckCount = 0

/**
 * Get rate limit key from context
 * Returns user:${userId} for authenticated users, ip:${ip} for anonymous
 */
function getRateLimitKey(c: HonoContext): string {
  const user = c.get('user')
  if (user?.userId) {
    return `user:${user.userId}`
  }

  const ip =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For') ||
    'unknown'

  return `ip:${ip}`
}

/**
 * Check if a request is within rate limit
 * Returns object with allowed status, current count, and reset time
 */
function checkLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; count: number; resetAt: number; remaining: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  let current: RateLimitEntry

  if (!entry || now > entry.resetAt) {
    // Create new entry
    current = {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    }
  } else {
    // Increment existing entry
    current = {
      count: entry.count + 1,
      resetAt: entry.resetAt,
    }
  }

  rateLimitStore.set(key, current)

  const allowed = current.count <= maxRequests
  const remaining = Math.max(0, maxRequests - current.count)

  return {
    allowed,
    count: current.count,
    resetAt: current.resetAt,
    remaining,
  }
}

/**
 * Clean up expired entries from the rate limit store
 * Called periodically to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  const keysToDelete: string[] = []

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      keysToDelete.push(key)
    }
  }

  for (const key of keysToDelete) {
    rateLimitStore.delete(key)
  }
}

/**
 * Create rate limit middleware for a specific tier
 */
function rateLimitMiddleware(tier: RateLimitTier = 'GENERAL') {
  const config = RATE_LIMIT_TIERS[tier]

  return async (c: HonoContext, next: () => Promise<void>) => {
    const path = c.req.path

    // Skip rate limiting for health checks
    if (path === '/health' || path === '/api/health') {
      await next()
      return
    }

    const key = getRateLimitKey(c)
    const limitResult = checkLimit(key, config.maxRequests, config.windowSeconds)

    // Every 100th check, clean up expired entries
    globalCheckCount++
    if (globalCheckCount % 100 === 0) {
      cleanupExpiredEntries()
    }

    // Set rate limit headers
    c.header('X-RateLimit-Limit', config.maxRequests.toString())
    c.header('X-RateLimit-Remaining', limitResult.remaining.toString())
    c.header('X-RateLimit-Reset', Math.ceil(limitResult.resetAt / 1000).toString())

    // Enforce rate limit
    if (!limitResult.allowed) {
      const retryAfterSeconds = Math.ceil((limitResult.resetAt - Date.now()) / 1000)
      throw Errors.rateLimited(retryAfterSeconds)
    }

    await next()
  }
}

/**
 * Convenience middleware exports for specific tiers
 */
export const uploadRateLimit = rateLimitMiddleware('UPLOAD')
export const authRateLimit = rateLimitMiddleware('AUTH')
export const publicRateLimit = rateLimitMiddleware('PUBLIC')
export const messageRateLimit = rateLimitMiddleware('MESSAGE')

/**
 * Export the main middleware and tier function
 */
export { rateLimitMiddleware }

/**
 * Clear rate limit data (for testing)
 */
export function clearRateLimitData(): void {
  rateLimitStore.clear()
  globalCheckCount = 0
}
