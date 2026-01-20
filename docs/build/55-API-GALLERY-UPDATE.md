# 55-API-GALLERY-UPDATE.md

## Goal

Create the `PATCH /api/galleries/:id` endpoint to allow authenticated users to update gallery properties (name, description, welcome message, theme, and status) with slug regeneration and ownership verification.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery CRUD Operations:

- **Endpoint:** `PATCH /api/galleries/:id`
- **Authentication:** Required (JWT token)
- **Request Body (all fields optional):**
  ```json
  {
    "name": "Updated Gallery Name",
    "description": "Updated description",
    "welcomeMessage": "Welcome to my updated gallery!",
    "themeId": "theme_abc123",
    "status": "active"
  }
  ```

- **Response (200 OK):**
  ```json
  {
    "data": {
      "id": "gal_abc123def456",
      "userId": "user_xyz789",
      "slug": "updated-gallery-name",
      "name": "Updated Gallery Name",
      "description": "Updated description",
      "welcomeMessage": "Welcome to my updated gallery!",
      "themeId": "theme_abc123",
      "isDefault": false,
      "status": "active",
      "createdAt": "2026-01-15T12:00:00Z",
      "updatedAt": "2026-01-18T14:30:00Z"
    }
  }
  ```

- **Constraints:**
  - User must own the gallery (userId matches JWT user_id)
  - Cannot modify `is_default` flag (system-managed)
  - If name changes, regenerate slug (must be unique per user)
  - Status can be 'active' or 'hidden'
  - Theme must exist if provided

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono router and error handling setup
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **54-API-GALLERY-GET.md** - Gallery retrieval logic (reuse patterns)
- **08-SCHEMA-GALLERIES.md** - Galleries table schema

---

## Steps

### Step 1: Add Update Handler to Slug Utility

Ensure slug generation utility from 52-API-GALLERY-CREATE.md is available.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/slug.ts`

If this file doesn't exist, refer to 52-API-GALLERY-CREATE.md for the implementation. The key function needed:

```typescript
export async function generateUniqueSlug(
  db: any,
  userId: string,
  baseSlug: string
): Promise<string>
```

---

### Step 2: Create Gallery Update Service

Create or update the gallery service module with update logic.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/gallery.ts`

```typescript
import { nanoid } from 'nanoid'
import type { D1Database } from '@cloudflare/workers-types'
import { Errors } from '../errors'
import { generateSlug, generateUniqueSlug } from '../utils/slug'

export interface GalleryUpdateInput {
  name?: string
  description?: string
  welcomeMessage?: string
  themeId?: string | null
  status?: 'active' | 'hidden'
}

export interface Gallery {
  id: string
  userId: string
  slug: string
  name: string
  description?: string
  welcomeMessage?: string
  themeId?: string
  isDefault: boolean
  status: 'active' | 'hidden'
  createdAt: string
  updatedAt: string
}

/**
 * Update gallery by ID
 * Verifies ownership, regenerates slug if name changes
 * Cannot update is_default (system-managed)
 */
export async function updateGallery(
  db: D1Database,
  galleryId: string,
  userId: string,
  input: GalleryUpdateInput
): Promise<Gallery> {
  // Step 1: Fetch current gallery to verify ownership
  const current = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<Gallery>()

  if (!current) {
    throw Errors.NotFound('Gallery not found')
  }

  if (current.userId !== userId) {
    throw Errors.Forbidden('You do not have permission to update this gallery')
  }

  // Step 2: Determine new slug if name changed
  let newSlug = current.slug
  if (input.name && input.name.trim() !== current.name.trim()) {
    const baseSlug = generateSlug(input.name)
    newSlug = await generateUniqueSlug(db, userId, baseSlug)
  }

  // Step 3: Validate theme exists (if provided)
  if (input.themeId !== undefined && input.themeId !== null) {
    const theme = await db
      .prepare('SELECT id FROM themes WHERE id = ?')
      .bind(input.themeId)
      .first()

    if (!theme) {
      throw new Error('Theme not found')
    }
  }

  // Step 4: Build update object (only include provided fields)
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  if (input.name !== undefined) {
    updateData.name = input.name.trim()
    updateData.slug = newSlug
  }

  if (input.description !== undefined) {
    updateData.description = input.description?.trim() || null
  }

  if (input.welcomeMessage !== undefined) {
    updateData.welcome_message = input.welcomeMessage?.trim() || null
  }

  if (input.themeId !== undefined) {
    updateData.theme_id = input.themeId
  }

  if (input.status !== undefined) {
    if (!['active', 'hidden'].includes(input.status)) {
      throw new Error('Invalid status. Must be "active" or "hidden"')
    }
    updateData.status = input.status
  }

  // Step 5: Build SQL update statement
  const updateFields = Object.keys(updateData)
  const placeholders = updateFields.map(() => '?').join(', ')
  const setClause = updateFields.map((field) => `${field} = ?`).join(', ')
  const values = Object.values(updateData)

  const sql = `
    UPDATE galleries
    SET ${setClause}
    WHERE id = ?
  `

  await db
    .prepare(sql)
    .bind(...values, galleryId)
    .run()

  // Step 6: Fetch and return updated gallery
  const updated = await db
    .prepare('SELECT * FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<Gallery>()

  if (!updated) {
    throw Errors.InternalServerError('Failed to retrieve updated gallery')
  }

  return updated
}
```

---

### Step 3: Create API Route Handler

Add the PATCH handler to the galleries API router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/galleries.ts`

Find the galleries router file and add this handler:

```typescript
import { Hono } from 'hono'
import { getAuth } from '../middleware/auth'
import { updateGallery, GalleryUpdateInput } from '../../lib/api/services/gallery'
import type { D1Database } from '@cloudflare/workers-types'

// Assuming router exists, add to it:

/**
 * PATCH /api/galleries/:id
 * Update a gallery
 *
 * Request body (all fields optional):
 * {
 *   "name": "New Name",
 *   "description": "New description",
 *   "welcomeMessage": "Welcome message",
 *   "themeId": "theme_123",
 *   "status": "active"
 * }
 *
 * Returns: 200 OK with updated gallery object
 * Errors:
 * - 400: Invalid input
 * - 401: Unauthorized
 * - 403: Forbidden (not the gallery owner)
 * - 404: Gallery not found
 * - 500: Server error
 */
router.patch('/galleries/:id', async (c) => {
  try {
    const db = c.env.DB as D1Database
    const galleryId = c.req.param('id')

    // Get authenticated user
    const auth = getAuth(c)
    if (!auth) {
      return c.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await c.req.json()

    // Validate input
    const input: GalleryUpdateInput = {}

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return c.json(
          { error: 'Invalid name. Must be a non-empty string' },
          { status: 400 }
        )
      }
      if (body.name.length > 100) {
        return c.json(
          { error: 'Name must be 100 characters or less' },
          { status: 400 }
        )
      }
      input.name = body.name.trim()
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string') {
        return c.json(
          { error: 'Invalid description. Must be a string' },
          { status: 400 }
        )
      }
      if (body.description.length > 2000) {
        return c.json(
          { error: 'Description must be 2000 characters or less' },
          { status: 400 }
        )
      }
      input.description = body.description
    }

    if (body.welcomeMessage !== undefined) {
      if (typeof body.welcomeMessage !== 'string') {
        return c.json(
          { error: 'Invalid welcomeMessage. Must be a string' },
          { status: 400 }
        )
      }
      if (body.welcomeMessage.length > 500) {
        return c.json(
          { error: 'Welcome message must be 500 characters or less' },
          { status: 400 }
        )
      }
      input.welcomeMessage = body.welcomeMessage
    }

    if (body.themeId !== undefined) {
      if (body.themeId !== null && typeof body.themeId !== 'string') {
        return c.json(
          { error: 'Invalid themeId. Must be a string or null' },
          { status: 400 }
        )
      }
      input.themeId = body.themeId
    }

    if (body.status !== undefined) {
      if (!['active', 'hidden'].includes(body.status)) {
        return c.json(
          { error: 'Invalid status. Must be "active" or "hidden"' },
          { status: 400 }
        )
      }
      input.status = body.status
    }

    // Check for attempts to update protected fields
    if (body.hasOwnProperty('isDefault') || body.hasOwnProperty('is_default')) {
      return c.json(
        { error: 'Cannot update is_default. This is system-managed' },
        { status: 400 }
      )
    }

    if (Object.keys(input).length === 0) {
      return c.json(
        { error: 'At least one field must be provided for update' },
        { status: 400 }
      )
    }

    // Update gallery
    const updated = await updateGallery(
      db,
      galleryId,
      auth.userId,
      input
    )

    // Format response
    const response = {
      id: updated.id,
      userId: updated.userId,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      welcomeMessage: updated.welcomeMessage,
      themeId: updated.themeId,
      isDefault: updated.isDefault,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    }

    return c.json({ data: response }, { status: 200 })
  } catch (error) {
    console.error('Gallery update error:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json(
          { error: 'Gallery not found' },
          { status: 404 }
        )
      }
      if (error.message.includes('not have permission')) {
        return c.json(
          { error: 'Forbidden' },
          { status: 403 }
        )
      }
    }

    return c.json(
      { error: 'Failed to update gallery' },
      { status: 500 }
    )
  }
})

export default router
```

---

### Step 4: Add Type Definitions

Ensure TypeScript types are available for the API response.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/types/gallery.ts`

```typescript
/**
 * Gallery type matching API response structure
 */
export interface Gallery {
  id: string
  userId: string
  slug: string
  name: string
  description?: string
  welcomeMessage?: string
  themeId?: string | null
  isDefault: boolean
  status: 'active' | 'hidden'
  createdAt: string
  updatedAt: string
}

/**
 * Request body for updating a gallery
 */
export interface GalleryUpdateRequest {
  name?: string
  description?: string
  welcomeMessage?: string
  themeId?: string | null
  status?: 'active' | 'hidden'
}
```

---

### Step 5: Create React Hook for Update

Create a custom hook to handle gallery updates in the UI.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useUpdateGallery.ts`

```typescript
import { useState } from 'react'
import { Gallery, GalleryUpdateRequest } from '../types/gallery'

interface UseUpdateGalleryResult {
  updating: boolean
  error: string | null
  updateGallery: (
    galleryId: string,
    updates: GalleryUpdateRequest
  ) => Promise<Gallery | null>
}

/**
 * Custom hook for updating a gallery
 * Handles API calls and error state
 */
export function useUpdateGallery(): UseUpdateGalleryResult {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateGallery = async (
    galleryId: string,
    updates: GalleryUpdateRequest
  ): Promise<Gallery | null> => {
    try {
      setUpdating(true)
      setError(null)

      const response = await fetch(`/api/galleries/${galleryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update gallery')
      }

      const data = await response.json()
      return data.data as Gallery
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update gallery'
      setError(message)
      return null
    } finally {
      setUpdating(false)
    }
  }

  return { updating, error, updateGallery }
}
```

---

## Files to Create/Modify

1. **Verify/Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/gallery.ts`
   - Add `updateGallery` function

2. **Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/api/routes/galleries.ts`
   - Add PATCH `/api/galleries/:id` handler

3. **Create/Update:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/types/gallery.ts`
   - Add Gallery and GalleryUpdateRequest types

4. **Create:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/hooks/useUpdateGallery.ts`
   - Add custom React hook for updates

---

## Testing Checklist

### API Testing

1. **Valid Update:**
   ```bash
   curl -X PATCH http://localhost:8787/api/galleries/gal_123 \
     -H "Content-Type: application/json" \
     -H "Cookie: auth=token" \
     -d '{"name": "New Name", "description": "New desc"}'
   ```
   - Response: 200 OK with updated gallery

2. **Partial Update:**
   - Update only name, leave description unchanged
   - Verify other fields preserved

3. **Name Change Regenerates Slug:**
   - Update name from "Old Name" to "New Name"
   - Verify slug changes to "new-name"
   - Verify slug is unique per user

4. **Status Toggle:**
   - Update status from 'active' to 'hidden'
   - Verify gallery no longer visible in listings

5. **Theme Update:**
   - Update themeId to valid theme ID
   - Verify theme is applied to gallery
   - Try invalid theme ID, expect 400 error

6. **Authorization:**
   - Try to update gallery owned by another user
   - Expect 403 Forbidden

7. **Not Found:**
   - Try to update non-existent gallery
   - Expect 404 Not Found

8. **Invalid Input:**
   - Send name with >100 characters, expect 400
   - Send invalid status value, expect 400
   - Send empty request body, expect 400

9. **Protected Fields:**
   - Try to update `isDefault` or `is_default`
   - Expect 400 error

### UI/Integration Testing

1. **Form Submission:**
   - User edits gallery name and description
   - Clicks "Save"
   - Toast shows success
   - Page reflects updated values

2. **Slug Generation:**
   - User changes gallery name to something new
   - Gallery URL updates to reflect new slug
   - Old URL is no longer valid

3. **Concurrent Updates:**
   - Two tabs update same gallery simultaneously
   - Last update wins
   - Both users see updated values after refresh

---

## Verification

1. **Endpoint Works:**
   - Authenticated user can update their gallery
   - All fields update correctly
   - Response includes updated_at timestamp

2. **Slug Management:**
   - Name changes regenerate slug
   - Slug remains unique per user
   - Slug is URL-safe (lowercase, hyphens only)

3. **Ownership Verified:**
   - User cannot update galleries they don't own
   - Non-authenticated users get 401

4. **Protected Fields:**
   - `is_default` flag cannot be modified
   - `id`, `userId`, `createdAt` remain unchanged

5. **Data Validation:**
   - Empty values are rejected
   - String length limits enforced
   - Status must be valid enum value
   - Theme ID must exist
