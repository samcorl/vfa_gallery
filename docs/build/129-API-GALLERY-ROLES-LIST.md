# 129-API-GALLERY-ROLES-LIST.md

## Goal

Create the `GET /api/galleries/:id/roles` endpoint to retrieve a list of users assigned to roles within a gallery. Only the gallery owner can view roles, and the response includes both creator and admin roles.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery Roles Management:

- **Endpoint:** `GET /api/galleries/:id/roles`
- **Authentication:** Required (JWT token)
- **Authorization:** Only gallery owner (user who created the gallery)
- **Response (200 OK):**
  ```json
  {
    "data": [
      {
        "userId": "user_abc123",
        "username": "artist-name",
        "displayName": "Artist Name",
        "avatarUrl": "https://...",
        "role": "creator",
        "grantedAt": "2026-01-18T12:00:00Z",
        "grantedBy": null
      },
      {
        "userId": "user_xyz789",
        "username": "admin-name",
        "displayName": "Admin Name",
        "avatarUrl": "https://...",
        "role": "admin",
        "grantedAt": "2026-01-19T10:30:00Z",
        "grantedBy": "user_abc123"
      }
    ]
  }
  ```
- **HTTP Status Codes:**
  - `200` - Success
  - `401` - Unauthorized (not authenticated)
  - `403` - Forbidden (not gallery owner)
  - `404` - Gallery not found

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **08-SCHEMA-GALLERIES.md** - Galleries table created
- **06-SCHEMA-USERS.md** - Users table created
- **Database migration for gallery_roles table** - From 02-DATA-MODELS.md schema

---

## Steps

### Step 1: Create Types for Gallery Roles

Define TypeScript types for role-related API responses.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/galleryRole.ts`

```typescript
/**
 * Gallery role type for API responses
 */
export interface GalleryRole {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: 'creator' | 'admin'
  grantedAt: string
  grantedBy: string | null
}

/**
 * Database row type (snake_case from SQLite)
 */
export interface GalleryRoleRow {
  gallery_id: string
  user_id: string
  role: string
  granted_at: string
  granted_by: string | null
}

/**
 * User data needed for role response
 */
export interface UserForRole {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

/**
 * Transform database row with user info to API response
 */
export function galleryRoleRowToApi(
  roleRow: GalleryRoleRow,
  userInfo: UserForRole
): GalleryRole {
  return {
    userId: roleRow.user_id,
    username: userInfo.username,
    displayName: userInfo.display_name,
    avatarUrl: userInfo.avatar_url,
    role: roleRow.role as 'creator' | 'admin',
    grantedAt: roleRow.granted_at,
    grantedBy: roleRow.granted_by,
  }
}
```

**Explanation:**
- `GalleryRole` is the API response format (camelCase)
- `GalleryRoleRow` matches SQLite schema (snake_case)
- Includes user information needed for the response
- Transform function converts database rows to API responses

---

### Step 2: Add Gallery Roles Route to Galleries Router

Add the GET roles endpoint to the galleries routes file.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts`

Find the existing galleries router and add this route:

```typescript
import type { GalleryRole, GalleryRoleRow, UserForRole } from '../../../types/galleryRole'
import { galleryRoleRowToApi } from '../../../types/galleryRole'

/**
 * GET /galleries/:id/roles
 * List all users with roles in a gallery
 * Only gallery owner can access
 */
galleriesRouter.get('/:id/roles', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const { id: galleryId } = c.req.param()
  const db = c.env.DB

  // Validate gallery ID
  if (!galleryId) {
    throw Errors.badRequest('Gallery ID is required')
  }

  // Verify gallery exists and user is owner
  const gallery = await db
    .prepare('SELECT id, user_id FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<{ id: string; user_id: string }>()

  if (!gallery) {
    throw Errors.notFound('Gallery not found')
  }

  // Check ownership - only gallery creator can view roles
  if (gallery.user_id !== userId) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Only the gallery owner can view roles'
    )
  }

  // Fetch all roles for this gallery with user data
  const roles = await db
    .prepare(
      `SELECT
        gr.gallery_id,
        gr.user_id,
        gr.role,
        gr.granted_at,
        gr.granted_by,
        u.username,
        u.display_name,
        u.avatar_url
      FROM gallery_roles gr
      JOIN users u ON gr.user_id = u.id
      WHERE gr.gallery_id = ?
      ORDER BY gr.granted_at DESC`
    )
    .bind(galleryId)
    .all<
      GalleryRoleRow & {
        username: string
        display_name: string | null
        avatar_url: string | null
      }
    >()

  if (!roles || !Array.isArray(roles)) {
    return c.json({ data: [] })
  }

  // Transform rows to API format
  const transformedRoles: GalleryRole[] = roles.map((row) => {
    const userInfo: UserForRole = {
      id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    }
    return galleryRoleRowToApi(row, userInfo)
  })

  return c.json({ data: transformedRoles })
})
```

**Explanation:**
- Requires authentication via `requireAuth` middleware
- Verifies gallery exists and user is the owner
- Returns 403 if user is not the gallery owner
- Joins gallery_roles with users table to include user info
- Orders results by most recent role grants first
- Transforms database rows to API response format
- Returns empty array if no roles exist (never fails)

---

### Step 3: Verify Database Schema

Ensure the `gallery_roles` table exists with the correct schema. If it doesn't exist, create it:

**SQL Migration:** `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/gallery_roles.sql`

```sql
-- Create gallery_roles table for role-based access control
CREATE TABLE IF NOT EXISTS gallery_roles (
  gallery_id TEXT REFERENCES galleries(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                     -- creator, admin
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT REFERENCES users(id),
  PRIMARY KEY (gallery_id, user_id)
);

-- Create index for faster lookups by gallery
CREATE INDEX IF NOT EXISTS idx_gallery_roles_gallery
  ON gallery_roles(gallery_id);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_gallery_roles_user
  ON gallery_roles(user_id);
```

Run the migration:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
wrangler d1 execute site --file ./migrations/gallery_roles.sql
```

---

### Step 4: Add Bootstrap Data (Creator Role)

When a gallery is created, automatically add a creator role entry. Update the gallery creation handler:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts`

Modify the POST /galleries route to add creator role:

```typescript
// After successful gallery insertion, add creator role
const now = new Date().toISOString()

try {
  await db
    .prepare(
      `INSERT INTO gallery_roles (gallery_id, user_id, role, granted_at, granted_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(galleryId, userId, 'creator', now, null) // No granted_by for creators
    .run()
} catch (err: any) {
  console.error('[Gallery Roles Bootstrap Error]', err)
  // Don't fail gallery creation if role insertion fails, but log it
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/galleryRole.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/migrations/gallery_roles.sql`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts` - Add GET :id/roles route and creator role bootstrap
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - No changes needed (galleries router already mounted)

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Run Database Migration

```bash
wrangler d1 execute site --file ./migrations/gallery_roles.sql
```

Expected: Migration completes without errors

---

### Test 3: Verify Table Structure

```bash
wrangler d1 execute site --command="PRAGMA table_info(gallery_roles);"
```

Expected output shows columns:
- gallery_id (TEXT)
- user_id (TEXT)
- role (TEXT)
- granted_at (TIMESTAMP)
- granted_by (TEXT)

---

### Test 4: Get Roles Without Authentication

Start dev server:

```bash
npx wrangler pages dev
```

In another terminal, create a gallery first and get its ID, then:

```bash
curl http://localhost:8788/api/galleries/{galleryId}/roles
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

### Test 5: Get Roles as Non-Owner

1. Create a gallery with User A
2. Log in as User B and get a token
3. Try to access User A's gallery roles:

```bash
curl -H "Authorization: Bearer {User_B_Token}" \
  http://localhost:8788/api/galleries/{User_A_Gallery_ID}/roles
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only the gallery owner can view roles"
  }
}
```

---

### Test 6: Get Roles as Owner (Empty)

Create a new gallery and immediately fetch its roles:

```bash
curl -H "Authorization: Bearer {YOUR_JWT_TOKEN}" \
  http://localhost:8788/api/galleries/{GALLERY_ID}/roles
```

Expected response (200):
```json
{
  "data": [
    {
      "userId": "user_abc123",
      "username": "your-username",
      "displayName": "Your Display Name",
      "avatarUrl": "https://...",
      "role": "creator",
      "grantedAt": "2026-01-18T12:00:00Z",
      "grantedBy": null
    }
  ]
}
```

---

### Test 7: Database Verification

Verify creator role was created in database:

```bash
wrangler d1 execute site \
  --command="SELECT * FROM gallery_roles WHERE gallery_id = '{GALLERY_ID}';"
```

Expected: Shows one row with role='creator', granted_by=null

---

### Test 8: Gallery Not Found

```bash
curl -H "Authorization: Bearer {YOUR_JWT_TOKEN}" \
  http://localhost:8788/api/galleries/invalid-id/roles
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Gallery not found"
  }
}
```

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] Database migration runs successfully
- [ ] gallery_roles table created with correct schema
- [ ] GET /api/galleries/:id/roles requires authentication (401 without token)
- [ ] Only gallery owner can view roles (403 for non-owners)
- [ ] Returns 404 for non-existent galleries
- [ ] Creator role automatically added when gallery is created
- [ ] API returns correct response format with user info
- [ ] API returns empty array for galleries with no additional roles
- [ ] Database indexes created for performance

---

## Next Steps

Once this build is verified, proceed to **130-API-GALLERY-ROLES-ADD.md** to add the ability for creators to assign admin roles.
