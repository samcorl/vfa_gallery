# 15-API-FOUNDATION.md

## Goal
Set up Hono router, error handling, and shared types for the API layer using CloudFlare Pages Functions.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **API Layer**: CloudFlare Pages Functions with file-based routing in `functions/` directory
- **Framework**: Hono (lightweight, CloudFlare-native routing)
- **Language**: TypeScript (strict mode)
- **Database**: D1 binding available as `env.DB`
- **Storage**: R2 bucket binding available as `env.BUCKET`
- **Error Handling**: Standardized error response format with error codes
- **CORS**: Support for cross-origin requests

---

## Prerequisites

**Must complete before starting:**
- **04-D1-DATABASE-INIT.md** - D1 database binding configured in wrangler.toml
- **05-R2-BUCKET-INIT.md** - R2 bucket binding configured in wrangler.toml

---

## Steps

### Step 1: Install Hono Framework

Install hono as a production dependency:

```bash
npm install hono
```

Verify installation:

```bash
npm list hono
```

Expected output: `hono@latest` (or current version)

---

### Step 2: Create CloudFlare Pages Function Catch-All Handler

Create the main API entry point that routes all API requests through Hono.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/functions/api/[[route]].ts`

```typescript
import { handle } from 'hono/cloudflare-pages'
import { app } from '../../src/lib/api'

export const onRequest = handle(app)
```

**Explanation:**
- `[[route]]` is CloudFlare's catch-all pattern that matches `/api/*`
- `handle` wraps the Hono app for CloudFlare Pages Functions
- All requests to `/api/...` will be routed through the Hono app defined in `src/lib/api`

---

### Step 3: Create Hono App Setup and Initialization

Create the main Hono application with CORS configuration.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { HonoEnv } from '../../types/env'
import { apiErrorHandler } from './errors'

// Initialize Hono app with strict typing
export const app = new Hono<HonoEnv>()

// CORS middleware - allow credentials and specific origins
const allowedOrigins = [
  'http://localhost:5173',      // Vite dev server
  'http://localhost:8788',      // Wrangler preview
  'https://vfa.gallery',        // Production domain
  'https://www.vfa.gallery',    // Production with www
]

app.use(
  cors({
    origin: (origin) => {
      if (allowedOrigins.includes(origin)) return origin
      return 'https://vfa.gallery'
    },
    credentials: true,
    maxAge: 600,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Type'],
  })
)

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Global error handler (must be last)
app.onError(apiErrorHandler)

export default app
```

**Explanation:**
- `Hono<HonoEnv>` provides strict type checking for CloudFlare bindings (D1, R2)
- CORS allows localhost for development and production domains
- `credentials: true` enables cookies for authentication
- Health check endpoint at `/api/health` for monitoring
- Global error handler catches unhandled exceptions

---

### Step 4: Create Error Handling Middleware and ApiError Class

Create standardized error handling for consistent API responses.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/errors.ts`

```typescript
import type { Context } from 'hono'
import type { HonoEnv } from '../../types/env'

/**
 * ApiError class for consistent error responses
 * All API errors should inherit from this class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public message: string = 'An unexpected error occurred',
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'ApiError'
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    }
  }
}

/**
 * Global error handler middleware
 * Catches all errors and returns standardized error responses
 */
export async function apiErrorHandler(
  err: Error,
  c: Context<HonoEnv>
) {
  // Log error to console (can be replaced with logging service)
  console.error('[API Error]', err.name, err.message)

  // Check if error is an ApiError instance
  if (err instanceof ApiError) {
    return c.json(err.toJSON(), err.statusCode)
  }

  // Handle Hono validation errors
  if (err.message.includes('validation')) {
    const validationError = new ApiError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      { originalMessage: err.message }
    )
    return c.json(validationError.toJSON(), 400)
  }

  // Default to 500 Internal Server Error
  const internalError = new ApiError(
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred',
    { originalError: err.message }
  )
  return c.json(internalError.toJSON(), 500)
}

/**
 * Common error constructors for consistent HTTP status codes
 */

export const Errors = {
  // 400 Bad Request
  badRequest: (message: string, details?: Record<string, any>) =>
    new ApiError(400, 'BAD_REQUEST', message, details),

  // 401 Unauthorized
  unauthorized: (message: string = 'Authentication required') =>
    new ApiError(401, 'UNAUTHORIZED', message),

  // 403 Forbidden
  forbidden: (message: string = 'Access denied') =>
    new ApiError(403, 'FORBIDDEN', message),

  // 404 Not Found
  notFound: (resource: string = 'Resource') =>
    new ApiError(404, 'NOT_FOUND', `${resource} not found`),

  // 409 Conflict (duplicate, etc)
  conflict: (message: string, details?: Record<string, any>) =>
    new ApiError(409, 'CONFLICT', message, details),

  // 429 Too Many Requests
  rateLimited: (retryAfter?: number) =>
    new ApiError(
      429,
      'RATE_LIMITED',
      'Too many requests. Please try again later.',
      retryAfter ? { retryAfter } : undefined
    ),

  // 500 Internal Server Error
  internal: (message: string, details?: Record<string, any>) =>
    new ApiError(500, 'INTERNAL_ERROR', message, details),
}
```

**Explanation:**
- `ApiError` class provides consistent error structure with code, message, and optional details
- `toJSON()` formats errors for API responses
- `apiErrorHandler` catches all errors and normalizes them
- `Errors` object provides convenience methods for common HTTP status codes
- All errors follow the standardized format: `{ error: { code, message, details } }`

---

### Step 5: Create Shared API Response Types

Create TypeScript types for API responses used across all endpoints.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/api.ts`

```typescript
/**
 * Standard API Response wrapper
 * All successful responses wrap data in this structure
 */
export interface ApiResponse<T> {
  data: T
  meta?: {
    timestamp?: string
    version?: string
  }
}

/**
 * Paginated API Response
 * Used for list endpoints that support pagination
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  meta?: {
    timestamp?: string
    version?: string
  }
}

/**
 * Error Response Structure
 * Returned for all error conditions
 */
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
}

/**
 * Generic HTTP Status Response
 * Used for status and health check endpoints
 */
export interface StatusResponse {
  status: 'ok' | 'error'
  timestamp: string
  [key: string]: any
}

/**
 * Standard pagination query parameters
 * Supports page-based pagination
 */
export interface PaginationParams {
  page?: number
  pageSize?: number
}

/**
 * Query parameter parsing helper
 */
export function parsePaginationParams(params: Record<string, string>): PaginationParams {
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)))
  return { page, pageSize }
}

/**
 * Create paginated response helper
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pageSize)
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }
}
```

**Explanation:**
- `ApiResponse<T>` wraps successful responses with metadata
- `PaginatedResponse<T>` adds pagination info for list endpoints
- `ErrorResponse` matches the error format from `ApiError`
- Helper functions for parsing pagination and creating responses
- Consistent structure across all endpoints

---

### Step 6: Create CloudFlare Environment Types

Create TypeScript types for CloudFlare bindings and environment variables.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts`

```typescript
import type { Context } from 'hono'

/**
 * CloudFlare D1 Database binding
 * Provides SQL query execution
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = any>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1ExecResult>
}

/**
 * Prepared statement for D1
 */
export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement
  first<T = any>(): Promise<T | null>
  all<T = any>(): Promise<D1Result<T>>
  run(): Promise<D1Result>
}

/**
 * D1 query result
 */
export interface D1Result<T = any> {
  success: boolean
  results?: T[]
}

/**
 * D1 execution result
 */
export interface D1ExecResult {
  success: boolean
  count?: number
  duration?: number
}

/**
 * CloudFlare R2 bucket binding
 * Provides object storage operations
 */
export interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<R2Object>
  get(key: string): Promise<R2Object | null>
  delete(key: string | string[]): Promise<void>
  list(options?: R2ListOptions): Promise<R2Objects>
  head(key: string): Promise<R2Object>
}

/**
 * R2 put options
 */
export interface R2PutOptions {
  httpMetadata?: R2HttpMetadata
  customMetadata?: Record<string, string>
}

/**
 * R2 HTTP metadata
 */
export interface R2HttpMetadata {
  contentType?: string
  cacheControl?: string
  contentDisposition?: string
  contentEncoding?: string
  expires?: string
}

/**
 * R2 object metadata
 */
export interface R2Object {
  key: string
  version?: string
  size: number
  etag: string
  httpEtag?: string
  checksums: R2Checksums
  uploaded: Date
  httpMetadata?: R2HttpMetadata
  customMetadata?: Record<string, string>
  range?: { offset: number; length: number }
  body?: ReadableStream<Uint8Array>
  bodyUsed?: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  blob(): Promise<Blob>
}

/**
 * R2 checksums
 */
export interface R2Checksums {
  md5?: string
  sha1?: string
  sha256?: string
}

/**
 * R2 list options
 */
export interface R2ListOptions {
  limit?: number
  prefix?: string
  cursor?: string
  delimiter?: string
}

/**
 * R2 objects list result
 */
export interface R2Objects {
  objects: R2Object[]
  delimitedPrefixes?: string[]
  isTruncated: boolean
  cursor?: string
}

/**
 * CloudFlare Environment Variables
 * All bindings and secrets available in worker context
 */
export interface CloudFlareEnv {
  DB: D1Database
  BUCKET: R2Bucket
  JWT_SECRET: string
  ENVIRONMENT: 'development' | 'production'
  DOMAIN: string
}

/**
 * Hono Context type with CloudFlare environment
 * Use this type for all API route handlers
 */
export type HonoEnv = {
  Bindings: CloudFlareEnv
}

/**
 * Hono Context helper type
 * Simplifies typing in route handlers
 */
export type HonoContext = Context<HonoEnv>
```

**Explanation:**
- `D1Database` types match CloudFlare D1 API for type safety
- `R2Bucket` types match CloudFlare R2 API for type safety
- `CloudFlareEnv` defines all bindings and secrets available to workers
- `HonoEnv` combines Hono types with CloudFlare bindings
- `HonoContext` is a convenient alias for use in route handlers
- All types enable full IntelliSense and compile-time type checking

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/functions/api/[[route]].ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/errors.ts`
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/api.ts`
5. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts`

**Modified files:**
- `package.json` - Add `hono` dependency (via `npm install`)

---

## Verification

### Test 1: Verify Hono Installation

```bash
npm list hono
```

Expected: `hono@latest` listed without errors

---

### Test 2: Verify API Health Check Endpoint

Deploy the project (or run preview):

```bash
npx wrangler pages dev
```

In another terminal, make a request to the health check endpoint:

```bash
curl http://localhost:8788/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-18T12:00:00.000Z"
}
```

---

### Test 3: Verify TypeScript Compilation

Run the TypeScript compiler to ensure no type errors:

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 4: Verify Error Handling

Make a request to a non-existent endpoint:

```bash
curl http://localhost:8788/api/nonexistent
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Not Found"
  }
}
```

---

### Test 5: Verify CORS Headers

```bash
curl -i -H "Origin: http://localhost:5173" http://localhost:8788/api/health
```

Expected headers in response:
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
```

---

### Test 6: Verify Environment Type Safety

Update `src/lib/api/index.ts` and confirm IntelliSense shows available bindings:

```typescript
app.get('/debug', (c) => {
  // IntelliSense should show: c.env.DB, c.env.BUCKET, c.env.JWT_SECRET
  return c.json({ env: Object.keys(c.env) })
})
```

Type check with:
```bash
npx tsc --noEmit
```

Expected: No type errors, IntelliSense works for `c.env.*`

---

## Summary

This build creates the foundation for the API layer:
- Hono router with CloudFlare Pages Functions integration
- Standardized error handling with ApiError class
- Consistent API response types
- TypeScript types for CloudFlare bindings
- CORS middleware for client requests
- Health check endpoint for monitoring

All subsequent API endpoints (auth, users, galleries, etc.) will build on this foundation.

---

**Next step:** Proceed to **16-API-MIDDLEWARE-AUTH.md** to add JWT authentication middleware.
