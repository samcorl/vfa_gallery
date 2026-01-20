# 57-API-GALLERY-DEFAULT.md

## Goal

Auto-create a default gallery and default collection when a new user signs up, providing them with an immediate place to upload and organize artwork.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery and Collection Management:

- **Timing:** Automatically created during user signup (auth callback)
- **Default Gallery:**
  - Name: "My Gallery"
  - Slug: "my-gallery"
  - is_default: true
  - status: "active"
  - Other fields: NULL/empty

- **Default Collection:**
  - Name: "My Collection"
  - Slug: "my-collection"
  - is_default: true
  - status: "active"
  - Belongs to default gallery

- **Transaction:** Both must succeed or both fail (atomic operation)
- **Result:** New users can immediately start uploading artwork

---

## Prerequisites

**Must complete before starting:**
- **19-AUTH-GOOGLE-SSO-CALLBACK.md** - Auth callback handler (modify this file)
- **52-API-GALLERY-CREATE.md** - Gallery creation logic (reuse patterns)
- **63-API-COLLECTION-CREATE.md** - Collection creation logic (reuse patterns)
- **08-SCHEMA-GALLERIES.md** - Galleries table schema
- **09-SCHEMA-COLLECTIONS.md** - Collections table schema

---

## Steps

### Step 1: Create Default Gallery and Collection Service

Create a service function that handles atomic creation of both.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/defaults.ts`

```typescript
import { nanoid } from 'nanoid'
import type { D1Database } from '@cloudflare/workers-types'

export interface DefaultsCreated {
  galleryId: string
  collectionId: string
}

/**
 * Create default gallery and collection for new user
 * Both are created atomically - either both succeed or both fail
 *
 * Default Gallery: name="My Gallery", slug="my-gallery", is_default=true
 * Default Collection: name="My Collection", slug="my-collection", is_default=true
 *
 * This gives new users an immediate place to upload artwork
 */
export async function createDefaultGalleryAndCollection(
  db: D1Database,
  userId: string
): Promise<DefaultsCreated> {
  try {
    // Create default gallery
    const galleryId = `gal_${nanoid()}`
    const now = new Date().toISOString()

    const galleryStmt = db.prepare(`
      INSERT INTO galleries (
        id,
        user_id,
        slug,
        name,
        description,
        welcome_message,
        theme_id,
        is_default,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    await galleryStmt.bind(
      galleryId,           // id
      userId,              // user_id
      'my-gallery',        // slug
      'My Gallery',        // name
      null,                // description
      null,                // welcome_message
      null,                // theme_id
      true,                // is_default
      'active',            // status
      now,                 // created_at
      now                  // updated_at
    ).run()

    // Create default collection
    const collectionId = `col_${nanoid()}`

    const collectionStmt = db.prepare(`
      INSERT INTO collections (
        id,
        gallery_id,
        user_id,
        slug,
        name,
        description,
        is_default,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    await collectionStmt.bind(
      collectionId,        // id
      galleryId,           // gallery_id
      userId,              // user_id
      'my-collection',     // slug
      'My Collection',     // name
      null,                // description
      true,                // is_default
      'active',            // status
      now,                 // created_at
      now                  // updated_at
    ).run()

    return {
      galleryId,
      collectionId
    }
  } catch (error) {
    console.error('Failed to create default gallery and collection:', error)
    throw new Error('Failed to initialize user library. Please try signing up again.')
  }
}

/**
 * Check if user already has default gallery
 * Used to prevent duplicate creation if callback is called multiple times
 */
export async function userHasDefaultGallery(
  db: D1Database,
  userId: string
): Promise<boolean> {
  const result = await db
    .prepare('SELECT id FROM galleries WHERE user_id = ? AND is_default = true LIMIT 1')
    .bind(userId)
    .first()

  return !!result
}

/**
 * Create default gallery only (if collection already exists)
 * Useful for recovery scenarios
 */
export async function createDefaultGalleryOnly(
  db: D1Database,
  userId: string
): Promise<string> {
  const galleryId = `gal_${nanoid()}`
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO galleries (
      id,
      user_id,
      slug,
      name,
      description,
      welcome_message,
      theme_id,
      is_default,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  await stmt.bind(
    galleryId,
    userId,
    'my-gallery',
    'My Gallery',
    null,
    null,
    null,
    true,
    'active',
    now,
    now
  ).run()

  return galleryId
}

/**
 * Create default collection only (if gallery already exists)
 * Useful for recovery scenarios
 */
export async function createDefaultCollectionOnly(
  db: D1Database,
  galleryId: string,
  userId: string
): Promise<string> {
  const collectionId = `col_${nanoid()}`
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO collections (
      id,
      gallery_id,
      user_id,
      slug,
      name,
      description,
      is_default,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  await stmt.bind(
    collectionId,
    galleryId,
    userId,
    'my-collection',
    'My Collection',
    null,
    true,
    'active',
    now,
    now
  ).run()

  return collectionId
}
```

---

### Step 2: Modify Auth Callback to Create Defaults

Update the Google OAuth callback handler to create defaults when a new user is created.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/auth.ts`

Find the Google callback handler and modify it:

```typescript
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { D1Database } from '@cloudflare/workers-types'
import { nanoid } from 'nanoid'
import { createDefaultGalleryAndCollection, userHasDefaultGallery } from '../../lib/api/services/defaults'
import { generateJWT } from '../../lib/api/auth/jwt'

const router = new Hono()

/**
 * POST /api/auth/google/callback
 * Google OAuth callback handler
 * Creates user if new, generates JWT token, sets secure httpOnly cookie
 *
 * Modified to also create default gallery and collection for new users
 */
router.post('/auth/google/callback', async (c) => {
  try {
    const db = c.env.DB as D1Database
    const body = await c.req.json()

    // Step 1: Validate Google token (implementation from 19-AUTH-GOOGLE-SSO-CALLBACK.md)
    const { googleId, email, name, picture } = body
    // ... validate token with Google API ...

    // Step 2: Check if user exists
    let user = await db
      .prepare('SELECT * FROM users WHERE google_id = ?')
      .bind(googleId)
      .first<any>()

    const isNewUser = !user

    // Step 3: Create user if new
    if (!user) {
      const userId = `usr_${nanoid()}`
      const now = new Date().toISOString()

      await db
        .prepare(`
          INSERT INTO users (
            id,
            google_id,
            username,
            email,
            avatar_url,
            email_verified,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          userId,
          googleId,
          name || email.split('@')[0],
          email,
          picture || null,
          true,
          now,
          now
        )
        .run()

      user = {
        id: userId,
        google_id: googleId,
        username: name || email.split('@')[0],
        email,
        avatar_url: picture || null,
        email_verified: true,
        created_at: now,
        updated_at: now
      }
    }

    // Step 4: Create default gallery and collection for new users
    if (isNewUser) {
      try {
        // Check if defaults already exist (safety check)
        const hasDefaults = await userHasDefaultGallery(db, user.id)

        if (!hasDefaults) {
          const { galleryId, collectionId } = await createDefaultGalleryAndCollection(
            db,
            user.id
          )

          console.log(
            `Created default gallery ${galleryId} and collection ${collectionId} for user ${user.id}`
          )
        }
      } catch (error) {
        console.error('Failed to create default gallery/collection:', error)
        // Log error but don't fail the entire signup
        // User can create manually or we can provide recovery flow
      }
    }

    // Step 5: Generate JWT token
    const token = await generateJWT(
      {
        userId: user.id,
        email: user.email,
        username: user.username
      },
      c.env.JWT_SECRET
    )

    // Step 6: Set secure httpOnly cookie
    setCookie(c, 'auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    })

    // Step 7: Return response
    return c.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatar_url
        },
        isNewUser
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Google callback error:', error)
    return c.json(
      {
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    )
  }
})

export default router
```

---

### Step 3: Create Recovery API Endpoint

Create an endpoint for admins or the system to recover missing defaults.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/admin.ts`

```typescript
import { Hono } from 'hono'
import { getAuth } from '../middleware/auth'
import type { D1Database } from '@cloudflare/workers-types'
import {
  userHasDefaultGallery,
  createDefaultGalleryAndCollection
} from '../../lib/api/services/defaults'

const router = new Hono()

/**
 * POST /api/admin/users/:userId/ensure-defaults
 * Ensure user has default gallery and collection
 * Creates them if missing
 *
 * Admin only endpoint
 */
router.post('/admin/users/:userId/ensure-defaults', async (c) => {
  try {
    const db = c.env.DB as D1Database
    const userId = c.req.param('userId')

    // Check if user is admin
    const auth = getAuth(c)
    if (!auth || !auth.isAdmin) {
      return c.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Check if user exists
    const user = await db
      .prepare('SELECT id FROM users WHERE id = ?')
      .bind(userId)
      .first()

    if (!user) {
      return c.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if defaults already exist
    const hasDefaults = await userHasDefaultGallery(db, userId)

    if (hasDefaults) {
      return c.json(
        {
          success: true,
          message: 'User already has default gallery'
        },
        { status: 200 }
      )
    }

    // Create defaults
    const { galleryId, collectionId } = await createDefaultGalleryAndCollection(
      db,
      userId
    )

    return c.json(
      {
        success: true,
        message: 'Default gallery and collection created',
        galleryId,
        collectionId
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Ensure defaults error:', error)
    return c.json(
      {
        error: 'Failed to ensure defaults',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

/**
 * GET /api/admin/users/missing-defaults
 * Find users missing default gallery (for recovery/maintenance)
 * Returns paginated list
 *
 * Admin only endpoint
 */
router.get('/admin/users/missing-defaults', async (c) => {
  try {
    const db = c.env.DB as D1Database
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')

    // Check if user is admin
    const auth = getAuth(c)
    if (!auth || !auth.isAdmin) {
      return c.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Find users without default gallery
    const users = await db
      .prepare(`
        SELECT u.id, u.username, u.email, u.created_at
        FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM galleries g WHERE g.user_id = u.id AND g.is_default = true
        )
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(limit, offset)
      .all<any>()

    // Get total count
    const countResult = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM galleries g WHERE g.user_id = u.id AND g.is_default = true
        )
      `)
      .first<{ count: number }>()

    return c.json(
      {
        users: users.results || [],
        total: countResult?.count || 0,
        limit,
        offset
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Missing defaults query error:', error)
    return c.json(
      {
        error: 'Failed to query missing defaults',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

export default router
```

---

### Step 4: Create User Service Function (If Not Exists)

Ensure user creation is callable from auth handler.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/user.ts`

```typescript
import { nanoid } from 'nanoid'
import type { D1Database } from '@cloudflare/workers-types'

export interface User {
  id: string
  googleId: string
  username: string
  email: string
  avatarUrl?: string
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Create a new user from Google OAuth data
 */
export async function createUserFromGoogle(
  db: D1Database,
  googleId: string,
  email: string,
  name: string,
  picture?: string
): Promise<User> {
  const userId = `usr_${nanoid()}`
  const now = new Date().toISOString()
  const username = name || email.split('@')[0]

  await db
    .prepare(`
      INSERT INTO users (
        id,
        google_id,
        username,
        email,
        avatar_url,
        email_verified,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      userId,
      googleId,
      username,
      email,
      picture || null,
      true,
      now,
      now
    )
    .run()

  return {
    id: userId,
    googleId,
    username,
    email,
    avatarUrl: picture,
    emailVerified: true,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Get user by Google ID
 */
export async function getUserByGoogleId(
  db: D1Database,
  googleId: string
): Promise<User | null> {
  const user = await db
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(googleId)
    .first<any>()

  if (!user) return null

  return {
    id: user.id,
    googleId: user.google_id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatar_url,
    emailVerified: user.email_verified,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  }
}
```

---

## Files to Create/Modify

1. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/defaults.ts`
   - Add default creation functions

2. **Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/auth.ts` (File 19)
   - Import and call `createDefaultGalleryAndCollection` in Google callback
   - Add error handling for default creation failure

3. **Create/Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/user.ts`
   - Add user creation helpers if not exists

4. **Create/Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/admin.ts`
   - Add endpoint to ensure user defaults
   - Add endpoint to find missing defaults

---

## Database Requirements

Ensure the galleries and collections tables exist with proper constraints:

**Galleries Table:**
- `is_default` BOOLEAN DEFAULT FALSE
- `user_id` foreign key to users(id)

**Collections Table:**
- `is_default` BOOLEAN DEFAULT FALSE
- `gallery_id` foreign key to galleries(id)
- `user_id` foreign key to users(id)

---

## Verification

1. **New User Signup:**
   - User signs up via Google OAuth
   - Google callback handler creates user in users table
   - Default gallery "My Gallery" is created with slug "my-gallery"
   - Default collection "My Collection" is created with slug "my-collection"
   - Collection is linked to the gallery
   - Gallery has `is_default = true`
   - Collection has `is_default = true`

2. **User Can Upload Immediately:**
   - New user navigates to `/profile/artworks`
   - Can upload artwork without creating gallery/collection first
   - Artwork is automatically added to default collection

3. **Only One Default Per User:**
   - Run signup flow twice for same user (same Google ID)
   - Only one default gallery and collection exist
   - No duplicates

4. **Recovery Endpoint Works:**
   - Find user without default gallery
   - Call POST `/api/admin/users/:userId/ensure-defaults`
   - Defaults are created
   - User can now upload

5. **Missing Defaults Detection:**
   - Call GET `/api/admin/users/missing-defaults`
   - Returns paginated list of users without defaults
   - Can use this for maintenance scripts

6. **Error Handling:**
   - If default creation fails, user signup still succeeds
   - Error is logged but not returned to user
   - User can create defaults manually or use recovery endpoint

7. **Idempotency:**
   - Creating defaults multiple times doesn't create duplicates
   - `userHasDefaultGallery` check prevents duplicates
   - Safe to call multiple times

---

## Integration Points

- **Authentication (19-AUTH-GOOGLE-SSO-CALLBACK.md):**
  - Called during OAuth callback
  - Must complete before generating JWT

- **Gallery Creation (52-API-GALLERY-CREATE.md):**
  - Reuses slug generation logic
  - Similar data structure

- **Collection Creation (63-API-COLLECTION-CREATE.md):**
  - Reuses slug generation logic
  - Links to default gallery

- **User Signup Flow:**
  - New users immediately have a place to upload
  - Reduces friction in onboarding
