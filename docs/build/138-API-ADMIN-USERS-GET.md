# Build 138: GET /api/admin/users/:id Endpoint

## Goal
Create the `GET /api/admin/users/:id` endpoint that returns complete user details including email, account status, activity history, and resource counts. Used for viewing detailed user information in the admin dashboard.

---

## Spec Extract

**Request:**
```
GET /api/admin/users/{userId}
```

**Response (200 OK):**
```json
{
  "id": "usr_abc123",
  "username": "artist-name",
  "email": "artist@example.com",
  "displayName": "Artist Name",
  "avatarUrl": "https://...",
  "bio": "Bio text",
  "website": "https://example.com",
  "phone": "+1-234-567-8900",
  "socials": {
    "instagram": "handle",
    "twitter": "handle"
  },
  "status": "active",
  "role": "user",
  "galleries": 3,
  "collections": 12,
  "artworks": 45,
  "galleryLimit": 500,
  "collectionLimit": 1000,
  "artworkLimit": 5000,
  "dailyUploadLimit": 10,
  "emailVerifiedAt": "2024-01-01T00:00:00Z",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T13:45:00Z",
  "lastLoginAt": "2024-01-18T10:30:00Z",
  "activity": {
    "logins": 42,
    "lastActivity": "2024-01-18T10:30:00Z",
    "uploads": 12,
    "messages": 8
  }
}
```

**Errors:**
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User is not admin
- 404 Not Found: User not found
- 400 Bad Request: Invalid user ID format

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware
- **137-API-ADMIN-USERS-LIST.md** - Admin user list endpoint
- **06-SCHEMA-USERS.md** - Users table
- **26-SCHEMA-ARTWORKS.md** - Artworks table for counts

**Reason:** Endpoint requires admin authentication and queries multiple entities.

---

## Steps

### Step 1: Create Database Query Module for User Details

Extend the admin users database module with detailed user fetching.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/admin/users.ts` (append to existing)

Add these functions at the end of the file:

```typescript
/**
 * Activity metrics for a user
 */
export interface UserActivity {
  logins: number;
  lastActivity: string | null;
  uploads: number;
  messages: number;
}

/**
 * Detailed user information with counts and activity
 */
export interface DetailedUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
  phone: string | null;
  socials: Record<string, string> | null;
  status: string;
  role: string;
  galleries: number;
  collections: number;
  artworks: number;
  galleryLimit: number;
  collectionLimit: number;
  artworkLimit: number;
  dailyUploadLimit: number;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  activity: UserActivity;
}

/**
 * Fetch detailed user information by ID
 */
export async function getUserById(db: D1Database, userId: string): Promise<DetailedUser | null> {
  // Validate user ID format
  if (!userId || typeof userId !== 'string') {
    return null;
  }

  // Fetch user details
  const userResult = await db
    .prepare(
      `
    SELECT
      id,
      username,
      email,
      display_name as displayName,
      avatar_url as avatarUrl,
      bio,
      website,
      phone,
      socials,
      status,
      role,
      gallery_limit as galleryLimit,
      collection_limit as collectionLimit,
      artwork_limit as artworkLimit,
      daily_upload_limit as dailyUploadLimit,
      email_verified_at as emailVerifiedAt,
      created_at as createdAt,
      updated_at as updatedAt,
      last_login_at as lastLoginAt
    FROM users
    WHERE id = ?
  `
    )
    .bind(userId)
    .first<any>();

  if (!userResult) {
    return null;
  }

  // Parse socials JSON
  let socials: Record<string, string> | null = null;
  if (userResult.socials) {
    try {
      socials = JSON.parse(userResult.socials);
    } catch (e) {
      socials = null;
    }
  }

  // Fetch resource counts
  const galleries = await db
    .prepare(`SELECT COUNT(*) as count FROM galleries WHERE user_id = ?`)
    .bind(userId)
    .first<{ count: number }>();

  const collections = await db
    .prepare(`SELECT COUNT(*) as count FROM collections WHERE user_id = ?`)
    .bind(userId)
    .first<{ count: number }>();

  const artworks = await db
    .prepare(`SELECT COUNT(*) as count FROM artworks WHERE user_id = ?`)
    .bind(userId)
    .first<{ count: number }>();

  // Fetch activity metrics
  const uploads = await db
    .prepare(`SELECT COUNT(*) as count FROM artworks WHERE user_id = ? AND created_at >= datetime('now', '-30 days')`)
    .bind(userId)
    .first<{ count: number }>();

  const messages = await db
    .prepare(
      `SELECT COUNT(*) as count FROM messages WHERE sender_id = ? OR recipient_id = ?`
    )
    .bind(userId, userId)
    .first<{ count: number }>();

  const activity = await db
    .prepare(
      `
    SELECT MAX(last_login_at) as lastActivity FROM users WHERE id = ?
  `
    )
    .bind(userId)
    .first<{ lastActivity: string | null }>();

  // Count logins (approximate based on last_login_at updates)
  // This is a simplified version - ideally you'd have a login_log table
  const loginCount = 0; // Placeholder - would require login history table

  return {
    id: userResult.id,
    username: userResult.username,
    email: userResult.email,
    displayName: userResult.displayName || null,
    avatarUrl: userResult.avatarUrl || null,
    bio: userResult.bio || null,
    website: userResult.website || null,
    phone: userResult.phone || null,
    socials,
    status: userResult.status,
    role: userResult.role,
    galleries: galleries?.count || 0,
    collections: collections?.count || 0,
    artworks: artworks?.count || 0,
    galleryLimit: userResult.galleryLimit || 500,
    collectionLimit: userResult.collectionLimit || 1000,
    artworkLimit: userResult.artworkLimit || 5000,
    dailyUploadLimit: userResult.dailyUploadLimit || 10,
    emailVerifiedAt: userResult.emailVerifiedAt || null,
    createdAt: userResult.createdAt,
    updatedAt: userResult.updatedAt,
    lastLoginAt: userResult.lastLoginAt || null,
    activity: {
      logins: loginCount,
      lastActivity: activity?.lastActivity || null,
      uploads: uploads?.count || 0,
      messages: messages?.count || 0,
    },
  };
}
```

---

### Step 2: Create Validation for User ID

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/admin-users.ts` (append)

Add this function:

```typescript
/**
 * Validate user ID format
 */
export function validateUserId(userId: string): { valid: boolean; error?: string } {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, error: 'User ID must be a non-empty string' };
  }

  if (userId.length > 255) {
    return { valid: false, error: 'User ID is too long' };
  }

  return { valid: true };
}
```

---

### Step 3: Create API Route Handler

Create the GET endpoint for fetching individual user details.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/users-get.ts`

```typescript
/**
 * GET /api/admin/users/:id - Fetch detailed user information
 */

import type { HonoContext } from '../../../../types/env';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { Errors } from '../../errors';
import { validateUserId } from '../../../validation/admin-users';
import { getUserById } from '../../../db/admin/users';

/**
 * Handler for GET /api/admin/users/:id
 */
export async function handleGetAdminUser(c: HonoContext) {
  // Middleware ensures user is authenticated admin
  const userId = c.req.param('id');

  // Validate user ID
  const validation = validateUserId(userId);
  if (!validation.valid) {
    throw Errors.badRequest(validation.error);
  }

  try {
    // Query database
    const db = c.env.DB;
    const user = await getUserById(db, userId);

    if (!user) {
      throw Errors.notFound('User not found');
    }

    return c.json(user);
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      throw error;
    }
    console.error('[Admin User Get] Database error:', error);
    throw Errors.internal('Failed to fetch user');
  }
}

/**
 * Register route with middleware
 */
export function registerAdminUsersGetRoute(app: any) {
  app.get('/api/admin/users/:id', requireAuth, requireAdmin, handleGetAdminUser);
}
```

---

### Step 4: Update Main API File

Update the main Hono app to register the new endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add these lines:

```typescript
// Add import
import { registerAdminUsersGetRoute } from './routes/admin/users-get'

// Add route registration
registerAdminUsersGetRoute(app)
```

---

### Step 5: Add Type Definitions

Update the admin types file.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/admin.ts` (append)

```typescript
export interface UserActivity {
  logins: number;
  lastActivity: string | null;
  uploads: number;
  messages: number;
}

export interface DetailedAdminUser extends AdminUser {
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
  phone: string | null;
  socials: Record<string, string> | null;
  galleries: number;
  collections: number;
  galleryLimit: number;
  collectionLimit: number;
  artworkLimit: number;
  dailyUploadLimit: number;
  emailVerifiedAt: string | null;
  activity: UserActivity;
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/users-get.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/admin/users.ts` - Add getUserById function
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/admin-users.ts` - Add validateUserId function
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/admin.ts` - Add DetailedAdminUser type
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Add route registration

---

## Verification

### Test 1: Fetch Existing User

Request details for a known user:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123
```

Expected response (200) with all user details, activity metrics, and resource counts.

---

### Test 2: Check Activity Data

Verify activity fields are populated:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123 | jq '.activity'
```

Expected output:
```json
{
  "logins": 0,
  "lastActivity": "2024-01-18T10:30:00Z",
  "uploads": 12,
  "messages": 8
}
```

---

### Test 3: Verify Resource Counts

Check that galleries, collections, artworks counts are correct:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123 | jq '.galleries, .collections, .artworks'
```

Expected: Numbers match database counts for this user.

---

### Test 4: User Not Found

Request non-existent user:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_nonexistent
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

---

### Test 5: Invalid User ID

Request with invalid user ID:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/""
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "User ID must be a non-empty string"
  }
}
```

---

### Test 6: Without Admin Role

Request as non-admin:

```bash
curl -H "Authorization: Bearer <user-token>" \
  http://localhost:8788/api/admin/users/usr_abc123
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

### Test 7: Email Verification Status

Verify emailVerifiedAt is populated correctly:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123 | jq '.emailVerifiedAt'
```

Expected: ISO 8601 timestamp or null if not verified.

---

### Test 8: User Limits Display

Verify user limit fields match database:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123 | \
  jq '.galleryLimit, .collectionLimit, .artworkLimit, .dailyUploadLimit'
```

Expected: Numbers matching the users table values.

---

## Summary

This build creates a detailed user information endpoint with:
- Complete user profile data (email, bio, socials, etc.)
- Activity metrics (logins, uploads, messages)
- Resource counts (galleries, collections, artworks)
- User limits configuration
- Email verification status
- Last activity tracking
- Admin-only access control

Enables admins to view comprehensive user information for decision-making.

---

**Next step:** Proceed to **139-API-ADMIN-USERS-UPDATE.md** to create the endpoint for updating user details.
