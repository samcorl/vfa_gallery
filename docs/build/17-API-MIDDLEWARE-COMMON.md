# 17-API-MIDDLEWARE-COMMON.md

## Goal
Create common middleware for CORS configuration, rate limiting placeholder, and request logging to enhance API monitoring and security.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **CORS**: Allow credentials, specific origins for dev/prod
- **Rate Limiting**: Global rate limiting with per-user limits (Phase 27 implements actual limiting)
- **Logging**: Request logging for debugging and monitoring
- **Middleware Order**: CORS → Logging → Optional Auth → Route Handler → Error Handler

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono router and error handling
- **16-API-MIDDLEWARE-AUTH.md** - Auth middleware for optional auth

---

## Steps

### Step 1: Create CORS Middleware Configuration

Create a dedicated CORS configuration middleware for reusability and easier updates.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/cors.ts`

```typescript
import { cors } from 'hono/cors'
import type { HonoContext } from '../../../types/env'

/**
 * CORS configuration for VFA.gallery API
 * Allows requests from localhost (dev) and production domains
 */

const DEV_ORIGINS = [
  'http://localhost:5173',      // Vite dev server (default port)
  'http://localhost:3000',      // Alternative dev port
  'http://localhost:8788',      // Wrangler preview
  'http://127.0.0.1:5173',      // Localhost IP variant
  'http://127.0.0.1:3000',      // Localhost IP variant
]

const PROD_ORIGINS = [
  'https://vfa.gallery',        // Production domain
  'https://www.vfa.gallery',    // Production with www
]

const ALLOWED_ORIGINS = [
  ...DEV_ORIGINS,
  ...PROD_ORIGINS,
]

/**
 * CORS middleware configuration
 * Returns middleware function for use in app.use()
 */
export function corsMiddleware() {
  return cors({
    origin: (origin) => {
      // If origin is in allowlist, allow it
      if (origin && ALLOWED_ORIGINS.includes(origin)) {
        return origin
      }

      // Default to production domain for unknown origins
      return 'https://vfa.gallery'
    },

    // Allow cookies and authorization headers
    credentials: true,

    // Cache preflight responses for 10 minutes
    maxAge: 600,

    // HTTP methods allowed
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Headers allowed in requests
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Accept-Language',
    ],

    // Headers exposed to client JavaScript
    exposeHeaders: [
      'Content-Type',
      'Content-Length',
      'X-Total-Count',      // For pagination
      'X-Page-Count',       // For pagination
      'Retry-After',        // For rate limiting
    ],
  })
}

/**
 * Helper to check if origin is trusted
 * Use in routes that need custom origin validation
 */
export function isTrustedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin)
}

/**
 * Get environment-appropriate origin list
 */
export function getOriginsList(environment: 'development' | 'production'): string[] {
  return environment === 'development' ? DEV_ORIGINS : PROD_ORIGINS
}
```

**Explanation:**
- Separate CORS configuration from main app for clarity
- `corsMiddleware()` returns Hono's CORS middleware with our config
- Allows both localhost and production domains
- Credentials enabled for cookie-based authentication
- Helper functions for origin validation
- Exposes pagination and rate limiting headers to client

---

### Step 2: Create Request Logging Middleware

Create middleware to log all incoming requests for debugging and monitoring.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/logger.ts`

```typescript
import type { HonoContext } from '../../../types/env'

/**
 * Request logging levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Log entry structure for structured logging
 */
export interface LogEntry {
  level: LogLevel
  timestamp: string
  method: string
  path: string
  status?: number
  duration: number
  userId?: string
  error?: string
  ip?: string
}

/**
 * Color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
}

/**
 * Format status code with color based on range
 */
function formatStatus(status: number): string {
  if (status >= 200 && status < 300) {
    return `${colors.green}${status}${colors.reset}`
  }
  if (status >= 300 && status < 400) {
    return `${colors.blue}${status}${colors.reset}`
  }
  if (status >= 400 && status < 500) {
    return `${colors.yellow}${status}${colors.reset}`
  }
  if (status >= 500) {
    return `${colors.red}${status}${colors.reset}`
  }
  return String(status)
}

/**
 * Format method with color based on type
 */
function formatMethod(method: string): string {
  const colors: Record<string, string> = {
    GET: '\x1b[32m',      // green
    POST: '\x1b[34m',     // blue
    PATCH: '\x1b[33m',    // yellow
    PUT: '\x1b[33m',      // yellow
    DELETE: '\x1b[31m',   // red
    HEAD: '\x1b[36m',     // cyan
    OPTIONS: '\x1b[37m',  // white
  }

  const color = colors[method] || colors.GET
  return `${color}${method}${colors.reset}`
}

/**
 * Request logging middleware
 * Logs all requests with method, path, status, and duration
 * Can be used globally or on specific routes
 */
export async function loggerMiddleware(c: HonoContext, next: () => Promise<void>) {
  // Record start time
  const startTime = performance.now()
  const startDate = new Date().toISOString()

  // Get request info
  const method = c.req.method
  const path = c.req.path
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'

  try {
    // Call next middleware/handler
    await next()

    // Calculate duration
    const duration = Math.round(performance.now() - startTime)
    const status = c.res.status

    // Get user ID if authenticated
    const user = c.get('user') as { userId: string } | undefined
    const userId = user?.userId

    // Create log entry
    const logEntry: LogEntry = {
      level: status >= 400 ? 'warn' : 'info',
      timestamp: startDate,
      method,
      path,
      status,
      duration,
      userId,
      ip,
    }

    // Log to console
    logRequest(logEntry)

    // Could also send to external logging service here
    // await sendToLoggingService(logEntry)
  } catch (err) {
    // Calculate duration
    const duration = Math.round(performance.now() - startTime)

    // Get user ID if authenticated
    const user = c.get('user') as { userId: string } | undefined
    const userId = user?.userId

    // Create error log entry
    const logEntry: LogEntry = {
      level: 'error',
      timestamp: startDate,
      method,
      path,
      duration,
      userId,
      ip,
      error: err instanceof Error ? err.message : String(err),
    }

    // Log error
    logRequest(logEntry)

    // Re-throw so error handler can process
    throw err
  }
}

/**
 * Format and output log entry to console
 */
function logRequest(entry: LogEntry): void {
  const { level, timestamp, method, path, status, duration, userId, ip, error } = entry

  // Format: [METHOD] /path - STATUS - 45ms [userId:user123] [IP:192.0.2.1]
  let logLine = `[${formatMethod(method)}] ${path}`

  if (status !== undefined) {
    logLine += ` - ${formatStatus(status)}`
  }

  logLine += ` - ${duration}ms`

  if (userId) {
    logLine += ` ${colors.dim}[${userId}]${colors.reset}`
  }

  if (ip && ip !== 'unknown') {
    logLine += ` ${colors.dim}[${ip}]${colors.reset}`
  }

  if (error) {
    logLine += ` ${colors.red}ERROR: ${error}${colors.reset}`
  }

  // Log based on level
  switch (level) {
    case 'error':
      console.error(logLine)
      break
    case 'warn':
      console.warn(logLine)
      break
    case 'debug':
      console.debug(logLine)
      break
    case 'info':
    default:
      console.log(logLine)
      break
  }
}

/**
 * Helper to manually log custom events
 * Use in route handlers or middleware
 */
export function logEvent(c: HonoContext, message: string, level: LogLevel = 'info'): void {
  const user = c.get('user') as { userId: string } | undefined
  const userId = user?.userId

  const logLine = `${colors.dim}[EVENT]${colors.reset} ${message}${userId ? ` ${colors.dim}[${userId}]${colors.reset}` : ''}`

  switch (level) {
    case 'error':
      console.error(logLine)
      break
    case 'warn':
      console.warn(logLine)
      break
    case 'debug':
      console.debug(logLine)
      break
    case 'info':
    default:
      console.log(logLine)
      break
  }
}
```

**Explanation:**
- `loggerMiddleware` wraps all requests and logs timing information
- Captures request method, path, status, and duration
- Colors terminal output for easy scanning
- Logs user ID and IP address when available
- Handles both successful and error responses
- `logEvent()` helper for custom logging in route handlers

---

### Step 3: Create Rate Limiting Middleware Placeholder

Create a placeholder rate limiting middleware for future implementation. Phase 27 will add actual limiting.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/rateLimit.ts`

```typescript
import type { HonoContext } from '../../../types/env'
import { Errors } from '../errors'

/**
 * Rate Limiting Middleware
 *
 * PHASE 3 PLACEHOLDER:
 * This middleware is a placeholder for Phase 27 (SECURITY-RATE-LIMITING.md)
 * Currently, it only tracks and logs requests
 * Actual limiting will be implemented in Phase 27
 */

export interface RateLimitConfig {
  // Global limits
  globalRequests: number      // requests per window
  globalWindow: number        // window in seconds

  // Per-user limits
  userRequests: number        // requests per window
  userWindow: number          // window in seconds

  // Per-IP limits
  ipRequests: number          // requests per window
  ipWindow: number            // window in seconds

  // Endpoint-specific limits
  endpoints?: Record<
    string,
    {
      requests: number
      window: number
    }
  >
}

/**
 * Default rate limit configuration
 * These are conservative limits; can be adjusted in deployment
 */
export const DEFAULT_CONFIG: RateLimitConfig = {
  globalRequests: 10000,
  globalWindow: 60,          // 10k requests per minute globally

  userRequests: 1000,
  userWindow: 60,            // 1k requests per minute per user

  ipRequests: 500,
  ipWindow: 60,              // 500 requests per minute per IP

  endpoints: {
    '/api/auth/google/callback': {
      requests: 10,
      window: 3600,           // 10 per hour
    },
    '/api/messages': {
      requests: 50,
      window: 3600,           // 50 per hour
    },
    '/api/artworks': {
      requests: 100,
      window: 3600,           // 100 per hour
    },
  },
}

/**
 * In-memory store for tracking requests
 * PHASE 3: Using in-memory store as placeholder
 * PHASE 27: Will migrate to Redis or D1 for distributed rate limiting
 */
const requestLog: Map<
  string,
  {
    count: number
    resetTime: number
  }
> = new Map()

/**
 * Get rate limit key for a request
 * Prioritizes user ID, falls back to IP address
 */
function getRateLimitKey(c: HonoContext, keyPrefix: string): string {
  const user = c.get('user') as { userId: string } | undefined
  if (user) {
    return `${keyPrefix}:user:${user.userId}`
  }

  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  return `${keyPrefix}:ip:${ip}`
}

/**
 * Check if request exceeds rate limit
 * PHASE 3: Only logs, doesn't enforce
 * Returns true if limit would be exceeded
 */
function isRateLimited(key: string, limit: number, window: number): boolean {
  const now = Date.now()
  const entry = requestLog.get(key)

  if (!entry) {
    // First request in window
    requestLog.set(key, {
      count: 1,
      resetTime: now + window * 1000,
    })
    return false
  }

  if (now > entry.resetTime) {
    // Window expired, reset counter
    requestLog.set(key, {
      count: 1,
      resetTime: now + window * 1000,
    })
    return false
  }

  // Still in window
  entry.count++

  if (entry.count > limit) {
    console.warn(`[Rate Limit] Exceeded for key: ${key} (${entry.count}/${limit})`)
    return true
  }

  return false
}

/**
 * Rate limiting middleware
 *
 * PHASE 3 BEHAVIOR:
 * - Logs all requests
 * - Warns when limits would be exceeded
 * - Does NOT block requests
 *
 * PHASE 27 BEHAVIOR:
 * - Will enforce limits
 * - Will return 429 Too Many Requests
 * - Will use Redis for distributed rate limiting
 */
export async function rateLimitMiddleware(
  config: RateLimitConfig = DEFAULT_CONFIG
) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const path = c.req.path
    const method = c.req.method

    // Skip rate limiting for health checks and static assets
    if (path === '/health' || path.startsWith('/.well-known')) {
      await next()
      return
    }

    // Get user/IP key
    const userKey = getRateLimitKey(c, 'ratelimit')

    // Check user rate limit
    if (isRateLimited(userKey, config.userRequests, config.userWindow)) {
      // PHASE 3: Only warn in console
      console.warn(`[Rate Limit] User would be blocked: ${userKey}`)
      // PHASE 27: Will throw here
      // throw Errors.rateLimited(config.userWindow)
    }

    // Check endpoint-specific limit if configured
    const endpointConfig = config.endpoints?.[path]
    if (endpointConfig) {
      const endpointKey = `${userKey}:${path}`
      if (isRateLimited(endpointKey, endpointConfig.requests, endpointConfig.window)) {
        console.warn(`[Rate Limit] Endpoint would be blocked: ${endpointKey}`)
        // PHASE 27: Will throw here
        // throw Errors.rateLimited(endpointConfig.window)
      }
    }

    await next()
  }
}

/**
 * Helper to configure rate limiting for specific endpoint
 * Use this in route definitions for custom limits
 */
export function createEndpointRateLimiter(requests: number, window: number) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const path = c.req.path
    const user = c.get('user') as { userId: string } | undefined
    const ip = c.req.header('CF-Connecting-IP') || 'unknown'
    const key = user ? `ratelimit:ep:${path}:user:${user.userId}` : `ratelimit:ep:${path}:ip:${ip}`

    if (isRateLimited(key, requests, window)) {
      // PHASE 3: Log
      console.warn(`[Rate Limit] Custom endpoint blocked: ${key}`)
      // PHASE 27: Will throw
      // throw Errors.rateLimited(window)
    }

    await next()
  }
}

/**
 * Clear rate limit data for testing
 * Use in test routes only
 */
export function clearRateLimitData(): void {
  requestLog.clear()
  console.log('[Rate Limit] Data cleared')
}

/**
 * Get rate limit status for debugging
 */
export function getRateLimitStatus(key: string) {
  const entry = requestLog.get(key)

  if (!entry) {
    return {
      key,
      status: 'no_data',
    }
  }

  const now = Date.now()
  const timeUntilReset = Math.max(0, entry.resetTime - now)

  return {
    key,
    count: entry.count,
    resetTime: new Date(entry.resetTime).toISOString(),
    timeUntilResetMs: timeUntilReset,
  }
}
```

**Explanation:**
- `rateLimitMiddleware` is a placeholder for Phase 27
- Currently logs requests but does not enforce limits
- Uses in-memory storage (will be replaced with Redis in Phase 27)
- Tracks requests per user/IP
- Supports endpoint-specific limits
- Helper functions for testing and debugging
- Comments clearly mark Phase 27 implementation points

---

### Step 4: Update Main Hono App to Use All Middleware

Update the main API app to register all the new middleware in the correct order.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Replace the existing file with this updated version:

```typescript
import { Hono } from 'hono'
import type { HonoEnv, HonoContext } from '../../types/env'
import type { AuthUser } from './middleware/auth'
import { apiErrorHandler } from './errors'
import { corsMiddleware } from './middleware/cors'
import { loggerMiddleware } from './middleware/logger'
import { rateLimitMiddleware } from './middleware/rateLimit'

// Extend Hono env to include user context
declare global {
  namespace Hono {
    interface ContextData {
      user?: AuthUser
    }
  }
}

// Initialize Hono app with strict typing
export const app = new Hono<HonoEnv>()

// Middleware order is important:
// 1. CORS - must be first to set headers
// 2. Logger - logs all requests
// 3. Rate Limiter - tracks request counts (doesn't block in Phase 3)
// 4. Auth middleware applied per-route (in specific handlers)
// 5. Route handlers
// 6. Error handler (registered at end)

// CORS middleware
app.use(corsMiddleware())

// Logger middleware
app.use(loggerMiddleware)

// Rate limiting middleware (placeholder in Phase 3)
app.use(await rateLimitMiddleware())

// Health check endpoint (no auth required)
app.get('/health', (c: HonoContext) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

// Global error handler (must be last)
app.onError(apiErrorHandler)

export default app
```

**Explanation:**
- Middleware applied in order: CORS → Logger → Rate Limit
- Auth middleware applied per-route for flexibility
- Health endpoint available without authentication
- Error handler catches all errors after route processing

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/cors.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/logger.ts`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/rateLimit.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register all middleware

**Directory structure after:**
```
src/lib/api/
├── index.ts                    (main app with middleware)
├── errors.ts                   (from Phase 15)
├── middleware/
│   ├── auth.ts                 (from Phase 16)
│   ├── cors.ts                 (new)
│   ├── logger.ts               (new)
│   └── rateLimit.ts            (new)
└── examples/
    └── auth-example.ts         (from Phase 16)
```

---

## Middleware Execution Order and Flow

```
Request arrives
    ↓
CORS middleware
    ↓ (sets CORS headers)
Logger middleware
    ↓ (logs start time, method, path)
Rate Limit middleware
    ↓ (checks/increments counters, logs warnings)
Route-specific auth middleware (if needed)
    ↓ (verifies JWT, sets user context)
Route handler
    ↓
Response created
    ↓
Logger records status and duration
    ↓
Error handler (if exception thrown)
    ↓
Response sent with CORS headers
```

---

## Verification

### Test 1: Verify Middleware Compiles

```bash
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Verify CORS Headers

Start the dev server:

```bash
npx wrangler pages dev
```

Test CORS preflight:

```bash
curl -i -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  http://localhost:8788/api/health
```

Expected headers in response:
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Accept-Language
Access-Control-Expose-Headers: Content-Type, Content-Length, X-Total-Count, X-Page-Count, Retry-After
```

---

### Test 3: Verify Request Logging

Make a request:

```bash
curl http://localhost:8788/api/health
```

Expected console output (with colors):
```
[GET] /api/health - 200 - 2ms
```

---

### Test 4: Verify Logger With Authenticated Request

Create a test route with auth middleware in `src/lib/api/index.ts`:

```typescript
import { requireAuth } from './middleware/auth'

app.get('/test-auth', requireAuth, (c) => {
  return c.json({ message: 'authenticated' })
})
```

Request with valid token:

```bash
curl -H "Authorization: Bearer <valid-token>" http://localhost:8788/api/test-auth
```

Expected console output includes user ID:
```
[GET] /api/test-auth - 200 - 3ms [usr_test123]
```

---

### Test 5: Verify Rate Limit Logging

Make multiple rapid requests:

```bash
for i in {1..100}; do
  curl -s http://localhost:8788/api/health > /dev/null
done
```

Check console output for rate limit warnings (they should appear after many requests but NOT block them in Phase 3):

```
[Rate Limit] User would be blocked: ratelimit:ip:127.0.0.1
```

---

### Test 6: Verify Middleware Chain Order

Add temporary debug route to verify middleware execution order:

```typescript
app.get('/test-middleware-order', optionalAuth, (c) => {
  const user = c.get('user')
  return c.json({
    message: 'Middleware executed in correct order',
    authenticated: !!user,
  })
})
```

Make request:

```bash
curl http://localhost:8788/api/test-middleware-order
```

Expected:
1. CORS headers in response
2. Log line in console from logger middleware
3. Request completes normally

---

### Test 7: Verify Exposed Headers for Pagination

Make a request that returns paginated data (use test route):

```typescript
app.get('/test-pagination', (c) => {
  return c.json({
    data: [{ id: 1 }, { id: 2 }],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 100,
    }
  }, {
    headers: {
      'X-Total-Count': '100',
      'X-Page-Count': '5',
    }
  })
})
```

```bash
curl -i http://localhost:8788/api/test-pagination
```

Expected response headers:
```
Access-Control-Expose-Headers: Content-Type, Content-Length, X-Total-Count, X-Page-Count, Retry-After
X-Total-Count: 100
X-Page-Count: 5
```

---

## Summary

This build adds three essential middleware components:

1. **CORS Middleware**
   - Allows localhost and production domains
   - Enables credentials for authentication
   - Configurable in one place

2. **Request Logger Middleware**
   - Logs all requests with color-coded output
   - Records method, path, status, and duration
   - Includes user ID and IP when available
   - Helps with debugging and monitoring

3. **Rate Limiting Middleware (Phase 3 Placeholder)**
   - Tracks requests in memory
   - Logs warnings when limits would be exceeded
   - Does NOT block requests in Phase 3
   - Will be fully implemented in Phase 27

All middleware is applied in the correct order and fully integrated with the Hono app.

---

**Completion Note:** Phase 3 API Foundation is now complete with:
- ✅ 15-API-FOUNDATION.md - Hono router, error handling, shared types
- ✅ 16-API-MIDDLEWARE-AUTH.md - JWT authentication middleware
- ✅ 17-API-MIDDLEWARE-COMMON.md - CORS, logging, and rate limiting placeholder

The API foundation is ready for Phase 4: Authentication endpoints.

---

**Next step:** Proceed to **18-AUTH-GOOGLE-SSO-REDIRECT.md** to implement the first authentication endpoint.
