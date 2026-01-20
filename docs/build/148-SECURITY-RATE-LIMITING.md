# Build 148: Security - Global Rate Limiting

## Goal
Implement global API rate limiting to prevent abuse. Enforce 100 requests/minute for general API endpoints and 10 uploads/hour for image upload operations.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Rate Limits & Quotas**: Prevent abuse with configurable per-endpoint limits
- **New Account Limits**: Rapid uploads trigger suspicious activity flag
- **Infrastructure**: CloudFlare Pages and Workers provide native rate limiting capabilities

---

## Prerequisites

**Must complete before starting:**
- **Build 15**: API Foundation (Hono app setup)
- **Build 16**: API Middleware Auth (authentication context)
- **Build 17**: API Middleware Common (error handling)

---

## Steps

### Step 1: Create Rate Limiting Configuration

Create a configuration module for rate limit settings.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/config/rate-limits.ts`

```typescript
/**
 * Rate limiting configuration
 * All limits are per-user (identified by user ID or IP for public endpoints)
 */

export interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Max requests in the window
  messageMs?: number    // Custom message with retry-after
}

export const RATE_LIMITS = {
  // General API endpoints - 100 requests per minute
  API_GENERAL: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,
  } as RateLimitConfig,

  // Upload endpoints - 10 uploads per hour
  UPLOAD: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 10,
  } as RateLimitConfig,

  // Strict limit for auth endpoints - 5 attempts per minute
  AUTH: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 5,
  } as RateLimitConfig,

  // Public endpoints (search, browse) - 200 requests per minute
  PUBLIC: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 200,
  } as RateLimitConfig,

  // Message send - 10 messages per hour
  MESSAGE_SEND: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 10,
  } as RateLimitConfig,
}

/**
 * Get rate limit config by endpoint type
 */
export function getRateLimitConfig(endpointType: keyof typeof RATE_LIMITS): RateLimitConfig {
  return RATE_LIMITS[endpointType]
}
```

### Step 2: Create In-Memory Rate Limiting Store

For a CloudFlare Workers environment, we'll use Durable Objects or a simple in-memory store (KV for persistent storage). For development, start with in-memory.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/rate-limit-store.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types'

/**
 * Rate limit entry tracking request counts
 */
interface RateLimitEntry {
  count: number
  resetAt: number  // Unix timestamp in milliseconds
}

/**
 * In-memory store for rate limiting
 * In production, consider using KV for persistence across workers
 */
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map()

  /**
   * Increment counter for a key (user ID or IP)
   * @param key Unique identifier (userId or IP)
   * @param windowMs Time window in milliseconds
   * @returns Current count and reset time
   */
  increment(key: string, windowMs: number): { count: number; resetAt: number } {
    const now = Date.now()
    let entry = this.store.get(key)

    // Create new entry or reset if window expired
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 1,
        resetAt: now + windowMs,
      }
    } else {
      entry.count++
    }

    this.store.set(key, entry)
    return { count: entry.count, resetAt: entry.resetAt }
  }

  /**
   * Get current count for a key without incrementing
   */
  getCount(key: string): number {
    const entry = this.store.get(key)
    if (!entry || entry.resetAt < Date.now()) {
      return 0
    }
    return entry.count
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key)
      }
    }
  }
}

export const rateLimitStore = new RateLimitStore()

/**
 * Optional: Use CloudFlare KV for distributed rate limiting
 * Requires KV namespace binding in wrangler.toml
 *
 * export async function getRateLimitCountFromKV(
 *   kv: KVNamespace,
 *   key: string,
 *   windowMs: number
 * ): Promise<{ count: number; resetAt: number }> {
 *   const data = await kv.get(key, 'json') as { count: number; resetAt: number } | null
 *
 *   if (!data || data.resetAt < Date.now()) {
 *     return { count: 1, resetAt: Date.now() + windowMs }
 *   }
 *
 *   return { count: data.count + 1, resetAt: data.resetAt }
 * }
 */
```

### Step 3: Create Rate Limiting Middleware Factory

Create a reusable middleware factory that applies rate limits.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/rate-limit.ts`

```typescript
import { createMiddleware } from 'hono/factory'
import type { HonoContext } from '../../../types/env'
import { rateLimitStore } from '../security/rate-limit-store'
import { getRateLimitConfig, type RateLimitConfig } from '../config/rate-limits'

/**
 * Extract identifier for rate limiting
 * Prioritize authenticated user ID, fall back to IP address
 */
function getIdentifier(c: HonoContext): string {
  const user = c.get('user')
  if (user) {
    return `user:${user.userId}`
  }

  // Fall back to IP for unauthenticated endpoints
  const ip = c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0] ||
    'unknown'

  return `ip:${ip}`
}

/**
 * Create a rate limiting middleware for a specific configuration
 * @param configOrType Rate limit config object or key to RATE_LIMITS
 * @returns Middleware function
 */
export function createRateLimitMiddleware(
  configOrType: RateLimitConfig | keyof typeof import('../config/rate-limits').RATE_LIMITS
) {
  return createMiddleware<HonoContext>(async (c, next) => {
    // Get config
    let config: RateLimitConfig
    if (typeof configOrType === 'string') {
      config = getRateLimitConfig(configOrType)
    } else {
      config = configOrType
    }

    const identifier = getIdentifier(c)
    const { count, resetAt } = rateLimitStore.increment(identifier, config.windowMs)

    // Add rate limit headers to response
    const resetInSeconds = Math.ceil((resetAt - Date.now()) / 1000)

    c.res.headers.set('X-RateLimit-Limit', String(config.maxRequests))
    c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - count)))
    c.res.headers.set('X-RateLimit-Reset', String(resetAt))

    // Check if limit exceeded
    if (count > config.maxRequests) {
      return c.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds.`,
          retryAfter: resetInSeconds,
        },
        429
      )
    }

    await next()
  })
}

/**
 * Convenience middleware creators for common endpoints
 */
export const generalRateLimit = createRateLimitMiddleware('API_GENERAL')
export const uploadRateLimit = createRateLimitMiddleware('UPLOAD')
export const authRateLimit = createRateLimitMiddleware('AUTH')
export const publicRateLimit = createRateLimitMiddleware('PUBLIC')
export const messageRateLimit = createRateLimitMiddleware('MESSAGE_SEND')
```

### Step 4: Update API Router to Apply Rate Limits

Apply rate limiting middleware to your API routes.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/index.ts`

```typescript
import { Hono } from 'hono'
import type { HonoContext } from '../../types/env'
import {
  generalRateLimit,
  uploadRateLimit,
  authRateLimit,
  publicRateLimit,
} from '../../lib/api/middleware/rate-limit'

const router = new Hono<HonoContext>()

// ============================================
// Authentication Endpoints (Strict Rate Limit)
// ============================================
router.post('/auth/login', authRateLimit, handleLogin)
router.post('/auth/logout', authRateLimit, handleLogout)

// ============================================
// User Endpoints (General Rate Limit)
// ============================================
router.get('/user/me', requireAuth, generalRateLimit, getUserMe)
router.patch('/user/me', requireAuth, generalRateLimit, updateUserMe)

// ============================================
// Upload Endpoints (Strict Upload Rate Limit)
// ============================================
router.post('/artworks', requireAuth, uploadRateLimit, createArtwork)
router.post('/artworks/:id/image', requireAuth, uploadRateLimit, uploadArtworkImage)

// ============================================
// Artwork Endpoints (General Rate Limit)
// ============================================
router.get('/artworks', generalRateLimit, listArtworks)
router.get('/artworks/:id', generalRateLimit, getArtwork)
router.patch('/artworks/:id', requireAuth, generalRateLimit, updateArtwork)

// ============================================
// Public Endpoints (High Rate Limit)
// ============================================
router.get('/public/users/:username', publicRateLimit, getPublicUser)
router.get('/browse/featured', publicRateLimit, browseFeatures)
router.get('/search', publicRateLimit, searchArtworks)

export default router
```

### Step 5: Add Rate Limit Cleanup Job

For long-running workers, periodically clean up expired entries.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/rate-limit-cleanup.ts`

```typescript
import { rateLimitStore } from './rate-limit-store'

/**
 * Schedule cleanup of expired rate limit entries
 * Call this periodically (e.g., every 5 minutes)
 */
export function scheduleRateLimitCleanup(intervalMs: number = 5 * 60 * 1000): void {
  setInterval(() => {
    rateLimitStore.cleanup()
  }, intervalMs)
}

/**
 * Manual cleanup (call in worker startup or periodically)
 */
export function cleanupRateLimits(): void {
  rateLimitStore.cleanup()
}
```

### Step 6: Initialize Cleanup in App Startup

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/foundation.ts` (or your app entry point)

```typescript
import { Hono } from 'hono'
import { cleanupRateLimits } from './security/rate-limit-cleanup'

export function createApiApp() {
  const app = new Hono()

  // Initialize cleanup
  cleanupRateLimits()

  // ... rest of app setup

  return app
}
```

---

## Files to Create/Modify

| Path | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/config/rate-limits.ts` | Create | Rate limit configuration constants |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/rate-limit-store.ts` | Create | In-memory store for tracking request counts |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/rate-limit.ts` | Create | Middleware factory for applying rate limits |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/rate-limit-cleanup.ts` | Create | Cleanup utility for expired entries |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/index.ts` | Modify | Add rate limit middleware to routes |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/foundation.ts` | Modify | Initialize cleanup on startup |

---

## Verification

### Test 1: General API Rate Limit (100 req/min)
```bash
# Make 101 requests rapidly within 1 minute
for i in {1..101}; do
  curl -X GET http://localhost:8787/api/artworks \
    -H "Authorization: Bearer {token}"
done

# Request 101+ should return 429
# Response headers should show:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 0
# X-RateLimit-Reset: [unix timestamp]
```

### Test 2: Upload Rate Limit (10 uploads/hour)
```bash
# Make 11 upload requests within 1 hour
for i in {1..11}; do
  curl -X POST http://localhost:8787/api/artworks \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test","description":"Test"}'
done

# Request 11 should return 429
# Response should include retryAfter info
```

### Test 3: IP-based Limiting for Public Endpoints
```bash
# Make 201 requests to public endpoint as unauthenticated user
for i in {1..201}; do
  curl -X GET http://localhost:8787/browse/featured
done

# Request 201+ should return 429
```

### Test 4: Rate Limit Headers Present
```bash
curl -X GET http://localhost:8787/api/artworks -v

# Response should include:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: [timestamp]
```

### Test 5: Different Limits for Different Endpoints
```bash
# Verify AUTH endpoint has stricter limit (5/min)
for i in {1..6}; do
  curl -X POST http://localhost:8787/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done

# 6th request should fail with 429

# Verify PUBLIC endpoint has higher limit (200/min)
# Should allow more requests than API_GENERAL (100/min)
```

### Test 6: Rate Limit Counter Resets
```bash
# Make 100 requests in minute 1
# Wait until minute 2 starts (or simulate by checking timestamps)
# Make 1 more request - should succeed

# Should show remaining count reset to 99
```

### Test 7: Cleanup Works (Long-term stability)
```bash
# Run the app for 1+ hour
# Monitor memory usage stays stable
# Check that old rate limit entries are removed

# Log cleanup calls and verify they execute periodically
```
