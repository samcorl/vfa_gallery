# 135-API-ADMIN-ACTIVITY.md

## Goal

Create the `GET /api/admin/activity` endpoint to query the activity log table with filtering by action type, user, and date range. Returns paginated activity feed with user information for each entry.

---

## Spec Extract

From TECHNICAL-SPEC.md - Admin Tools:

- **Endpoint:** `GET /api/admin/activity`
- **Authentication:** Required (JWT token)
- **Authorization:** Admin role required
- **Query Parameters:**
  - `action`: Filter by action type (e.g., 'create', 'update', 'delete', 'publish', 'flag') - optional
  - `user_id`: Filter by user who performed action - optional
  - `from`: Start date (ISO 8601) - optional
  - `to`: End date (ISO 8601) - optional
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20, max: 100)
- **Response (200 OK):**
  ```json
  {
    "data": {
      "activities": [
        {
          "id": "log_123",
          "action": "upload",
          "entityType": "artwork",
          "entityId": "art_456",
          "userId": "user_789",
          "username": "artist-name",
          "userEmail": "artist@example.com",
          "metadata": {
            "title": "Sunset Landscape",
            "size": "2.5MB"
          },
          "ipAddress": "192.168.1.1",
          "userAgent": "Mozilla/5.0...",
          "createdAt": "2026-01-19T15:30:00Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 450,
        "pages": 23
      }
    }
  }
  ```
- **HTTP Status Codes:**
  - `200` - Success
  - `400` - Bad request (invalid filters)
  - `401` - Unauthorized
  - `403` - Forbidden (not admin)

---

## Prerequisites

**Must complete before starting:**
- **133-API-ADMIN-MIDDLEWARE.md** - Admin role verification middleware
- **13-SCHEMA-SUPPORTING.md** - Activity log table
- **06-SCHEMA-USERS.md** - Users table for user info lookup

---

## Steps

### Step 1: Create Activity Query Types

Define types for the activity endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/adminActivity.ts`

```typescript
/**
 * Admin activity log query and response types
 */

export interface ActivityLogEntry {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  userId: string | null
  username: string | null
  userEmail: string | null
  metadata: Record<string, any> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export interface ActivityPaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export interface ActivityResponse {
  activities: ActivityLogEntry[]
  pagination: ActivityPaginationMeta
}

export interface ActivityFilters {
  action?: string
  user_id?: string
  from?: string // ISO 8601 date
  to?: string // ISO 8601 date
  page?: number
  limit?: number
}
```

---

### Step 2: Create Activity Service Functions

Add functions to query and filter activity log.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/admin.service.ts`

Create this new service file:

```typescript
import type { Database } from '@cloudflare/workers-types'
import { Errors } from '../errors'
import type {
  ActivityLogEntry,
  ActivityPaginationMeta,
  ActivityResponse,
  ActivityFilters,
} from '../../../types/adminActivity'

/**
 * Query activity log with filtering and pagination
 */
export async function getActivityLog(
  db: Database,
  filters: ActivityFilters
): Promise<ActivityResponse> {
  const {
    action = null,
    user_id = null,
    from = null,
    to = null,
    page = 1,
    limit = 20,
  } = filters

  // Validate pagination
  if (page < 1 || limit < 1 || limit > 100) {
    throw Errors.badRequest(
      'Invalid pagination: page must be >= 1, limit must be 1-100'
    )
  }

  // Validate date range if provided
  if (from && to) {
    try {
      const fromDate = new Date(from)
      const toDate = new Date(to)
      if (fromDate > toDate) {
        throw Errors.badRequest(
          'Invalid date range: from must be before to'
        )
      }
    } catch (err: any) {
      if (err.code === 'BAD_REQUEST') throw err
      throw Errors.badRequest('Invalid date format (use ISO 8601)')
    }
  }

  // Build WHERE clause dynamically
  const whereConditions: string[] = []
  const params: any[] = []

  if (action) {
    whereConditions.push('al.action = ?')
    params.push(action)
  }

  if (user_id) {
    whereConditions.push('al.user_id = ?')
    params.push(user_id)
  }

  if (from) {
    whereConditions.push('al.created_at >= ?')
    params.push(from)
  }

  if (to) {
    whereConditions.push('al.created_at <= ?')
    params.push(to)
  }

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

  // Get total count
  const countSql = `
    SELECT COUNT(*) as total
    FROM activity_log al
    ${whereClause}
  `

  const countResult = await db
    .prepare(countSql)
    .bind(...params)
    .first<{ total: number }>()

  const total = countResult?.total || 0
  const pages = Math.ceil(total / limit)

  // Calculate offset
  const offset = (page - 1) * limit

  // Get paginated results with user info
  const querySql = `
    SELECT
      al.id,
      al.action,
      al.entity_type,
      al.entity_id,
      al.user_id,
      u.username,
      u.email,
      al.metadata,
      al.ip_address,
      al.user_agent,
      al.created_at
    FROM activity_log al
    LEFT JOIN users u ON al.user_id = u.id
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `

  const activities = await db
    .prepare(querySql)
    .bind(...params, limit, offset)
    .all<{
      id: string
      action: string
      entity_type: string | null
      entity_id: string | null
      user_id: string | null
      username: string | null
      email: string | null
      metadata: string | null
      ip_address: string | null
      user_agent: string | null
      created_at: string
    }>()

  const activityEntries: ActivityLogEntry[] = (activities || []).map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    userId: row.user_id,
    username: row.username,
    userEmail: row.email,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }))

  const pagination: ActivityPaginationMeta = {
    page,
    limit,
    total,
    pages,
  }

  return {
    activities: activityEntries,
    pagination,
  }
}
```

---

### Step 3: Add Activity Route to Admin Router

Add the GET /admin/activity endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts`

Add this import at the top:

```typescript
import { getActivityLog } from '../services/admin.service'
import type { ActivityFilters } from '../../../types/adminActivity'
```

Add this route before the final `GET /admin` route:

```typescript
/**
 * GET /admin/activity
 * Query activity log with filtering and pagination
 */
adminRouter.get('/activity', async (c) => {
  const db = c.env.DB

  try {
    // Extract query parameters
    const action = c.req.query('action') || undefined
    const user_id = c.req.query('user_id') || undefined
    const from = c.req.query('from') || undefined
    const to = c.req.query('to') || undefined
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')

    const filters: ActivityFilters = {
      action,
      user_id,
      from,
      to,
      page,
      limit,
    }

    const response = await getActivityLog(db, filters)

    return c.json({ data: response })
  } catch (err: any) {
    console.error('[Admin Activity Error]', err)
    if (err.code === 'BAD_REQUEST') {
      throw err
    }
    throw Errors.internal('Failed to fetch activity log', {
      originalError: err.message,
    })
  }
})
```

---

### Step 4: Update Admin Router Imports (if needed)

Ensure the admin router file has all necessary imports:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts`

Complete imports section should include:

```typescript
import { Hono } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { requireAuth } from '../middleware/auth'
import { requireAdmin } from '../middleware/admin'
import { Errors } from '../errors'
import { getActivityLog } from '../services/admin.service'
import type {
  AdminStatsData,
  UserStats,
  GalleryStats,
  ArtworkStats,
  MessageStats,
  RecentActivity,
} from '../../../types/adminStats'
import type { ActivityFilters } from '../../../types/adminActivity'
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/adminActivity.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/admin.service.ts`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin.ts` - Add GET /activity route

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
curl http://localhost:8788/api/admin/activity
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

```bash
curl -H "Authorization: Bearer {User_Token}" \
  http://localhost:8788/api/admin/activity
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

### Test 4: Access as Admin - No Filters

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  http://localhost:8788/api/admin/activity
```

Expected response (200) with empty activities initially:
```json
{
  "data": {
    "activities": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "pages": 0
    }
  }
}
```

---

### Test 5: Filter by Action

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/activity?action=upload"
```

Expected: Returns only activities with action='upload'

---

### Test 6: Filter by User

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/activity?user_id=user_123"
```

Expected: Returns only activities performed by specified user

---

### Test 7: Filter by Date Range

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/activity?from=2026-01-15T00:00:00Z&to=2026-01-19T23:59:59Z"
```

Expected: Returns activities created within date range

---

### Test 8: Combined Filters

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/activity?action=upload&user_id=user_123&from=2026-01-15T00:00:00Z&limit=10"
```

Expected: Returns filtered results with limit=10

---

### Test 9: Pagination

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/activity?page=2&limit=5"
```

Expected response includes:
```json
{
  "pagination": {
    "page": 2,
    "limit": 5,
    "total": X,
    "pages": Y
  }
}
```

---

### Test 10: Invalid Pagination

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/activity?page=0&limit=200"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid pagination: page must be >= 1, limit must be 1-100"
  }
}
```

---

### Test 11: Invalid Date Range

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/activity?from=2026-01-20&to=2026-01-15"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid date range: from must be before to"
  }
}
```

---

### Test 12: Response Format

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/activity?page=1&limit=5" | jq '.data.activities[0]'
```

Expected to have all fields:
- id, action, entityType, entityId, userId, username, userEmail, metadata, ipAddress, userAgent, createdAt

---

### Test 13: User Join with Deleted User

1. Create activity for user
2. Delete the user
3. Query activity

Expected: Activity still appears with userId but username/email are null

---

### Test 14: Metadata Parsing

For activities with metadata JSON, verify it's properly parsed and returned as object:

```bash
curl -H "Authorization: Bearer {Admin_Token}" \
  "http://localhost:8788/api/admin/activity" | jq '.data.activities[0].metadata'
```

Expected: Object or null (not string)

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] GET /api/admin/activity requires authentication (401)
- [ ] Requires admin role (403 for non-admins)
- [ ] Returns empty activities for fresh database
- [ ] Filters by action type correctly
- [ ] Filters by user_id correctly
- [ ] Filters by date range (from and to)
- [ ] Combines multiple filters correctly
- [ ] Pagination works (page, limit, total, pages)
- [ ] Validates pagination limits (1-100)
- [ ] Validates date range (from before to)
- [ ] Joins user information properly
- [ ] Handles deleted users gracefully (null username/email)
- [ ] Parses metadata as JSON object
- [ ] Returns ISO 8601 timestamps

---

## Next Steps

Once this build is verified, proceed to **136-UI-ADMIN-DASHBOARD.md** to create the admin dashboard page.
