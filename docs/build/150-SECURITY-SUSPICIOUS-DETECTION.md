# Build 150: Security - Suspicious Activity Detection

## Goal
Implement detection and flagging of suspicious user activities. Identify rapid uploads, duplicate images, and other abuse patterns. Automatically flag suspicious accounts for admin review.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Auto-flag for suspicious activity**: rapid uploads, duplicate images
- **New Account Limits**: 10 uploads/day for first 7 days (works in conjunction with this)
- **Security Considerations**: Support zero tolerance for illegal activity
- **Admin Tools**: Admin dashboard needs to review flagged content

---

## Prerequisites

**Must complete before starting:**
- **Build 13**: Supporting tables including `activity_log`
- **Build 06**: Users table with ability to flag/set status
- **Build 149**: Activity logging (logs to detect from)
- **Build 41**: API Artwork Create (endpoint to monitor)

---

## Steps

### Step 1: Create Suspicious Activity Detection Module

Create a utility module to detect various suspicious patterns.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/suspicious-detection.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types'
import type { AuthUser } from '../middleware/auth'
import crypto from 'crypto'

/**
 * Suspicious activity flags
 */
export enum SuspiciousFlag {
  RAPID_UPLOADS = 'rapid_uploads',           // >5 uploads in 1 minute
  DUPLICATE_IMAGES = 'duplicate_images',     // Same image hash uploaded multiple times
  BULK_GALLERY_CREATION = 'bulk_gallery_creation', // >10 galleries in 1 hour
  UNUSUAL_IP = 'unusual_ip',                 // Login from new/unexpected IP
  PASSWORD_CHANGES = 'frequent_password_changes', // Multiple password changes in short time
  FAILED_LOGINS = 'failed_logins',          // Multiple failed login attempts
}

/**
 * Suspicious activity record
 */
export interface SuspiciousActivityRecord {
  userId: string
  flag: SuspiciousFlag
  severity: 'low' | 'medium' | 'high' | 'critical'
  details: Record<string, any>
  detectedAt: string
  reviewed: boolean
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewNotes?: string | null
}

/**
 * Check for rapid uploads (>5 in 1 minute)
 */
export async function checkRapidUploads(
  db: D1Database,
  userId: string,
  threshold: number = 5
): Promise<{ detected: boolean; count: number; timeWindowMs: number }> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()

  const result = await db
    .prepare(
      `
      SELECT COUNT(*) as count FROM activity_log
      WHERE user_id = ?
        AND action = 'artwork_created'
        AND created_at >= ?
      `
    )
    .bind(userId, oneMinuteAgo)
    .first<{ count: number }>()

  const count = result?.count ?? 0

  return {
    detected: count > threshold,
    count,
    timeWindowMs: 60 * 1000,
  }
}

/**
 * Detect duplicate images by comparing file hashes
 * Should be called when artwork is created
 */
export async function checkDuplicateImage(
  db: D1Database,
  userId: string,
  imageHash: string
): Promise<{ isDuplicate: boolean; existingArtworkIds: string[] }> {
  // Query for artworks by this user with the same image hash
  const result = await db
    .prepare(
      `
      SELECT id FROM artworks
      WHERE user_id = ? AND image_hash = ?
      LIMIT 10
      `
    )
    .bind(userId, imageHash)
    .all<{ id: string }>()

  const existingArtworkIds = result.results?.map((r) => r.id) || []

  return {
    isDuplicate: existingArtworkIds.length > 0,
    existingArtworkIds,
  }
}

/**
 * Generate hash of image file
 * Call this on uploaded image to get hash for comparison
 */
export async function generateImageHash(imageBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', imageBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Check for bulk gallery creation (>10 in 1 hour)
 */
export async function checkBulkGalleryCreation(
  db: D1Database,
  userId: string,
  threshold: number = 10
): Promise<{ detected: boolean; count: number; timeWindowMs: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const result = await db
    .prepare(
      `
      SELECT COUNT(*) as count FROM activity_log
      WHERE user_id = ?
        AND action = 'gallery_created'
        AND created_at >= ?
      `
    )
    .bind(userId, oneHourAgo)
    .first<{ count: number }>()

  const count = result?.count ?? 0

  return {
    detected: count > threshold,
    count,
    timeWindowMs: 60 * 60 * 1000,
  }
}

/**
 * Check for unusual login IP address
 * Compares against user's previous login IPs
 */
export async function checkUnusualIP(
  db: D1Database,
  userId: string,
  currentIP: string
): Promise<{ isUnusual: boolean; previousIPs: string[] }> {
  // Get user's login history
  const result = await db
    .prepare(
      `
      SELECT DISTINCT ip_address FROM activity_log
      WHERE user_id = ?
        AND action IN ('user_login', 'user_signup')
      ORDER BY created_at DESC
      LIMIT 10
      `
    )
    .bind(userId)
    .all<{ ip_address: string }>()

  const previousIPs = result.results?.map((r) => r.ip_address) || []
  const isUnusual = !previousIPs.includes(currentIP) && previousIPs.length > 0

  return {
    isUnusual,
    previousIPs,
  }
}

/**
 * Check for failed login attempts (>5 in 15 minutes)
 */
export async function checkFailedLogins(
  db: D1Database,
  ipAddress: string,
  threshold: number = 5
): Promise<{ detected: boolean; count: number; timeWindowMs: number }> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  // Note: This requires logging failed login attempts
  // See activity-logger.ts for implementation
  const result = await db
    .prepare(
      `
      SELECT COUNT(*) as count FROM activity_log
      WHERE ip_address = ?
        AND action = 'user_login_failed'
        AND created_at >= ?
      `
    )
    .bind(ipAddress, fifteenMinutesAgo)
    .first<{ count: number }>()

  const count = result?.count ?? 0

  return {
    detected: count >= threshold,
    count,
    timeWindowMs: 15 * 60 * 1000,
  }
}

/**
 * Log a suspicious activity flag
 */
export async function flagSuspiciousActivity(
  db: D1Database,
  userId: string,
  flag: SuspiciousFlag,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, any>
): Promise<void> {
  // Check if already flagged recently
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const existing = await db
    .prepare(
      `
      SELECT id FROM activity_log
      WHERE user_id = ?
        AND action = 'admin_content_flagged'
        AND metadata LIKE ?
        AND created_at >= ?
      LIMIT 1
      `
    )
    .bind(userId, `%${flag}%`, oneHourAgo)
    .first()

  if (existing) {
    // Already flagged recently, don't duplicate
    return
  }

  // Log the flag
  const { generateId } = await import('../utils/id')

  await db
    .prepare(
      `
      INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      generateId(),
      userId,
      'admin_content_flagged',
      'user',
      userId,
      JSON.stringify({
        flag,
        severity,
        ...details,
      }),
      new Date().toISOString()
    )
    .run()

  // Update user status to flagged if severity is high/critical
  if (severity === 'high' || severity === 'critical') {
    await db
      .prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
      .bind('flagged', new Date().toISOString(), userId)
      .run()
  }
}

/**
 * Get flagged users for admin review
 */
export async function getFlaggedUsers(
  db: D1Database,
  limit: number = 50,
  offset: number = 0
): Promise<Array<{ userId: string; username: string; flags: any[] }>> {
  const result = await db
    .prepare(
      `
      SELECT DISTINCT u.id, u.username FROM users u
      WHERE u.status = 'flagged'
      ORDER BY u.updated_at DESC
      LIMIT ? OFFSET ?
      `
    )
    .bind(limit, offset)
    .all<{ id: string; username: string }>()

  const users = result.results || []

  // Get flags for each user
  const usersWithFlags = await Promise.all(
    users.map(async (user) => {
      const flagsResult = await db
        .prepare(
          `
          SELECT metadata FROM activity_log
          WHERE user_id = ? AND action = 'admin_content_flagged'
          ORDER BY created_at DESC
          LIMIT 20
          `
        )
        .bind(user.id)
        .all<{ metadata: string }>()

      const flags = flagsResult.results
        ?.map((r) => {
          try {
            return JSON.parse(r.metadata)
          } catch {
            return {}
          }
        })
        .slice(0, 5) || [] // Show last 5 flags

      return {
        userId: user.id,
        username: user.username,
        flags,
      }
    })
  )

  return usersWithFlags
}

/**
 * Clear suspicious flags for a user (after review)
 */
export async function clearSuspiciousFlags(
  db: D1Database,
  userId: string,
  reviewedBy: string,
  reviewNotes: string
): Promise<void> {
  // Update user status back to active
  await db
    .prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
    .bind('active', new Date().toISOString(), userId)
    .run()

  // Log the review action
  const { generateId } = await import('../utils/id')

  await db
    .prepare(
      `
      INSERT INTO activity_log (id, user_id, action, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
      `
    )
    .bind(
      generateId(),
      userId,
      'admin_action',
      JSON.stringify({
        action: 'cleared_flags',
        reviewedBy,
        reviewNotes,
      }),
      new Date().toISOString()
    )
    .run()
}
```

### Step 2: Integrate Detection into Upload Endpoint

Modify the artwork create handler to check for suspicious activity.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks.ts`

```typescript
import {
  checkRapidUploads,
  checkDuplicateImage,
  generateImageHash,
  flagSuspiciousActivity,
  SuspiciousFlag,
} from '../../lib/api/security/suspicious-detection'
import { logUserActivity, ActivityAction, EntityType } from '../../lib/api/security/activity-logger'

/**
 * Update artwork create handler to include suspicious detection
 */
export async function createArtwork(c: HonoContext) {
  const db = c.env.DB as D1Database
  const user = c.get('user')

  // Get image from request
  const formData = await c.req.formData()
  const imageFile = formData.get('image') as File

  if (!imageFile) {
    return c.json({ error: 'Image required' }, 400)
  }

  // Calculate image hash for duplicate detection
  const imageBuffer = await imageFile.arrayBuffer()
  const imageHash = await generateImageHash(imageBuffer)

  // Check for duplicate images
  const duplicateCheck = await checkDuplicateImage(db, user.userId, imageHash)

  if (duplicateCheck.isDuplicate) {
    await flagSuspiciousActivity(
      db,
      user.userId,
      SuspiciousFlag.DUPLICATE_IMAGES,
      'medium',
      {
        existingArtworkIds: duplicateCheck.existingArtworkIds,
        attemptedUploadTime: new Date().toISOString(),
      }
    )

    return c.json(
      {
        error: 'Duplicate image detected',
        message: 'This image appears to be a duplicate of existing artwork',
      },
      400
    )
  }

  // Create artwork (with other validations)
  const artwork = await createArtworkInDb(db, user.userId, {
    // ... other fields ...
    image_hash: imageHash,
    // ... other fields ...
  })

  // Log the activity
  await logUserActivity(
    db,
    c,
    ActivityAction.ARTWORK_CREATED,
    EntityType.ARTWORK,
    artwork.id,
    {
      title: artwork.title,
      galleryId: artwork.gallery_id,
    }
  )

  // Check for rapid uploads (after logging)
  const rapidCheck = await checkRapidUploads(db, user.userId)

  if (rapidCheck.detected) {
    await flagSuspiciousActivity(
      db,
      user.userId,
      SuspiciousFlag.RAPID_UPLOADS,
      'high',
      {
        uploadCount: rapidCheck.count,
        timeWindow: '1 minute',
        threshold: 5,
      }
    )

    return c.json(
      {
        status: 201,
        data: artwork,
        warning: 'Unusual upload activity detected. Your account is under review.',
      },
      201
    )
  }

  return c.json({ status: 201, data: artwork }, 201)
}
```

### Step 3: Create Admin Endpoint to Review Flagged Users

Create an API endpoint for admins to review and clear flags.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/admin/suspicious-activity.ts`

```typescript
import { Hono } from 'hono'
import type { HonoContext } from '../../../types/env'
import { requireAuth, requireAdmin } from '../../../lib/api/middleware/auth'
import {
  getFlaggedUsers,
  clearSuspiciousFlags,
  SuspiciousFlag,
} from '../../../lib/api/security/suspicious-detection'

const router = new Hono<HonoContext>()

/**
 * GET /admin/suspicious-activity/flagged
 * Get list of flagged users for review
 * Admin only
 */
router.get('/flagged', requireAuth, requireAdmin, async (c) => {
  const db = c.env.DB as D1Database
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
  const offset = parseInt(c.req.query('offset') || '0')

  const flaggedUsers = await getFlaggedUsers(db, limit, offset)

  return c.json({
    data: flaggedUsers,
    pagination: { limit, offset },
  })
})

/**
 * POST /admin/suspicious-activity/:userId/clear-flags
 * Clear flags for a user after review
 * Admin only
 */
router.post('/:userId/clear-flags', requireAuth, requireAdmin, async (c) => {
  const db = c.env.DB as D1Database
  const userId = c.req.param('userId')
  const admin = c.get('user')
  const body = await c.req.json<{ reviewNotes: string }>()

  if (!body.reviewNotes) {
    return c.json({ error: 'Review notes required' }, 400)
  }

  await clearSuspiciousFlags(db, userId, admin.userId, body.reviewNotes)

  return c.json({
    success: true,
    message: 'Flags cleared for user',
    userId,
  })
})

/**
 * GET /admin/suspicious-activity/stats
 * Get statistics on suspicious activity
 * Admin only
 */
router.get('/stats', requireAuth, requireAdmin, async (c) => {
  const db = c.env.DB as D1Database

  // Count flagged users
  const flaggedCount = await db
    .prepare('SELECT COUNT(*) as count FROM users WHERE status = ?')
    .bind('flagged')
    .first<{ count: number }>()

  // Count recent flags by type
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const flagsByType = await db
    .prepare(
      `
      SELECT
        JSON_EXTRACT(metadata, '$.flag') as flag,
        COUNT(*) as count
      FROM activity_log
      WHERE action = 'admin_content_flagged'
        AND created_at >= ?
      GROUP BY JSON_EXTRACT(metadata, '$.flag')
      `
    )
    .bind(oneDayAgo)
    .all<{ flag: string; count: number }>()

  return c.json({
    flaggedUsers: flaggedCount?.count || 0,
    flagsByType: Object.fromEntries(
      flagsByType.results?.map((r) => [r.flag, r.count]) || []
    ),
    timeWindow: '24 hours',
  })
})

export default router
```

### Step 4: Add Suspicious Activity to User Signup

Check for suspicious patterns during account creation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/auth.ts`

```typescript
import { checkFailedLogins } from '../../lib/api/security/suspicious-detection'

/**
 * Update signup handler to check for suspicious IP patterns
 */
export async function handleSignup(c: HonoContext) {
  const db = c.env.DB as D1Database
  const ipAddress = c.req.header('cf-connecting-ip') || 'unknown'

  // Check for failed login attempts from this IP
  const failedLogins = await checkFailedLogins(db, ipAddress)

  if (failedLogins.detected) {
    // Still allow signup but log as suspicious
    // (Or deny if you prefer stricter policy)
  }

  // ... rest of signup logic ...
}

/**
 * Log failed login attempts
 */
export async function handleLoginFailure(c: HonoContext, reason: string) {
  const db = c.env.DB as D1Database
  const ipAddress = c.req.header('cf-connecting-ip') || 'unknown'
  const { generateId } = await import('../../lib/api/utils/id')

  await db
    .prepare(
      `
      INSERT INTO activity_log (id, action, ip_address, user_agent, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      generateId(),
      'user_login_failed',
      ipAddress,
      c.req.header('user-agent') || 'unknown',
      JSON.stringify({ reason }),
      new Date().toISOString()
    )
    .run()
}
```

---

## Files to Create/Modify

| Path | Action | Purpose |
|------|--------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/security/suspicious-detection.ts` | Create | Detection logic and flagging functions |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks.ts` | Modify | Add detection checks to create endpoint |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/auth.ts` | Modify | Add failed login logging and checks |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/admin/suspicious-activity.ts` | Create | Admin endpoints for reviewing flags |

---

## Verification

### Test 1: Detect rapid uploads
```bash
# As a test user, quickly upload 6 artworks within 1 minute
for i in {1..6}; do
  curl -X POST http://localhost:8787/api/artworks \
    -H "Authorization: Bearer {token}" \
    -F "image=@test_image.jpg" \
    -F "title=Test$i"
done

# After 5th upload, should be flagged
# Check user status
wrangler d1 execute site --command="SELECT id, username, status FROM users WHERE id = '{userId}';"

# Status should be 'flagged'
```

### Test 2: Detect duplicate images
```bash
# Upload the same image twice
curl -X POST http://localhost:8787/api/artworks \
  -H "Authorization: Bearer {token}" \
  -F "image=@same_image.jpg" \
  -F "title=Upload1"

# Second upload should fail
curl -X POST http://localhost:8787/api/artworks \
  -H "Authorization: Bearer {token}" \
  -F "image=@same_image.jpg" \
  -F "title=Upload2"

# Should get error: "Duplicate image detected"
```

### Test 3: View flagged users as admin
```bash
curl -X GET http://localhost:8787/api/admin/suspicious-activity/flagged \
  -H "Authorization: Bearer {admin_token}"

# Should return list of flagged users with their flags
```

### Test 4: Clear flags for user
```bash
curl -X POST http://localhost:8787/api/admin/suspicious-activity/{userId}/clear-flags \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"reviewNotes":"User contacted, confirmed not malicious"}'

# User status should change from 'flagged' back to 'active'
# Check result:
wrangler d1 execute site --command="SELECT status FROM users WHERE id = '{userId}';"
```

### Test 5: Get suspicious activity stats
```bash
curl -X GET http://localhost:8787/api/admin/suspicious-activity/stats \
  -H "Authorization: Bearer {admin_token}"

# Should return counts of flagged users and breakdown by flag type
```

### Test 6: Failed login detection
```bash
# Make 6 failed login attempts from same IP
for i in {1..6}; do
  curl -X POST http://localhost:8787/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done

# Check activity log for failed attempts
wrangler d1 execute site --command="SELECT action, COUNT(*) FROM activity_log WHERE action = 'user_login_failed' GROUP BY ip_address;"

# Should show 6 failed attempts from same IP
```
