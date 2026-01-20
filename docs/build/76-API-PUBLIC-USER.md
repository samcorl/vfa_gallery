# 76-API-PUBLIC-USER.md

## Goal
Create the `GET /api/users/:username` endpoint that returns public profile information for any user. This endpoint allows anyone (authenticated or not) to view a user's public profile data without exposing private information like email, phone, or account status.

---

## Spec Extract

From TECHNICAL-SPEC.md:
- **Endpoint:** `GET /api/users/:username`
- **Public Access:** No authentication required
- **Response:** Public profile data only
- **Fields included:** username, displayName, avatarUrl, bio, website, socials (all platforms), galleriesCount, artworksCount
- **Fields excluded:** email, phone, status, subscription limits, private flags, updated dates
- **Error handling:** Return 404 if user not found or inactive
- **Cache:** Can be cached for 1 hour (optional)

---

## Prerequisites

**Must complete before starting:**
- **06-SCHEMA-USERS.md** - Users table created with all fields
- **15-API-FOUNDATION.md** - Hono app, error handling, and types established

**Reason:** Need users table and API foundation to create the endpoint.

---

## Steps

### Step 1: Create Shared Database Query Helper

Create a utility function to fetch public user profile data with proper field filtering.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts`

```typescript
import type { HonoContext } from '../../types/env'
import { Errors } from '../api/errors'

/**
 * Public user profile response type
 * Contains only fields safe for public access
 */
export interface PublicUserProfile {
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  website: string | null
  socials: {
    instagram: string | null
    twitter: string | null
    tiktok: string | null
    youtube: string | null
    bluesky: string | null
    threads: string | null
  }
  galleriesCount: number
  artworksCount: number
}

/**
 * Fetch public user profile by username
 * Returns only public fields, excludes private user data
 * Returns null if user not found or inactive
 */
export async function getPublicUserProfile(
  db: any,
  username: string
): Promise<PublicUserProfile | null> {
  try {
    // Query user with all profile fields
    const user = await db
      .prepare(
        `
        SELECT
          id,
          username,
          displayName,
          avatarUrl,
          bio,
          website,
          instagram,
          twitter,
          tiktok,
          youtube,
          bluesky,
          threads,
          status
        FROM users
        WHERE username = ? AND status = 'active'
        LIMIT 1
        `
      )
      .bind(username)
      .first()

    if (!user) {
      return null
    }

    // Query gallery count
    const galleryResult = await db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM galleries
        WHERE userId = ? AND active = 1
        `
      )
      .bind(user.id)
      .first()

    const galleriesCount = galleryResult?.count || 0

    // Query artwork count
    const artworkResult = await db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM artworks
        WHERE userId = ? AND active = 1
        `
      )
      .bind(user.id)
      .first()

    const artworksCount = artworkResult?.count || 0

    // Build public profile response
    return {
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      website: user.website,
      socials: {
        instagram: user.instagram,
        twitter: user.twitter,
        tiktok: user.tiktok,
        youtube: user.youtube,
        bluesky: user.bluesky,
        threads: user.threads,
      },
      galleriesCount,
      artworksCount,
    }
  } catch (error) {
    console.error('[getPublicUserProfile] Database error:', error)
    throw error
  }
}
```

**Explanation:**
- Only queries and returns public fields
- Filters for `status = 'active'` to exclude inactive users
- Counts active galleries and artworks
- Organizes socials into a clean object
- Returns null if user not found or inactive

---

### Step 2: Create Public User API Endpoint

Create the route handler for the GET /api/users/:username endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/public/users.ts`

```typescript
import { Hono } from 'hono'
import type { HonoContext } from '../../types/env'
import { Errors } from '../../lib/api/errors'
import { getPublicUserProfile } from '../../lib/db/users'

const publicUsersRouter = new Hono<HonoContext['Bindings']>()

/**
 * GET /api/users/:username
 * Fetch public user profile by username
 * No authentication required
 * Returns 404 if user not found or inactive
 */
publicUsersRouter.get('/:username', async (c) => {
  const username = c.req.param('username')

  // Validate username parameter
  if (!username || username.trim().length === 0) {
    throw Errors.badRequest('Username is required')
  }

  if (username.length > 50) {
    throw Errors.badRequest('Username must be 50 characters or less')
  }

  try {
    // Fetch public user profile
    const profile = await getPublicUserProfile(c.env.DB, username)

    // Return 404 if user not found
    if (!profile) {
      throw Errors.notFound(`User '${username}' not found`)
    }

    // Return public profile with cache headers (optional 1 hour cache)
    return c.json(
      {
        data: profile,
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      200
    )
  } catch (error) {
    // Re-throw ApiError instances
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    // Convert database errors to generic error
    console.error('[GET /api/users/:username] Error:', error)
    throw Errors.internal('Failed to fetch user profile')
  }
})

export { publicUsersRouter }
```

**Explanation:**
- Route parameter `:username` captures the username from URL
- Validates username is provided and reasonable length
- Calls database helper to fetch public profile
- Returns 404 if user not found or inactive
- Returns 200 with public profile data
- Converts any database errors to generic error

---

### Step 3: Register Public Users Router in Main API

Update the main API app to include the public users router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add this import at the top:

```typescript
import { publicUsersRouter } from '../../routes/public/users'
```

Add this route registration after the health check endpoint:

```typescript
// Public API routes (no authentication required)
app.route('/users', publicUsersRouter)
```

The updated section should look like:

```typescript
// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Public API routes (no authentication required)
app.route('/users', publicUsersRouter)

// Global error handler (must be last)
app.onError(apiErrorHandler)
```

**Explanation:**
- Imports the public users router
- Registers it at `/users` so requests to `/api/users/:username` are handled
- Public routes are registered before error handler
- No auth middleware applied to public routes

---

### Step 4: Create TypeScript Type Exports

Export the PublicUserProfile type for use in other modules.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/user.ts`

```typescript
/**
 * Public user profile visible to all users
 */
export interface PublicUserProfile {
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  website: string | null
  socials: {
    instagram: string | null
    twitter: string | null
    tiktok: string | null
    youtube: string | null
    bluesky: string | null
    threads: string | null
  }
  galleriesCount: number
  artworksCount: number
}

/**
 * API response envelope for user profile
 */
export interface PublicUserResponse {
  data: PublicUserProfile
  meta?: {
    timestamp?: string
  }
}
```

**Explanation:**
- Centralized type definitions for public user profile
- Can be imported in frontend components and other API handlers
- Ensures consistency across codebase

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/public/users.ts`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/user.ts`

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register public users router

---

## Verification

### Test 1: Verify Endpoint with Valid User

First, ensure a test user exists in the database with an active status.

Then test the endpoint:

```bash
curl http://localhost:8788/api/users/testuser
```

Expected response (200):
```json
{
  "data": {
    "username": "testuser",
    "displayName": "Test User",
    "avatarUrl": "https://example.com/avatar.jpg",
    "bio": "Artist and photographer",
    "website": "https://example.com",
    "socials": {
      "instagram": "testuser",
      "twitter": "testuser",
      "tiktok": null,
      "youtube": null,
      "bluesky": null,
      "threads": null
    },
    "galleriesCount": 3,
    "artworksCount": 12
  },
  "meta": {
    "timestamp": "2026-01-19T12:00:00.000Z"
  }
}
```

---

### Test 2: Verify 404 for Non-Existent User

```bash
curl http://localhost:8788/api/users/nonexistentuser
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User 'nonexistentuser' not found"
  }
}
```

---

### Test 3: Verify Inactive User Returns 404

Set a user's status to 'inactive' in the database, then test:

```bash
curl http://localhost:8788/api/users/inactiveuser
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User 'inactiveuser' not found"
  }
}
```

---

### Test 4: Verify No Private Data Exposed

Test that response does NOT include:
- email
- phone
- subscription limits
- private flags
- password hashes
- internal IDs (only username)

Verify in the response JSON that only public fields are present.

---

### Test 5: Verify Gallery and Artwork Counts

Create multiple galleries and artworks for a test user, then verify counts:

```bash
curl http://localhost:8788/api/users/testuser | jq '.data | {galleriesCount, artworksCount}'
```

Expected: Counts match actual database records.

---

### Test 6: Verify Public Access (No Auth Required)

Make request without any auth headers:

```bash
curl http://localhost:8788/api/users/testuser
```

Expected: Returns 200 without requiring Authorization header.

---

## Summary

This build creates the public user profile endpoint:
- Fetches public profile data by username
- Excludes all private and sensitive information
- Returns 404 for non-existent or inactive users
- Counts galleries and artworks for display
- No authentication required
- Foundation for public artist profiles and gallery pages

All public profile data can be cached for 1 hour to improve performance.

---

**Next step:** Proceed to **77-API-PUBLIC-USER-GALLERIES.md** to create the endpoint for fetching a user's public galleries list.
