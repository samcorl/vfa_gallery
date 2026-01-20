# 130-API-GALLERY-ROLES-ADD.md

## Goal

Create the `POST /api/galleries/:id/roles` endpoint to allow gallery creators to assign admin roles to other users. Only the creator of a gallery can add roles.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery Roles Management:

- **Endpoint:** `POST /api/galleries/:id/roles`
- **Authentication:** Required (JWT token)
- **Authorization:** Only gallery creator (user who created the gallery)
- **Request Body:**
  ```json
  {
    "userId": "user_xyz789",
    "role": "admin"
  }
  ```
  OR by username:
  ```json
  {
    "username": "artist-name",
    "role": "admin"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "data": {
      "userId": "user_xyz789",
      "username": "artist-name",
      "displayName": "Artist Name",
      "avatarUrl": "https://...",
      "role": "admin",
      "grantedAt": "2026-01-19T10:30:00Z",
      "grantedBy": "user_abc123"
    }
  }
  ```
- **HTTP Status Codes:**
  - `201` - Created
  - `400` - Invalid request (missing fields, invalid role)
  - `401` - Unauthorized
  - `403` - Forbidden (not creator)
  - `404` - Gallery or user not found
  - `409` - User already has a role in this gallery

---

## Prerequisites

**Must complete before starting:**
- **129-API-GALLERY-ROLES-LIST.md** - GET /api/galleries/:id/roles endpoint
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **08-SCHEMA-GALLERIES.md** - Galleries table created
- **06-SCHEMA-USERS.md** - Users table created
- **gallery_roles table** - Created in previous build

---

## Steps

### Step 1: Create Request/Response Types

Update the gallery role types file with request validation types.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/galleryRole.ts`

Add these types to the existing file:

```typescript
/**
 * Request body for adding a role to a gallery
 * Can specify user by ID or username
 */
export interface AddGalleryRoleRequest {
  userId?: string
  username?: string
  role: 'creator' | 'admin'
}

/**
 * Validate add role request
 */
export function validateAddRoleRequest(body: unknown): AddGalleryRoleRequest {
  const req = body as any

  // Must have userId or username
  if (!req.userId && !req.username) {
    throw new Error('Either userId or username is required')
  }

  // Must have role
  if (!req.role) {
    throw new Error('Role is required')
  }

  // Role must be valid
  if (!['creator', 'admin'].includes(req.role)) {
    throw new Error('Role must be "creator" or "admin"')
  }

  return {
    userId: req.userId,
    username: req.username,
    role: req.role as 'creator' | 'admin',
  }
}
```

---

### Step 2: Add POST Roles Route

Add the POST endpoint to the galleries router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts`

Add these imports at the top:

```typescript
import {
  GalleryRole,
  GalleryRoleRow,
  UserForRole,
  AddGalleryRoleRequest,
  validateAddRoleRequest,
  galleryRoleRowToApi,
} from '../../../types/galleryRole'
```

Add this route after the GET /:id/roles route:

```typescript
/**
 * POST /galleries/:id/roles
 * Add a role assignment to a gallery
 * Only gallery creator can add roles
 */
galleriesRouter.post('/:id/roles', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const { id: galleryId } = c.req.param()
  const db = c.env.DB

  // Validate gallery ID
  if (!galleryId) {
    throw Errors.badRequest('Gallery ID is required')
  }

  // Parse and validate request body
  let body: AddGalleryRoleRequest
  try {
    const json = await c.req.json()
    body = validateAddRoleRequest(json)
  } catch (err: any) {
    throw Errors.badRequest(err.message || 'Invalid request body')
  }

  // Verify gallery exists and user is creator
  const gallery = await db
    .prepare('SELECT id, user_id FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<{ id: string; user_id: string }>()

  if (!gallery) {
    throw Errors.notFound('Gallery not found')
  }

  // Only creator can add roles
  if (gallery.user_id !== userId) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Only the gallery creator can assign roles'
    )
  }

  // Resolve user to assign role to
  let targetUserId: string | null = null
  let targetUser: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null = null

  if (body.userId) {
    // Look up by user ID
    targetUser = await db
      .prepare('SELECT id, username, display_name, avatar_url FROM users WHERE id = ?')
      .bind(body.userId)
      .first()

    if (!targetUser) {
      throw Errors.notFound(`User with ID "${body.userId}" not found`)
    }

    targetUserId = targetUser.id
  } else if (body.username) {
    // Look up by username
    targetUser = await db
      .prepare('SELECT id, username, display_name, avatar_url FROM users WHERE username = ?')
      .bind(body.username)
      .first()

    if (!targetUser) {
      throw Errors.notFound(`User with username "${body.username}" not found`)
    }

    targetUserId = targetUser.id
  }

  if (!targetUserId || !targetUser) {
    throw Errors.badRequest('Could not resolve target user')
  }

  // Prevent assigning role to self
  if (targetUserId === userId) {
    throw Errors.badRequest('You cannot assign roles to yourself')
  }

  // Check if user already has a role in this gallery
  const existingRole = await db
    .prepare(
      'SELECT role FROM gallery_roles WHERE gallery_id = ? AND user_id = ?'
    )
    .bind(galleryId, targetUserId)
    .first<{ role: string }>()

  if (existingRole) {
    throw new ApiError(
      409,
      'ROLE_ALREADY_EXISTS',
      `User already has role "${existingRole.role}" in this gallery`
    )
  }

  // Insert role assignment
  const now = new Date().toISOString()

  try {
    await db
      .prepare(
        `INSERT INTO gallery_roles (gallery_id, user_id, role, granted_at, granted_by)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(galleryId, targetUserId, body.role, now, userId)
      .run()
  } catch (err: any) {
    console.error('[Add Gallery Role Error]', err)
    throw Errors.internal('Failed to add role', { originalError: err.message })
  }

  // Fetch and return the created role
  const createdRole = await db
    .prepare(
      `SELECT gr.gallery_id, gr.user_id, gr.role, gr.granted_at, gr.granted_by
       FROM gallery_roles gr
       WHERE gr.gallery_id = ? AND gr.user_id = ?`
    )
    .bind(galleryId, targetUserId)
    .first<GalleryRoleRow>()

  if (!createdRole) {
    throw Errors.internal('Failed to retrieve created role')
  }

  // Transform to API response
  const userInfo: UserForRole = {
    id: targetUser.id,
    username: targetUser.username,
    display_name: targetUser.display_name,
    avatar_url: targetUser.avatar_url,
  }

  const role = galleryRoleRowToApi(createdRole, userInfo)

  return c.json({ data: role }, 201)
})
```

**Explanation:**
- Requires authentication and creator role
- Accepts either `userId` or `username` for flexible user lookup
- Validates role value (only 'creator' or 'admin' allowed)
- Verifies target user exists
- Prevents self-assignment of roles
- Checks for existing role assignments (409 conflict)
- Records who granted the role via `granted_by` field
- Returns 201 Created with full role object

---

### Step 2b: Update API Errors Helper (if needed)

Ensure your error helper has these error types available. Update if missing:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/errors.ts`

Add if not present:

```typescript
export const Errors = {
  badRequest: (message: string) =>
    new ApiError(400, 'BAD_REQUEST', message),
  unauthorized: (message: string) =>
    new ApiError(401, 'UNAUTHORIZED', message),
  notFound: (message: string) =>
    new ApiError(404, 'NOT_FOUND', message),
  conflict: (message: string) =>
    new ApiError(409, 'CONFLICT', message),
  internal: (message: string, details?: any) =>
    new ApiError(500, 'INTERNAL_ERROR', message),
}
```

---

## Files to Create/Modify

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/galleryRole.ts` - Add request validation types
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts` - Add POST :id/roles route

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Add Role Without Authentication

```bash
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -d '{"username": "new-admin", "role": "admin"}'
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

### Test 3: Add Role as Non-Creator

1. Create a gallery with User A
2. Create another user (User B)
3. Log in as User B

```bash
curl -X POST http://localhost:8788/api/galleries/{User_A_Gallery}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_B_Token}" \
  -d '{"username": "some-user", "role": "admin"}'
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only the gallery creator can assign roles"
  }
}
```

---

### Test 4: Add Role by Username

Setup: Create 2 users, User A owns a gallery

```bash
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_A_Token}" \
  -d '{"username": "user-b", "role": "admin"}'
```

Expected response (201):
```json
{
  "data": {
    "userId": "user_xyz789",
    "username": "user-b",
    "displayName": "User B Name",
    "avatarUrl": "https://...",
    "role": "admin",
    "grantedAt": "2026-01-19T10:30:00Z",
    "grantedBy": "user_abc123"
  }
}
```

---

### Test 5: Add Role by User ID

```bash
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_A_Token}" \
  -d '{"userId": "user_xyz789", "role": "admin"}'
```

Expected response (201) with role assigned to specified user

---

### Test 6: Validation - Missing Username and User ID

```bash
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_A_Token}" \
  -d '{"role": "admin"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Either userId or username is required"
  }
}
```

---

### Test 7: Validation - Missing Role

```bash
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_A_Token}" \
  -d '{"username": "user-b"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Role is required"
  }
}
```

---

### Test 8: Validation - Invalid Role

```bash
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_A_Token}" \
  -d '{"username": "user-b", "role": "super-admin"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Role must be \"creator\" or \"admin\""
  }
}
```

---

### Test 9: User Not Found

```bash
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_A_Token}" \
  -d '{"username": "non-existent-user", "role": "admin"}'
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User with username \"non-existent-user\" not found"
  }
}
```

---

### Test 10: Cannot Assign Role to Self

```bash
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_A_Token}" \
  -d '{"userId": "user_abc123", "role": "admin"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "You cannot assign roles to yourself"
  }
}
```

---

### Test 11: User Already Has Role (Conflict)

Assign a role to User B, then try to assign again:

```bash
# First assignment
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_A_Token}" \
  -d '{"username": "user-b", "role": "admin"}'

# Second assignment (should fail)
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_A_Token}" \
  -d '{"username": "user-b", "role": "admin"}'
```

Expected second response (409):
```json
{
  "error": {
    "code": "ROLE_ALREADY_EXISTS",
    "message": "User already has role \"admin\" in this gallery"
  }
}
```

---

### Test 12: Verify in Database

After adding a role, verify it was stored:

```bash
wrangler d1 execute vfa-gallery \
  --command="SELECT * FROM gallery_roles WHERE gallery_id = '{galleryId}' ORDER BY granted_at DESC;"
```

Expected: Shows all roles including the newly added one with correct granted_by value

---

### Test 13: Verify List Endpoint Updated

After adding a role, call GET to verify it appears in list:

```bash
curl -H "Authorization: Bearer {User_A_Token}" \
  http://localhost:8788/api/galleries/{galleryId}/roles
```

Expected: Both creator and newly added admin roles appear in response

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] POST /api/galleries/:id/roles requires authentication (401)
- [ ] Only gallery creator can add roles (403 for non-creators)
- [ ] Role can be assigned by username or user ID
- [ ] Role must be 'creator' or 'admin' (400 otherwise)
- [ ] Prevents self-assignment of roles
- [ ] Returns 404 for non-existent users
- [ ] Returns 409 if user already has a role
- [ ] Returns 201 Created with role object
- [ ] grantedBy field correctly records who assigned the role
- [ ] Role appears in GET /api/galleries/:id/roles list
- [ ] Invalid JSON returns 400 error

---

## Next Steps

Once this build is verified, proceed to **131-API-GALLERY-ROLES-REMOVE.md** to add the ability to remove roles.
