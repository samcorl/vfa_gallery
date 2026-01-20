# Build 149: Security - Activity Logging

## Goal
Implement comprehensive activity logging for all important user actions. Create an audit trail that tracks user behavior, IP addresses, and user agents for security monitoring and compliance.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Activity Logging**: Log important activities for audit trail
- **Security Considerations**: Support abuse detection and investigation
- **Admin Tools**: Admin dashboard needs access to activity logs

From SCHEMA-SUPPORTING.md:
- **activity_log Table**: id, user_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at

---

## Prerequisites

**Must complete before starting:**
- **Build 13**: Supporting tables including `activity_log` table
- **Build 15**: API Foundation (Hono app setup)
- **Build 16**: API Middleware Auth (user context available)

---

## Steps

### Step 1: Create Activity Logger Utility Module

Create a utility module to handle all activity logging.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/activity-logger.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types'
import type { HonoContext } from '../../../types/env'
import { generateId } from '../utils/id'

/**
 * Supported activity actions
 */
export enum ActivityAction {
  // Auth actions
  USER_SIGNUP = 'user_signup',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  EMAIL_VERIFIED = 'email_verified',

  // User actions
  USER_UPDATED = 'user_updated',
  USER_AVATAR_UPLOADED = 'user_avatar_uploaded',
  USER_PROFILE_VIEWED = 'user_profile_viewed',

  // Artwork actions
  ARTWORK_CREATED = 'artwork_created',
  ARTWORK_UPDATED = 'artwork_updated',
  ARTWORK_DELETED = 'artwork_deleted',
  ARTWORK_PUBLISHED = 'artwork_published',
  ARTWORK_VIEWED = 'artwork_viewed',

  // Gallery actions
  GALLERY_CREATED = 'gallery_created',
  GALLERY_UPDATED = 'gallery_updated',
  GALLERY_DELETED = 'gallery_deleted',
  GALLERY_PUBLISHED = 'gallery_published',

  // Collection actions
  COLLECTION_CREATED = 'collection_created',
  COLLECTION_UPDATED = 'collection_updated',
  COLLECTION_DELETED = 'collection_deleted',
  COLLECTION_ARTWORK_ADDED = 'collection_artwork_added',
  COLLECTION_ARTWORK_REMOVED = 'collection_artwork_removed',

  // Messaging actions
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',

  // Admin actions
  ADMIN_USER_FLAGGED = 'admin_user_flagged',
  ADMIN_CONTENT_FLAGGED = 'admin_content_flagged',
  ADMIN_ACTION = 'admin_action',
}

/**
 * Supported entity types
 */
export enum EntityType {
  USER = 'user',
  ARTWORK = 'artwork',
  GALLERY = 'gallery',
  COLLECTION = 'collection',
  MESSAGE = 'message',
  THEME = 'theme',
}

/**
 * Activity log entry to be stored
 */
export interface ActivityLogEntry {
  id: string
  userId: string | null
  action: ActivityAction
  entityType: EntityType | null
  entityId: string | null
  metadata: Record<string, any> | null
  ipAddress: string
  userAgent: string
  createdAt: string
}

/**
 * Extract client information from request
 */
function getClientInfo(c: HonoContext): { ipAddress: string; userAgent: string } {
  const ipAddress =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'

  const userAgent = c.req.header('user-agent') || 'unknown'

  return { ipAddress, userAgent }
}

/**
 * Log an activity to the database
 */
export async function logActivity(
  db: D1Database,
  c: HonoContext,
  options: {
    action: ActivityAction
    userId?: string | null
    entityType?: EntityType | null
    entityId?: string | null
    metadata?: Record<string, any> | null
  }
): Promise<void> {
  try {
    const { ipAddress, userAgent } = getClientInfo(c)

    // Use authenticated user ID if not specified
    const userId = options.userId !== undefined ? options.userId : c.get('user')?.userId || null

    await db
      .prepare(
        `
        INSERT INTO activity_log (
          id, user_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        generateId(),
        userId,
        options.action,
        options.entityType || null,
        options.entityId || null,
        options.metadata ? JSON.stringify(options.metadata) : null,
        ipAddress,
        userAgent,
        new Date().toISOString()
      )
      .run()
  } catch (error) {
    // Log to console but don't throw - activity logging should not break the app
    console.error('Failed to log activity:', error)
  }
}

/**
 * Log activity with user context
 * Convenience function for authenticated endpoints
 */
export async function logUserActivity(
  db: D1Database,
  c: HonoContext,
  action: ActivityAction,
  entityType?: EntityType,
  entityId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logActivity(db, c, {
    action,
    entityType,
    entityId,
    metadata,
  })
}

/**
 * Query activity logs with filters
 */
export async function getActivityLogs(
  db: D1Database,
  options?: {
    userId?: string
    action?: ActivityAction
    entityType?: EntityType
    entityId?: string
    ipAddress?: string
    fromDate?: Date
    toDate?: Date
    limit?: number
    offset?: number
  }
): Promise<ActivityLogEntry[]> {
  let query = 'SELECT * FROM activity_log WHERE 1=1'
  const params: any[] = []

  if (options?.userId) {
    query += ' AND user_id = ?'
    params.push(options.userId)
  }

  if (options?.action) {
    query += ' AND action = ?'
    params.push(options.action)
  }

  if (options?.entityType) {
    query += ' AND entity_type = ?'
    params.push(options.entityType)
  }

  if (options?.entityId) {
    query += ' AND entity_id = ?'
    params.push(options.entityId)
  }

  if (options?.ipAddress) {
    query += ' AND ip_address = ?'
    params.push(options.ipAddress)
  }

  if (options?.fromDate) {
    query += ' AND created_at >= ?'
    params.push(options.fromDate.toISOString())
  }

  if (options?.toDate) {
    query += ' AND created_at <= ?'
    params.push(options.toDate.toISOString())
  }

  query += ' ORDER BY created_at DESC'

  if (options?.limit) {
    query += ' LIMIT ?'
    params.push(options.limit)
  }

  if (options?.offset) {
    query += ' OFFSET ?'
    params.push(options.offset)
  }

  const stmt = db.prepare(query)
  const result = await stmt.bind(...params).all<ActivityLogEntry>()

  return result.results || []
}

/**
 * Get activity summary for a user (last 30 days)
 */
export async function getUserActivitySummary(
  db: D1Database,
  userId: string
): Promise<Record<ActivityAction, number>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const result = await db
    .prepare(
      `
      SELECT action, COUNT(*) as count
      FROM activity_log
      WHERE user_id = ? AND created_at >= ?
      GROUP BY action
      `
    )
    .bind(userId, thirtyDaysAgo.toISOString())
    .all<{ action: ActivityAction; count: number }>()

  const summary: Record<string, number> = {}
  for (const row of result.results || []) {
    summary[row.action] = row.count
  }

  return summary as Record<ActivityAction, number>
}

/**
 * Get recent IPs used by a user
 */
export async function getUserRecentIPs(
  db: D1Database,
  userId: string,
  limit: number = 10
): Promise<Array<{ ipAddress: string; lastUsed: string; count: number }>> {
  const result = await db
    .prepare(
      `
      SELECT ip_address, MAX(created_at) as lastUsed, COUNT(*) as count
      FROM activity_log
      WHERE user_id = ?
      GROUP BY ip_address
      ORDER BY lastUsed DESC
      LIMIT ?
      `
    )
    .bind(userId, limit)
    .all<{ ipAddress: string; lastUsed: string; count: number }>()

  return result.results || []
}
```

### Step 2: Create Activity Logging Middleware

Create middleware to automatically log common actions.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/activity-logging.ts`

```typescript
import { createMiddleware } from 'hono/factory'
import type { HonoContext } from '../../../types/env'
import { logActivity, ActivityAction, EntityType } from '../security/activity-logger'

/**
 * Track page views and profile views
 * Add to routes you want to track
 */
export const trackViewsMiddleware = createMiddleware<HonoContext>(async (c, next) => {
  const user = c.get('user')
  const pathname = c.req.path

  // Track profile views
  if (pathname.match(/^\/api\/public\/users\/[^/]+$/)) {
    const username = pathname.split('/').pop()
    // Note: This fires even before we know if user exists
    // That's OK - filtering happens in the query
  }

  await next()
})

/**
 * Convenience middleware creators for specific actions
 * These wrap common logging scenarios
 */

/**
 * Log user login (attach to login endpoint)
 */
export async function logLoginActivity(c: HonoContext, userId: string): Promise<void> {
  const db = c.env.DB as D1Database
  await logActivity(db, c, {
    action: ActivityAction.USER_LOGIN,
    userId,
  })
}

/**
 * Log user logout (attach to logout endpoint)
 */
export async function logLogoutActivity(c: HonoContext): Promise<void> {
  const db = c.env.DB as D1Database
  const user = c.get('user')
  if (user) {
    await logActivity(db, c, {
      action: ActivityAction.USER_LOGOUT,
      userId: user.userId,
    })
  }
}

/**
 * Log signup (attach to registration endpoint)
 */
export async function logSignupActivity(
  c: HonoContext,
  userId: string,
  email: string
): Promise<void> {
  const db = c.env.DB as D1Database
  await logActivity(db, c, {
    action: ActivityAction.USER_SIGNUP,
    userId,
    entityType: EntityType.USER,
    entityId: userId,
    metadata: { email },
  })
}

/**
 * Log email verification
 */
export async function logEmailVerificationActivity(c: HonoContext, userId: string): Promise<void> {
  const db = c.env.DB as D1Database
  await logActivity(db, c, {
    action: ActivityAction.EMAIL_VERIFIED,
    userId,
    entityType: EntityType.USER,
    entityId: userId,
  })
}
```

### Step 3: Integrate Logging into API Endpoints

Update key endpoints to log activities. Here are examples:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/auth.ts`

```typescript
import { logSignupActivity, logLoginActivity, logLogoutActivity } from '../../lib/api/middleware/activity-logging'

// In signup handler:
export async function handleSignup(c: HonoContext) {
  // ... create user ...

  const userId = user.id
  const email = user.email

  // Log the signup activity
  await logSignupActivity(c, userId, email)

  // ... rest of response ...
}

// In login handler:
export async function handleLogin(c: HonoContext) {
  // ... verify credentials ...

  const userId = user.id

  // Log the login activity
  await logLoginActivity(c, userId)

  // ... rest of response ...
}

// In logout handler:
export async function handleLogout(c: HonoContext) {
  // Log the logout activity
  await logLogoutActivity(c)

  // ... rest of response ...
}
```

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks.ts`

```typescript
import { logUserActivity, ActivityAction, EntityType } from '../../lib/api/security/activity-logger'

// In artwork create handler:
export async function createArtwork(c: HonoContext) {
  const db = c.env.DB as D1Database
  const user = c.get('user')

  // ... create artwork ...

  const artworkId = artwork.id

  // Log the creation
  await logUserActivity(
    db,
    c,
    ActivityAction.ARTWORK_CREATED,
    EntityType.ARTWORK,
    artworkId,
    {
      title: artwork.title,
      galleryId: artwork.gallery_id,
    }
  )

  // ... rest of response ...
}

// In artwork update handler:
export async function updateArtwork(c: HonoContext) {
  const db = c.env.DB as D1Database
  const artworkId = c.req.param('id')

  // ... update artwork ...

  await logUserActivity(
    db,
    c,
    ActivityAction.ARTWORK_UPDATED,
    EntityType.ARTWORK,
    artworkId,
    { fieldsUpdated: Object.keys(updates) }
  )

  // ... rest of response ...
}

// In artwork delete handler:
export async function deleteArtwork(c: HonoContext) {
  const db = c.env.DB as D1Database
  const artworkId = c.req.param('id')

  // ... delete artwork ...

  await logUserActivity(
    db,
    c,
    ActivityAction.ARTWORK_DELETED,
    EntityType.ARTWORK,
    artworkId
  )

  // ... rest of response ...
}
```

### Step 4: Create Admin Activity Log Query Endpoint

Create an API endpoint for admins to view activity logs.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/admin/activity-logs.ts`

```typescript
import { Hono } from 'hono'
import type { HonoContext } from '../../../types/env'
import { requireAuth, requireAdmin } from '../../../lib/api/middleware/auth'
import {
  getActivityLogs,
  getUserActivitySummary,
  getUserRecentIPs,
  ActivityAction,
} from '../../../lib/api/security/activity-logger'

const router = new Hono<HonoContext>()

/**
 * GET /admin/activity-logs
 * Query activity logs with filters
 * Admin only
 */
router.get('/', requireAuth, requireAdmin, async (c) => {
  const db = c.env.DB as D1Database

  const userId = c.req.query('userId')
  const action = c.req.query('action') as ActivityAction
  const ipAddress = c.req.query('ipAddress')
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000)
  const offset = parseInt(c.req.query('offset') || '0')

  const logs = await getActivityLogs(db, {
    userId: userId || undefined,
    action: action || undefined,
    ipAddress: ipAddress || undefined,
    limit,
    offset,
  })

  return c.json({
    data: logs,
    pagination: { limit, offset, total: logs.length },
  })
})

/**
 * GET /admin/activity-logs/:userId/summary
 * Get activity summary for a user
 * Admin only
 */
router.get('/:userId/summary', requireAuth, requireAdmin, async (c) => {
  const db = c.env.DB as D1Database
  const userId = c.req.param('userId')

  const summary = await getUserActivitySummary(db, userId)
  const recentIps = await getUserRecentIPs(db, userId)

  return c.json({
    userId,
    summary,
    recentIps,
  })
})

/**
 * GET /admin/activity-logs/:userId/ips
 * Get recent IPs used by a user
 * Admin only
 */
router.get('/:userId/ips', requireAuth, requireAdmin, async (c) => {
  const db = c.env.DB as D1Database
  const userId = c.req.param('userId')
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50)

  const ips = await getUserRecentIPs(db, userId, limit)

  return c.json({
    userId,
    data: ips,
  })
})

export default router
```

---

## Files to Create/Modify

| Path | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/activity-logger.ts` | Create | Core activity logging utility and queries |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/activity-logging.ts` | Create | Convenience middleware and helpers for logging |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/auth.ts` | Modify | Add logging to login, logout, signup handlers |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks.ts` | Modify | Add logging to create, update, delete handlers |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/galleries.ts` | Modify | Add logging to gallery operations |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/admin/activity-logs.ts` | Create | Admin endpoint to query activity logs |

---

## Verification

### Test 1: Log a signup activity
```bash
# Sign up a new user
curl -X POST http://localhost:8787/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password"}'

# Query activity logs
wrangler d1 execute vfa-gallery --command="SELECT * FROM activity_log WHERE action = 'user_signup' ORDER BY created_at DESC LIMIT 1;"

# Should see entry with:
# - user_id: [user id]
# - action: user_signup
# - entity_type: user
# - metadata includes email
# - ip_address: populated
# - user_agent: populated
```

### Test 2: Log artwork creation
```bash
# Create an artwork
curl -X POST http://localhost:8787/api/artworks \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test artwork"}'

# Query logs
wrangler d1 execute vfa-gallery --command="SELECT * FROM activity_log WHERE action = 'artwork_created' ORDER BY created_at DESC LIMIT 1;"

# Should see entry with:
# - action: artwork_created
# - entity_type: artwork
# - entity_id: [artwork id]
# - metadata contains title and galleryId
```

### Test 3: Admin query endpoint
```bash
# Query activity logs as admin
curl -X GET 'http://localhost:8787/api/admin/activity-logs?limit=10' \
  -H "Authorization: Bearer {admin_token}"

# Should return array of activity log entries
```

### Test 4: Get user activity summary
```bash
# Get summary for a specific user
curl -X GET 'http://localhost:8787/api/admin/activity-logs/{userId}/summary' \
  -H "Authorization: Bearer {admin_token}"

# Should return:
# {
#   "userId": "...",
#   "summary": {
#     "user_login": 5,
#     "artwork_created": 3,
#     "artwork_updated": 2,
#     ...
#   },
#   "recentIps": [...]
# }
```

### Test 5: Get user's recent IPs
```bash
# Get recent IPs
curl -X GET 'http://localhost:8787/api/admin/activity-logs/{userId}/ips' \
  -H "Authorization: Bearer {admin_token}"

# Should return list of IPs with last used timestamp and count
```

### Test 6: Filter logs by IP address
```bash
# Query logs for a specific IP
curl -X GET 'http://localhost:8787/api/admin/activity-logs?ipAddress=192.168.1.1' \
  -H "Authorization: Bearer {admin_token}"

# Should return only logs from that IP
```
