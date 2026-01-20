# Build 147: Security - New Account Upload Limits

## Goal
Implement upload rate limiting for newly created accounts. Restrict new users to 10 uploads per day for their first 7 days to prevent spam and abuse from freshly created accounts.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **New Account Limits**: 10 uploads/day for first 7 days
- **Rate Limiting**: Auto-flag for suspicious activity (rapid uploads, duplicate images)
- **Users Table**: Fields include `created_at` to track account age

---

## Prerequisites

**Must complete before starting:**
- **Build 06**: Users table schema with `created_at` field
- **Build 13**: Supporting tables including `activity_log`
- **Build 41**: API Artwork Create (the upload endpoint we'll protect)
- **Build 148**: Rate Limiting middleware (for generic 429 responses)

---

## Steps

### Step 1: Create New Account Limit Utility Module

Create a utility module to check if an account is new and how many uploads they've made today.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/new-account-limits.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types'
import type { AuthUser } from '../middleware/auth'

/**
 * Check if an account is within the "new account" period (first 7 days)
 * @param createdAt ISO timestamp of account creation
 * @returns true if account is less than 7 days old
 */
export function isNewAccount(createdAt: string): boolean {
  const accountCreatedTime = new Date(createdAt).getTime()
  const now = Date.now()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  return (now - accountCreatedTime) < sevenDaysMs
}

/**
 * Get the number of uploads made by a user today
 * @param db D1 database instance
 * @param userId User ID to check
 * @returns Number of uploads made today
 */
export async function getTodayUploadCount(
  db: D1Database,
  userId: string
): Promise<number> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const result = await db
    .prepare(
      `
      SELECT COUNT(*) as count FROM activity_log
      WHERE user_id = ?
        AND action = 'artwork_created'
        AND created_at >= ?
      `
    )
    .bind(userId, todayIso)
    .first<{ count: number }>()

  return result?.count ?? 0
}

/**
 * Check if user has exceeded the new account upload limit
 * Returns an error object if limit is exceeded, null if allowed
 */
export async function checkNewAccountUploadLimit(
  db: D1Database,
  user: AuthUser,
  userCreatedAt: string
): Promise<{ limited: boolean; reason?: string; retryAfter?: number }> {
  // Check if account is old enough to skip limit
  if (!isNewAccount(userCreatedAt)) {
    return { limited: false }
  }

  // Get uploads made today
  const todayCount = await getTodayUploadCount(db, user.userId)

  // New account limit is 10 uploads per day
  const NEW_ACCOUNT_UPLOAD_LIMIT = 10

  if (todayCount >= NEW_ACCOUNT_UPLOAD_LIMIT) {
    // Calculate seconds until midnight UTC
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setUTCHours(24, 0, 0, 0)
    const secondsUntilReset = Math.ceil((tomorrow.getTime() - now.getTime()) / 1000)

    return {
      limited: true,
      reason: `New account upload limit reached (${todayCount}/${NEW_ACCOUNT_UPLOAD_LIMIT}). Limit resets at midnight UTC.`,
      retryAfter: secondsUntilReset,
    }
  }

  return { limited: false }
}

/**
 * Get remaining uploads for a new account today
 * Returns the count even for accounts older than 7 days
 */
export async function getRemainingUploads(
  db: D1Database,
  user: AuthUser,
  userCreatedAt: string
): Promise<number> {
  if (!isNewAccount(userCreatedAt)) {
    // Account is old enough, no limit
    return Infinity
  }

  const todayCount = await getTodayUploadCount(db, user.userId)
  const NEW_ACCOUNT_UPLOAD_LIMIT = 10

  return Math.max(0, NEW_ACCOUNT_UPLOAD_LIMIT - todayCount)
}
```

### Step 2: Create New Account Limit Middleware

Create middleware to enforce the new account upload limit on the artwork create endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/new-account-limits.ts`

```typescript
import { createMiddleware } from 'hono/factory'
import type { HonoContext } from '../../../types/env'
import { checkNewAccountUploadLimit } from '../security/new-account-limits'
import { Errors } from '../errors'

/**
 * Middleware to enforce new account upload limits
 * Should be applied only to upload/creation endpoints
 *
 * Usage in route:
 * router.post(
 *   '/artworks',
 *   requireAuth,
 *   newAccountLimitMiddleware,
 *   createArtworkHandler
 * )
 */
export const newAccountLimitMiddleware = createMiddleware<HonoContext>(
  async (c, next) => {
    const user = c.get('user')

    if (!user) {
      // Should not happen if placed after auth middleware
      throw Errors.unauthorized('Authentication required')
    }

    const db = c.env.DB as D1Database

    // Get user from database to check creation date
    const userRecord = await db
      .prepare('SELECT id, created_at FROM users WHERE id = ?')
      .bind(user.userId)
      .first<{ id: string; created_at: string }>()

    if (!userRecord) {
      throw Errors.notFound('User not found')
    }

    // Check if upload is allowed
    const limitCheck = await checkNewAccountUploadLimit(
      db,
      user,
      userRecord.created_at
    )

    if (limitCheck.limited) {
      const response = new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: limitCheck.reason,
          retryAfter: limitCheck.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(limitCheck.retryAfter || 3600),
          },
        }
      )
      return c.json(
        {
          error: 'Rate limit exceeded',
          message: limitCheck.reason,
        },
        429
      )
    }

    await next()
  }
)
```

### Step 3: Update Artwork Create Endpoint

Modify the artwork create endpoint to include the new account limit middleware.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks.ts`

Find the artwork create route and update it:

```typescript
import { newAccountLimitMiddleware } from '../../lib/api/middleware/new-account-limits'

// In your router setup, update the POST /artworks route:
router.post(
  '/artworks',
  requireAuth,
  newAccountLimitMiddleware,  // Add this middleware
  createArtworkHandler
)
```

### Step 4: Log Upload Activity

Ensure the artwork create handler logs the `artwork_created` action to the activity_log table. In your artwork create implementation:

**Location:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks.ts` (createArtworkHandler)

Add activity logging after successful artwork creation:

```typescript
// After successfully creating the artwork
await db.prepare(
  `
  INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
).bind(
  generateId(),  // Generate unique ID
  user.userId,
  'artwork_created',  // Action name that new-account-limits checks for
  'artwork',
  artworkId,
  c.req.raw.headers.get('cf-connecting-ip') || 'unknown',
  c.req.raw.headers.get('user-agent') || 'unknown',
  new Date().toISOString()
).run()
```

### Step 5: Add Helper Function to Get User Data in Responses (Optional)

If you want to include remaining upload count in API responses, add this to your artwork list/info endpoints:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/new-account-limits.ts` (append to file)

```typescript
/**
 * Attach upload limit info to a user response object
 * Useful for frontend to show upload count info
 */
export async function attachUploadLimitInfo(
  db: D1Database,
  user: AuthUser,
  userCreatedAt: string,
  response: any
): Promise<any> {
  const remaining = await getRemainingUploads(db, user, userCreatedAt)
  const isNew = isNewAccount(userCreatedAt)

  if (isNew && remaining !== Infinity) {
    response.uploadLimit = {
      daily: 10,
      remaining: remaining,
      resetTime: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
    }
  }

  return response
}
```

---

## Files to Create/Modify

| Path | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/new-account-limits.ts` | Create | Utility functions for checking account age and upload counts |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/new-account-limits.ts` | Create | Middleware to enforce limits on routes |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks.ts` | Modify | Add middleware to POST /artworks route and log activities |

---

## Verification

### Test 1: Verify new account is limited
```bash
# 1. Create a test user (sign up)
# 2. Immediately try to upload 11 artworks
# 3. First 10 should succeed
# 4. 11th should fail with 429 status

curl -X POST http://localhost:8787/api/artworks \
  -H "Authorization: Bearer {new_user_token}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test upload"}'

# Expected after 10 uploads:
# {
#   "error": "Rate limit exceeded",
#   "message": "New account upload limit reached (10/10). Limit resets at midnight UTC.",
#   "status": 429
# }
```

### Test 2: Verify old account is not limited
```bash
# 1. Use an account older than 7 days
# 2. Upload multiple artworks
# 3. All uploads should succeed without limit errors

# Should not fail on upload 11, 20, 50, etc.
```

### Test 3: Verify activity logging
```bash
# Query the activity log
wrangler d1 execute vfa-gallery --command="SELECT * FROM activity_log WHERE action = 'artwork_created' ORDER BY created_at DESC LIMIT 5;"

# Should show recent artwork_created entries with proper user_id, entity_id, ip_address, user_agent
```

### Test 4: Verify limit resets at midnight UTC
```bash
# 1. Create test user, upload 10 artworks
# 2. Check response shows remaining: 0
# 3. Wait for UTC midnight (or artificially set system time)
# 4. Upload should succeed again

# During the day, check getRemainingUploads output:
# Should show correct countdown: 10, 9, 8, 7... 1, 0
```

### Test 5: Verify Retry-After header
```bash
# Upload 11 times as new user
# 11th request should include Retry-After header

curl -X POST http://localhost:8787/api/artworks \
  -H "Authorization: Bearer {new_user_token}" \
  -v

# Response headers should include:
# Retry-After: [seconds until midnight UTC]
```
