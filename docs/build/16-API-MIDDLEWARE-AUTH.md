# 16-API-MIDDLEWARE-AUTH.md

## Goal
Create authentication middleware for JWT validation that protects API endpoints and extracts user context from tokens.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Authentication**: JWT tokens issued after Google OAuth
- **Token Storage**: httpOnly cookies (secure, HttpOnly, SameSite=Strict)
- **User Context**: JWT payload contains userId, email, role
- **Protected Endpoints**: Require valid JWT token in Authorization header or cookie
- **Admin Endpoints**: Check user role === 'admin'
- **Optional Auth**: Some endpoints allow both authenticated and unauthenticated access

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app, error handling, and types setup

---

## Steps

### Step 1: Create Auth Middleware Module

Create the auth middleware file that will handle JWT verification and user context extraction.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/auth.ts`

```typescript
import { verify, decode } from 'hono/jwt'
import type { HonoContext } from '../../../types/env'
import { Errors } from '../errors'

/**
 * JWT Payload structure
 * Matches the payload created during user authentication
 */
export interface JWTPayload {
  userId: string
  email: string
  role: 'user' | 'admin'
  exp: number
  iat: number
}

/**
 * User context extracted from JWT
 * Added to c.get('user') for use in route handlers
 */
export interface AuthUser {
  userId: string
  email: string
  role: 'user' | 'admin'
}

/**
 * Extract JWT from request
 * Checks Authorization header first, then cookies
 */
function extractToken(c: HonoContext): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Check httpOnly cookie
  const cookieToken = c.req.cookie('auth_token')
  if (cookieToken) {
    return cookieToken
  }

  return null
}

/**
 * Verify JWT and extract payload
 * Returns null if token is invalid or expired
 */
async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const decoded = await verify(token, secret, 'HS256')

    // Validate required fields
    if (!decoded.userId || !decoded.email || !decoded.role) {
      return null
    }

    // Check expiration (verify already checks this, but explicit check for safety)
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return decoded as JWTPayload
  } catch (err) {
    console.error('[Auth] JWT verification failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Required Authentication Middleware
 * Throws 401 Unauthorized if token is missing or invalid
 * Sets c.get('user') with authenticated user context
 */
export async function requireAuth(c: HonoContext, next: () => Promise<void>) {
  const token = extractToken(c)

  if (!token) {
    throw Errors.unauthorized('No authentication token provided')
  }

  const secret = c.env.JWT_SECRET
  if (!secret) {
    throw Errors.internal('JWT_SECRET not configured')
  }

  const payload = await verifyToken(token, secret)

  if (!payload) {
    throw Errors.unauthorized('Invalid or expired token')
  }

  // Store user in context for use in route handlers
  const user: AuthUser = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  }

  c.set('user', user)

  await next()
}

/**
 * Optional Authentication Middleware
 * Does not throw if token is missing
 * Sets c.get('user') if valid token exists
 * Otherwise c.get('user') will be undefined
 */
export async function optionalAuth(c: HonoContext, next: () => Promise<void>) {
  const token = extractToken(c)

  if (token) {
    const secret = c.env.JWT_SECRET
    if (secret) {
      const payload = await verifyToken(token, secret)

      if (payload) {
        const user: AuthUser = {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
        }
        c.set('user', user)
      }
    }
  }

  await next()
}

/**
 * Admin-Only Middleware
 * Requires both authentication AND role === 'admin'
 * Throws 403 Forbidden if user is not admin
 * Must be used AFTER requireAuth middleware
 */
export async function requireAdmin(c: HonoContext, next: () => Promise<void>) {
  const user = c.get('user') as AuthUser | undefined

  if (!user) {
    throw Errors.unauthorized('Authentication required')
  }

  if (user.role !== 'admin') {
    throw Errors.forbidden('Admin access required')
  }

  await next()
}

/**
 * Helper function to get current user from context
 * Returns null if user is not authenticated
 * Use in route handlers: const user = getCurrentUser(c)
 */
export function getCurrentUser(c: HonoContext): AuthUser | null {
  const user = c.get('user') as AuthUser | undefined
  return user || null
}

/**
 * Helper function to require user and throw if not found
 * Returns the user or throws 401 Unauthorized
 * Use in route handlers: const user = requireCurrentUser(c)
 */
export function requireCurrentUser(c: HonoContext): AuthUser {
  const user = getCurrentUser(c)

  if (!user) {
    throw Errors.unauthorized('Authentication required')
  }

  return user
}
```

**Explanation:**
- `JWTPayload` interface defines the structure of the JWT token
- `extractToken()` checks both Authorization header and cookies
- `verifyToken()` validates the JWT signature and expiration
- `requireAuth` middleware throws 401 if no valid token exists
- `optionalAuth` middleware doesn't require a token but extracts it if present
- `requireAdmin` middleware verifies admin role after authentication
- Helper functions provide convenient access to user context in route handlers

---

### Step 2: Update Hono App to Register Auth Types

Update the main Hono app to support the user context in route handlers.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Replace the existing file with this updated version:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { HonoEnv, HonoContext } from '../../types/env'
import type { AuthUser } from './middleware/auth'
import { apiErrorHandler } from './errors'

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

// Health check endpoint (no auth required)
app.get('/health', (c: HonoContext) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Global error handler (must be last)
app.onError(apiErrorHandler)

export default app
```

**Explanation:**
- Global TypeScript declaration extends Hono's ContextData with user context
- This enables type-safe access to `c.set('user', ...)` and `c.get('user')`
- Imported `AuthUser` type for proper typing

---

### Step 3: Add Auth Middleware to Examples

Create example route implementations showing how to use the auth middleware.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/examples/auth-example.ts`

```typescript
/**
 * EXAMPLE: How to use auth middleware in route handlers
 * This file demonstrates the patterns. DO NOT deploy as-is.
 */

import type { HonoContext } from '../../../types/env'
import { requireAuth, optionalAuth, requireAdmin, getCurrentUser, requireCurrentUser } from '../middleware/auth'
import { Errors } from '../errors'

/**
 * Example 1: Protected endpoint requiring authentication
 * Returns 401 if no valid token
 */
export async function protectedEndpointExample(c: HonoContext) {
  // Middleware should be: app.get('/protected', requireAuth, handler)
  // User is guaranteed to exist here
  const user = requireCurrentUser(c)

  return c.json({
    data: {
      message: `Hello ${user.email}`,
      userId: user.userId,
      role: user.role,
    }
  })
}

/**
 * Example 2: Optional authentication endpoint
 * Works with or without token, but shows different content if authenticated
 */
export async function optionalAuthEndpointExample(c: HonoContext) {
  // Middleware should be: app.get('/browse', optionalAuth, handler)
  const user = getCurrentUser(c)

  if (user) {
    return c.json({
      data: {
        message: 'Here are your personalized recommendations',
        userId: user.userId,
      }
    })
  } else {
    return c.json({
      data: {
        message: 'Here are popular artworks',
      }
    })
  }
}

/**
 * Example 3: Admin-only endpoint
 * Returns 403 if user is not admin
 */
export async function adminEndpointExample(c: HonoContext) {
  // Middleware should be: app.get('/admin/stats', requireAuth, requireAdmin, handler)
  // User is guaranteed to be admin here
  const user = requireCurrentUser(c)

  if (user.role !== 'admin') {
    throw Errors.forbidden('Admin access required')
  }

  return c.json({
    data: {
      message: 'Admin statistics',
      adminId: user.userId,
    }
  })
}

/**
 * Example 4: How to register routes with auth middleware
 */
export function registerAuthExampleRoutes(app: any) {
  // Protected route
  app.get('/protected', requireAuth, protectedEndpointExample)

  // Optional auth route
  app.get('/browse', optionalAuth, optionalAuthEndpointExample)

  // Admin route - chain middlewares in order
  app.get('/admin/stats', requireAuth, requireAdmin, adminEndpointExample)
}
```

**Explanation:**
- Example 1 shows how to use protected endpoints
- Example 2 shows conditional behavior based on authentication
- Example 3 shows admin-only endpoints
- Example 4 shows the pattern for registering routes with middleware

---

### Step 4: Add Type Support for User Context

Update the environment types to include user context helpers.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts`

Add these lines at the end of the file (after existing code):

```typescript
/**
 * Extend Hono context data to include user context
 */
declare global {
  namespace Hono {
    interface ContextData {
      user?: {
        userId: string
        email: string
        role: 'user' | 'admin'
      }
    }
  }
}
```

**Explanation:**
- Extends Hono's context to support user context across all route handlers
- Enables IntelliSense for `c.get('user')` and `c.set('user', ...)`

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/auth.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/examples/auth-example.ts` (reference only)

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Add user context type declaration
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts` - Add Hono ContextData declaration

**Dependencies:**
- `hono/jwt` - Already included with Hono

---

## JWT Token Structure Reference

The JWT tokens created during authentication (Phase 4) will have this structure:

```typescript
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload (signed content)
{
  "userId": "usr_abc123",
  "email": "artist@example.com",
  "role": "user",
  "iat": 1674060000,
  "exp": 1674146400
}

// Verification
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  JWT_SECRET
)
```

---

## Verification

### Test 1: Verify Auth Middleware Compiles

Run TypeScript compiler:

```bash
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Create a Test Protected Endpoint

Add this temporary route to `src/lib/api/index.ts`:

```typescript
import { requireAuth } from './middleware/auth'

app.get('/test-protected', requireAuth, (c) => {
  const user = c.get('user')
  return c.json({ user })
})
```

Compile and preview:

```bash
npx wrangler pages dev
```

---

### Test 3: Test Without Authentication

Request without token:

```bash
curl http://localhost:8788/api/test-protected
```

Expected response (401):
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No authentication token provided"
  }
}
```

---

### Test 4: Test With Invalid Token

Request with invalid token:

```bash
curl -H "Authorization: Bearer invalid.token.here" http://localhost:8788/api/test-protected
```

Expected response (401):
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

---

### Test 5: Test With Valid Token

Create a valid JWT for testing. Use this Node.js script:

```javascript
// test-jwt.js
const crypto = require('crypto');

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function createJWT() {
  const secret = 'your-jwt-secret-from-env';
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    userId: 'usr_test123',
    email: 'test@example.com',
    role: 'user',
    iat: now,
    exp: exp
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerEncoded}.${payloadEncoded}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${data}.${signature}`;
}

console.log(createJWT());
```

Run it:

```bash
node test-jwt.js
```

Then test with the token:

```bash
curl -H "Authorization: Bearer <token-from-above>" http://localhost:8788/api/test-protected
```

Expected response (200):
```json
{
  "user": {
    "userId": "usr_test123",
    "email": "test@example.com",
    "role": "user"
  }
}
```

---

### Test 6: Test Optional Auth

Add this test endpoint:

```typescript
import { optionalAuth } from './middleware/auth'

app.get('/test-optional', optionalAuth, (c) => {
  const user = c.get('user')
  return c.json({
    authenticated: !!user,
    user: user || null
  })
})
```

Without token:

```bash
curl http://localhost:8788/api/test-optional
```

Expected response (200):
```json
{
  "authenticated": false,
  "user": null
}
```

With valid token:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8788/api/test-optional
```

Expected response (200):
```json
{
  "authenticated": true,
  "user": {
    "userId": "usr_test123",
    "email": "test@example.com",
    "role": "user"
  }
}
```

---

### Test 7: Test Admin Middleware

Add this test endpoint:

```typescript
import { requireAuth, requireAdmin } from './middleware/auth'

app.get('/test-admin', requireAuth, requireAdmin, (c) => {
  return c.json({ message: 'Admin endpoint' })
})
```

With user token (role: 'user'):

```bash
curl -H "Authorization: Bearer <user-token>" http://localhost:8788/api/test-admin
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

---

## Summary

This build adds JWT authentication middleware:
- Required authentication middleware that protects endpoints
- Optional authentication middleware for conditional auth
- Admin-only middleware for privileged endpoints
- User context extraction from JWT tokens
- Helper functions for accessing authenticated user
- Full TypeScript type support

All endpoints can now use the middleware patterns to protect or conditionally protect their routes.

---

**Next step:** Proceed to **17-API-MIDDLEWARE-COMMON.md** to add CORS, rate limiting, and request logging middleware.
