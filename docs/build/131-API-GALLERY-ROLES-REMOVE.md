# 131-API-GALLERY-ROLES-REMOVE.md

## Goal

Create the `DELETE /api/galleries/:id/roles/:userId` endpoint to allow gallery creators to remove admin roles from users. Only the creator can remove roles, and the creator role cannot be removed.

---

## Spec Extract

From TECHNICAL-SPEC.md - Gallery Roles Management:

- **Endpoint:** `DELETE /api/galleries/:id/roles/:userId`
- **Authentication:** Required (JWT token)
- **Authorization:** Only gallery creator
- **Response (200 OK):**
  ```json
  {
    "message": "Role removed successfully"
  }
  ```
- **HTTP Status Codes:**
  - `200` - Success
  - `400` - Cannot remove creator role
  - `401` - Unauthorized
  - `403` - Forbidden (not creator)
  - `404` - Gallery or role not found

---

## Prerequisites

**Must complete before starting:**
- **130-API-GALLERY-ROLES-ADD.md** - POST /api/galleries/:id/roles endpoint
- **129-API-GALLERY-ROLES-LIST.md** - GET /api/galleries/:id/roles endpoint
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **gallery_roles table** - Created in previous builds

---

## Steps

### Step 1: Add DELETE Roles Route

Add the DELETE endpoint to the galleries router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts`

Add this route after the POST /:id/roles route:

```typescript
/**
 * DELETE /galleries/:id/roles/:userId
 * Remove a role assignment from a gallery
 * Only gallery creator can remove roles
 * Creator role cannot be removed
 */
galleriesRouter.delete('/:id/roles/:userId', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const { id: galleryId, userId: targetUserId } = c.req.param()
  const db = c.env.DB

  // Validate parameters
  if (!galleryId) {
    throw Errors.badRequest('Gallery ID is required')
  }

  if (!targetUserId) {
    throw Errors.badRequest('User ID is required')
  }

  // Verify gallery exists and user is creator
  const gallery = await db
    .prepare('SELECT id, user_id FROM galleries WHERE id = ?')
    .bind(galleryId)
    .first<{ id: string; user_id: string }>()

  if (!gallery) {
    throw Errors.notFound('Gallery not found')
  }

  // Only creator can remove roles
  if (gallery.user_id !== userId) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Only the gallery creator can remove roles'
    )
  }

  // Fetch the role to be removed
  const role = await db
    .prepare(
      'SELECT gallery_id, user_id, role FROM gallery_roles WHERE gallery_id = ? AND user_id = ?'
    )
    .bind(galleryId, targetUserId)
    .first<{ gallery_id: string; user_id: string; role: string }>()

  if (!role) {
    throw Errors.notFound(
      `User does not have a role in this gallery`
    )
  }

  // Prevent removing creator role
  if (role.role === 'creator') {
    throw Errors.badRequest(
      'Cannot remove the creator role from a gallery'
    )
  }

  // Delete the role
  try {
    await db
      .prepare(
        'DELETE FROM gallery_roles WHERE gallery_id = ? AND user_id = ?'
      )
      .bind(galleryId, targetUserId)
      .run()
  } catch (err: any) {
    console.error('[Remove Gallery Role Error]', err)
    throw Errors.internal('Failed to remove role', { originalError: err.message })
  }

  return c.json({ message: 'Role removed successfully' })
})
```

**Explanation:**
- Requires authentication and creator role
- Validates both gallery ID and user ID parameters
- Verifies gallery exists and user is the creator
- Fetches the role to verify it exists
- Prevents deletion of creator roles (always returns 400)
- Deletes the role from database
- Returns success message on 200

---

## Files to Create/Modify

**Files to modify:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/galleries.ts` - Add DELETE :id/roles/:userId route

---

## Verification

### Test 1: TypeScript Compilation

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Delete Role Without Authentication

```bash
curl -X DELETE http://localhost:8788/api/galleries/{galleryId}/roles/{userId}
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

### Test 3: Delete Role as Non-Creator

1. Create a gallery with User A
2. Create User B and assign admin role
3. Log in as User C (unrelated user)

```bash
curl -X DELETE http://localhost:8788/api/galleries/{User_A_Gallery}/roles/{User_B_ID} \
  -H "Authorization: Bearer {User_C_Token}"
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only the gallery creator can remove roles"
  }
}
```

---

### Test 4: Delete Existing Admin Role

Setup: User A owns gallery, User B has admin role

```bash
curl -X DELETE http://localhost:8788/api/galleries/{galleryId}/roles/{User_B_ID} \
  -H "Authorization: Bearer {User_A_Token}"
```

Expected response (200):
```json
{
  "message": "Role removed successfully"
}
```

---

### Test 5: Verify Role Deleted from List

After deletion, call GET roles to verify it's gone:

```bash
curl -H "Authorization: Bearer {User_A_Token}" \
  http://localhost:8788/api/galleries/{galleryId}/roles
```

Expected: User B no longer appears in the roles list

---

### Test 6: Delete Non-Existent Role

Try to delete a role that doesn't exist:

```bash
curl -X DELETE http://localhost:8788/api/galleries/{galleryId}/roles/{invalid-user-id} \
  -H "Authorization: Bearer {User_A_Token}"
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User does not have a role in this gallery"
  }
}
```

---

### Test 7: Cannot Delete Creator Role

Try to remove the creator role (the gallery owner's own role):

```bash
curl -X DELETE http://localhost:8788/api/galleries/{galleryId}/roles/{Gallery_Creator_ID} \
  -H "Authorization: Bearer {Gallery_Creator_Token}"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Cannot remove the creator role from a gallery"
  }
}
```

---

### Test 8: Invalid Gallery ID

```bash
curl -X DELETE http://localhost:8788/api/galleries/invalid-gallery/roles/{userId} \
  -H "Authorization: Bearer {Token}"
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

### Test 9: Verify Database

After deleting a role, verify it's removed from database:

```bash
wrangler d1 execute vfa-gallery \
  --command="SELECT * FROM gallery_roles WHERE gallery_id = '{galleryId}' AND user_id = '{targetUserId}';"
```

Expected: No rows returned

---

### Test 10: Multiple Admin Roles

Setup: Gallery with multiple admins

1. Add Admin 1 and Admin 2
2. Delete Admin 1
3. Verify Admin 2 still exists

```bash
# List all roles
curl -H "Authorization: Bearer {User_A_Token}" \
  http://localhost:8788/api/galleries/{galleryId}/roles
```

Expected: Creator and Admin 2 roles remain, Admin 1 removed

---

### Test 11: Delete Then Re-add

Delete a role and then add it back:

```bash
# Delete
curl -X DELETE http://localhost:8788/api/galleries/{galleryId}/roles/{userId} \
  -H "Authorization: Bearer {User_A_Token}"

# Re-add
curl -X POST http://localhost:8788/api/galleries/{galleryId}/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {User_A_Token}" \
  -d '{"userId": "'$userId'", "role": "admin"}'
```

Expected: First returns 200, second returns 201 with newly granted role

---

### Test 12: Missing User ID Parameter

```bash
curl -X DELETE http://localhost:8788/api/galleries/{galleryId}/roles/ \
  -H "Authorization: Bearer {Token}"
```

Expected: 404 or routing error (depends on router implementation)

---

## Success Criteria

- [ ] TypeScript compiles without errors
- [ ] DELETE /api/galleries/:id/roles/:userId requires authentication (401)
- [ ] Only gallery creator can delete roles (403 for non-creators)
- [ ] Returns 404 for non-existent roles
- [ ] Returns 400 when trying to remove creator role
- [ ] Successfully deletes admin roles
- [ ] Deleted role no longer appears in GET list
- [ ] Creator role cannot be deleted under any circumstances
- [ ] Database record is properly removed on successful deletion

---

## Next Steps

Once this build is verified, proceed to **132-UI-GALLERY-ROLES.md** to create the UI for managing gallery roles.
