# 133-API-ADMIN-MIDDLEWARE.md

## Goal

Create admin role verification middleware to protect admin-only API endpoints. Verify that the authenticated user has `role: 'admin'` in the users table, and return 403 Forbidden if not authorized.

---

## Spec Extract

From TECHNICAL-SPEC.md - Admin Tools:

- **Admin Endpoints:** All require `role: admin` user status
- **Authorization:** Check `users.role` field (not gallery roles)
- **Error Response (403):**
  ```json
  {
    "error": {
      "code": "FORBIDDEN",
      "message": "Admin access required"
    }
  }
  ```
- **HTTP Status Codes:**
  - `403` - Forbidden (user not admin)
  - `401` - Unauthorized (not authenticated)

**User Roles:**
- `'user'` - Regular user (default)
- `'admin'` - Platform administrator with access to admin endpoints

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **06-SCHEMA-USERS.md** - Users table with role field
- **15-API-FOUNDATION.md** - API error handling

---

## Steps

### Step 1: Create Admin Middleware

Create a middleware to verify admin role.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/admin.ts`

```typescript
import { Context, Next } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { ApiError, Errors } from '../errors'

/**
 * Admin middleware
 * Verifies that authenticated user has admin role
 * Must be applied AFTER authentication middleware
 */
export async function requireAdmin(c: Context<HonoEnv>, next: Next) {
  const userId = c.get('userId') as string | undefined
  const db = c.env.DB

  // This should not happen if auth middleware is applied first,
  // but check just to be safe
  if (!userId) {
    throw Errors.unauthorized('Authentication required')
  }

  // Fetch user and check role
  const user = await db
    .prepare('SELECT id, role, status FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; role: string; status: string }>()

  if (!user) {
    throw Errors.unauthorized('User not found')
  }

  // Check if user is admin
  if (user.role !== 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'Admin access required')
  }

  // Check if user is active/not suspended
  if (user.status !== 'active') {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Your account is not active. Contact support.'
    )
  }

  // Set admin flag on context for downstream handlers
  c.set('isAdmin', true)

  // Continue to next middleware/handler
  await next()
}

/**
 * Optional: Admin role check without middleware
 * For cases where you need to check admin in the handler logic
 */
export async function verifyAdminRole(
  db: any,
  userId: string
): Promise<boolean> {
  const user = await db
    .prepare('SELECT role FROM users WHERE id = ?')
    .bind(userId)
    .first<{ role: string }>()

  return user?.role === 'admin'
}
```

**Explanation:**
- Checks that user has `role === 'admin'`
- Also verifies user status is 'active' (not suspended)
- Returns 403 if user is not admin
- Returns 403 if user is suspended
- Sets `isAdmin` context flag for downstream handlers
- Provides helper function for non-middleware checks

---

### Step 2: Create Admin Routes File

Create a new router for admin endpoints.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts`

```typescript
import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { requireAuth } from '../middleware/auth'
import { requireAdmin } from '../middleware/admin'

export const adminRouter = new Hono<HonoEnv>()

/**
 * Apply auth and admin middleware to all admin routes
 */
adminRouter.use('*', requireAuth)
adminRouter.use('*', requireAdmin)

/**
 * GET /admin
 * Placeholder - will be replaced by specific admin endpoints
 */
adminRouter.get('/', async (c) => {
  const userId = c.get('userId') as string

  return c.json({
    message: 'Admin API',
    userId,
    isAdmin: c.get('isAdmin'),
  })
})

export default adminRouter
```

**Explanation:**
- New router for all admin endpoints
- Applies both auth and admin middleware to all routes
- All endpoints under this router are admin-protected
- Returns 403 if non-admin users try to access

---

### Step 3: Register Admin Routes in Main API

Add the admin router to the main Hono app.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add this import at the top:

```typescript
import { adminRouter } from './routes/admin'
```

Add this route mounting in the app setup section (typically after other route mounts):

```typescript
// Mount admin routes (protected by requireAdmin middleware)
app.route('/admin', adminRouter)
```

Example context:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { HonoEnv } from '../../types/env'
import { apiErrorHandler } from './errors'
import { galleriesRouter } from './routes/galleries'
import { adminRouter } from './routes/admin'  // Add this

// Initialize Hono app with strict typing
export const app = new Hono<HonoEnv>()

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}))

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Mount public routes
app.route('/galleries', galleriesRouter)

// Mount admin routes
app.route('/admin', adminRouter)  // Add this line

// Global error handler (must be last)
app.onError(apiErrorHandler)

export default app
```

---

### Step 4: Update Environment Types (if needed)

Ensure the environment type includes the admin flag.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts`

Add to the HonoEnv interface:

```typescript
export interface HonoEnv {
  Bindings: {
    DB: D1Database
    R2_BUCKET: R2Bucket
    JWT_SECRET: string
    ENVIRONMENT: 'development' | 'production'
  }
  Variables: {
    userId?: string
    isAdmin?: boolean  // Add this line
  }
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/admin.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Import and mount adminRouter
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/env.ts` - Add isAdmin variable to HonoEnv (if not already present)

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Start Dev Server

```bash
npx wrangler pages dev
```

Expected: Server starts without errors

---

### Test 3: Admin Endpoint Without Authentication

```bash
curl http://localhost:8788/api/admin
```

Expected response (401):
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

### Test 4: Admin Endpoint as Regular User

1. Log in as a regular user (non-admin)
2. Get their JWT token
3. Call admin endpoint:

```bash
curl -H "Authorization: Bearer {User_Token}" \
  http://localhost:8788/api/admin
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

### Test 5: Admin Endpoint as Admin User

1. Create or promote a user to admin role in database:

```bash
wrangler d1 execute site \
  --command="UPDATE users SET role = 'admin' WHERE id = 'user_id_here';"
```

2. Get their JWT token and call admin endpoint:

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin
```

Expected response (200):
```json
{
  "message": "Admin API",
  "userId": "user_abc123",
  "isAdmin": true
}
```

---

### Test 6: Suspended Admin User

1. Promote user to admin
2. Suspend the user in database:

```bash
wrangler d1 execute site \
  --command="UPDATE users SET status = 'suspended' WHERE id = 'user_id_here';"
```

3. Try to call admin endpoint:

```bash
curl -H "Authorization: Bearer {Suspended_Admin_Token}" \
  http://localhost:8788/api/admin
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Your account is not active. Contact support."
  }
}
```

---

### Test 7: Invalid Token

```bash
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:8788/api/admin
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

### Test 8: Missing Authorization Header

```bash
curl http://localhost:8788/api/admin
```

Expected response (401):
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

### Test 9: Admin User Deactivated

1. Admin user is active initially
2. Set status to 'deactivated':

```bash
wrangler d1 execute site \
  --command="UPDATE users SET status = 'deactivated' WHERE id = 'user_id_here';"
```

3. Try to call admin endpoint:

Expected response (403): Account not active

---

### Test 10: Context Flag Set

Verify middleware sets isAdmin flag by checking in handler:

The middleware correctly sets the flag, which can be verified by observing successful calls work when isAdmin=true

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] Admin middleware created
- [ ] Admin router created and mounted
- [ ] Non-authenticated requests return 401
- [ ] Regular users get 403 when accessing admin routes
- [ ] Admin users successfully access admin routes
- [ ] Suspended users cannot access admin routes
- [ ] isAdmin flag is set in context for admin users
- [ ] Role verification happens on every request
- [ ] Returns appropriate error messages in all cases

---

## Next Steps

Once this build is verified, proceed to **134-API-ADMIN-STATS.md** to create the admin stats endpoint.
