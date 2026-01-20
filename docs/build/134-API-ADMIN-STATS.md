# 134-API-ADMIN-STATS.md

## Goal

Create the `GET /api/admin/stats` endpoint to return platform-wide statistics. Only admins can access. Returns counts of users, galleries, artworks, messages broken down by status, plus recent activity summary.

---

## Spec Extract

From TECHNICAL-SPEC.md - Admin Tools:

- **Endpoint:** `GET /api/admin/stats`
- **Authentication:** Required (JWT token)
- **Authorization:** Admin role required
- **Response (200 OK):**
  ```json
  {
    "data": {
      "users": {
        "total": 245,
        "active": 200,
        "pending": 30,
        "suspended": 10,
        "deactivated": 5
      },
      "galleries": {
        "total": 850,
        "active": 800,
        "archived": 40,
        "hidden": 10
      },
      "artworks": {
        "total": 12500,
        "active": 12000,
        "hidden": 300,
        "flagged": 150,
        "deleted": 50
      },
      "messages": {
        "total": 5420,
        "sent": 5000,
        "pending_review": 300,
        "approved": 100,
        "rejected": 20
      },
      "recentActivity": [
        {
          "action": "upload",
          "entityType": "artwork",
          "userId": "user_123",
          "username": "artist-name",
          "createdAt": "2026-01-19T15:30:00Z"
        },
        {
          "action": "create_gallery",
          "entityType": "gallery",
          "userId": "user_456",
          "username": "another-artist",
          "createdAt": "2026-01-19T15:25:00Z"
        }
      ],
      "generatedAt": "2026-01-19T15:35:00Z"
    }
  }
  ```
- **HTTP Status Codes:**
  - `200` - Success
  - `401` - Unauthorized
  - `403` - Forbidden (not admin)

---

## Prerequisites

**Must complete before starting:**
- **133-API-ADMIN-MIDDLEWARE.md** - Admin role verification middleware
- **06-SCHEMA-USERS.md** - Users table with status field
- **08-SCHEMA-GALLERIES.md** - Galleries table with status field
- **10-SCHEMA-ARTWORKS.md** - Artworks table with status field
- **12-SCHEMA-MESSAGES.md** - Messages table with status field
- **13-SCHEMA-SUPPORTING.md** - Activity log table

---

## Steps

### Step 1: Create Admin Stats Types

Define types for the admin stats response.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/adminStats.ts`

```typescript
/**
 * Admin stats response types
 */

export interface CountsByStatus {
  [key: string]: number
}

export interface UserStats {
  total: number
  active: number
  pending: number
  suspended: number
  deactivated: number
}

export interface GalleryStats {
  total: number
  active: number
  archived: number
  hidden: number
}

export interface ArtworkStats {
  total: number
  active: number
  hidden: number
  flagged: number
  deleted: number
}

export interface MessageStats {
  total: number
  sent: number
  pending_review: number
  approved: number
  rejected: number
}

export interface RecentActivity {
  action: string
  entityType: string | null
  userId: string | null
  username: string | null
  createdAt: string
}

export interface AdminStatsData {
  users: UserStats
  galleries: GalleryStats
  artworks: ArtworkStats
  messages: MessageStats
  recentActivity: RecentActivity[]
  generatedAt: string
}
```

---

### Step 2: Add Stats Route to Admin Router

Add the GET /admin/stats endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts`

Replace the file with this updated version:

```typescript
import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { requireAuth } from '../middleware/auth'
import { requireAdmin } from '../middleware/admin'
import { Errors } from '../errors'
import type {
  AdminStatsData,
  UserStats,
  GalleryStats,
  ArtworkStats,
  MessageStats,
  RecentActivity,
} from '../../../types/adminStats'

export const adminRouter = new Hono<HonoEnv>()

/**
 * Apply auth and admin middleware to all admin routes
 */
adminRouter.use('*', requireAuth)
adminRouter.use('*', requireAdmin)

/**
 * GET /admin/stats
 * Return platform statistics
 */
adminRouter.get('/stats', async (c) => {
  const db = c.env.DB

  try {
    // Get user statistics
    const userCounts = await db
      .prepare(
        `SELECT status, COUNT(*) as count FROM users GROUP BY status`
      )
      .all<{ status: string; count: number }>()

    const userStats: UserStats = {
      total: 0,
      active: 0,
      pending: 0,
      suspended: 0,
      deactivated: 0,
    }

    userCounts.forEach((row) => {
      userStats.total += row.count
      if (row.status === 'active') userStats.active = row.count
      else if (row.status === 'pending') userStats.pending = row.count
      else if (row.status === 'suspended') userStats.suspended = row.count
      else if (row.status === 'deactivated') userStats.deactivated = row.count
    })

    // Get gallery statistics
    const galleryCounts = await db
      .prepare(
        `SELECT status, COUNT(*) as count FROM galleries GROUP BY status`
      )
      .all<{ status: string; count: number }>()

    const galleryStats: GalleryStats = {
      total: 0,
      active: 0,
      archived: 0,
      hidden: 0,
    }

    galleryCounts.forEach((row) => {
      galleryStats.total += row.count
      if (row.status === 'active') galleryStats.active = row.count
      else if (row.status === 'archived') galleryStats.archived = row.count
      else if (row.status === 'hidden') galleryStats.hidden = row.count
    })

    // Get artwork statistics
    const artworkCounts = await db
      .prepare(
        `SELECT status, COUNT(*) as count FROM artworks GROUP BY status`
      )
      .all<{ status: string; count: number }>()

    const artworkStats: ArtworkStats = {
      total: 0,
      active: 0,
      hidden: 0,
      flagged: 0,
      deleted: 0,
    }

    artworkCounts.forEach((row) => {
      artworkStats.total += row.count
      if (row.status === 'active') artworkStats.active = row.count
      else if (row.status === 'hidden') artworkStats.hidden = row.count
      else if (row.status === 'flagged') artworkStats.flagged = row.count
      else if (row.status === 'deleted') artworkStats.deleted = row.count
    })

    // Get message statistics
    const messageCounts = await db
      .prepare(
        `SELECT status, COUNT(*) as count FROM messages GROUP BY status`
      )
      .all<{ status: string; count: number }>()

    const messageStats: MessageStats = {
      total: 0,
      sent: 0,
      pending_review: 0,
      approved: 0,
      rejected: 0,
    }

    messageCounts.forEach((row) => {
      messageStats.total += row.count
      if (row.status === 'sent') messageStats.sent = row.count
      else if (row.status === 'pending_review')
        messageStats.pending_review = row.count
      else if (row.status === 'approved') messageStats.approved = row.count
      else if (row.status === 'rejected') messageStats.rejected = row.count
    })

    // Get recent activity (last 10 items)
    const activityRows = await db
      .prepare(
        `SELECT
          al.action,
          al.entity_type,
          al.user_id,
          u.username,
          al.created_at
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 10`
      )
      .all<{
        action: string
        entity_type: string | null
        user_id: string | null
        username: string | null
        created_at: string
      }>()

    const recentActivity: RecentActivity[] = (activityRows || []).map((row) => ({
      action: row.action,
      entityType: row.entity_type,
      userId: row.user_id,
      username: row.username,
      createdAt: row.created_at,
    }))

    // Build response
    const stats: AdminStatsData = {
      users: userStats,
      galleries: galleryStats,
      artworks: artworkStats,
      messages: messageStats,
      recentActivity,
      generatedAt: new Date().toISOString(),
    }

    return c.json({ data: stats })
  } catch (err: any) {
    console.error('[Admin Stats Error]', err)
    throw Errors.internal('Failed to fetch statistics', {
      originalError: err.message,
    })
  }
})

/**
 * GET /admin
 * Placeholder - admin API root
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
- Queries user, gallery, artwork, and message tables grouped by status
- Aggregates counts into typed response objects
- Fetches 10 most recent activity log entries
- Joins activity log with users to get usernames
- Returns generation timestamp for cache control
- Includes full error handling with logging

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/adminStats.ts`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts` - Add GET /stats route

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Access Without Authentication

```bash
curl http://localhost:8788/api/admin/stats
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

### Test 3: Access as Regular User

1. Get a regular user's token
2. Call the endpoint:

```bash
curl -H "Authorization: Bearer {User_Token}" \
  http://localhost:8788/api/admin/stats
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

### Test 4: Access as Admin User

1. Set a user to admin role
2. Get their token
3. Call the endpoint:

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/stats
```

Expected response (200):
```json
{
  "data": {
    "users": {
      "total": 1,
      "active": 1,
      "pending": 0,
      "suspended": 0,
      "deactivated": 0
    },
    "galleries": {
      "total": 0,
      "active": 0,
      "archived": 0,
      "hidden": 0
    },
    "artworks": {
      "total": 0,
      "active": 0,
      "hidden": 0,
      "flagged": 0,
      "deleted": 0
    },
    "messages": {
      "total": 0,
      "sent": 0,
      "pending_review": 0,
      "approved": 0,
      "rejected": 0
    },
    "recentActivity": [],
    "generatedAt": "2026-01-19T15:35:00Z"
  }
}
```

---

### Test 5: With Sample Data

1. Create 2 galleries (1 active, 1 archived)
2. Create 5 artworks (3 active, 1 hidden, 1 flagged)
3. Create 3 messages (all sent)
4. Call stats endpoint

Expected: Stats reflect the created data

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/stats | jq '.data'
```

Expected output includes:
- galleries.total: 2, galleries.active: 1, galleries.archived: 1
- artworks.total: 5, artworks.active: 3, artworks.hidden: 1, artworks.flagged: 1
- messages.total: 3, messages.sent: 3

---

### Test 6: Recent Activity

1. Create an artwork (logs activity)
2. Call stats endpoint
3. Check recentActivity array

Expected: Recent activity entry appears in response with correct action and entity type

---

### Test 7: Activity With Deleted User

1. Create activity log entry
2. Delete the user who created it
3. Call stats endpoint

Expected: Recent activity still shows (user joined is NULL, but action/date still present)

---

### Test 8: Response Format

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/stats | jq '.data | keys'
```

Expected output:
```json
[
  "artworks",
  "galleries",
  "generatedAt",
  "messages",
  "recentActivity",
  "users"
]
```

---

### Test 9: Timestamp Format

Check that generatedAt is valid ISO 8601 timestamp:

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/stats | jq '.data.generatedAt'
```

Expected: Valid ISO timestamp like "2026-01-19T15:35:00Z"

---

### Test 10: Empty Database

If all tables are empty (unlikely), should return zeros:

Expected:
- All counts should be 0 or reflect only admin user
- recentActivity should be empty array

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] GET /api/admin/stats requires authentication (401)
- [ ] Requires admin role (403 for non-admins)
- [ ] Returns correct user counts by status
- [ ] Returns correct gallery counts by status
- [ ] Returns correct artwork counts by status
- [ ] Returns correct message counts by status
- [ ] Returns recent activity with correct fields
- [ ] Handles missing users in activity log gracefully
- [ ] Returns ISO 8601 timestamp in generatedAt
- [ ] Response format matches specification

---

## Next Steps

Once this build is verified, proceed to **135-API-ADMIN-ACTIVITY.md** to create the activity log query endpoint.
