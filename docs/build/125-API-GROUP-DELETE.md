# 125-API-GROUP-DELETE.md

## Goal

Create the `DELETE /api/groups/:id` endpoint to allow group owners to delete groups and cascade delete all associated members.

---

## Spec Extract

From TECHNICAL-SPEC.md - Group CRUD Operations:

- **Endpoint:** `DELETE /api/groups/:id`
- **Authentication:** Required (JWT token)
- **Authorization:** User must be group owner
- **Response (204 No Content):** Group deleted successfully
- **Response (403 Forbidden):** User is not group owner
- **Response (404 Not Found):** Group does not exist
- **Cascade Behavior:** All group_members records are automatically deleted via ON DELETE CASCADE

---

## Prerequisites

**Must complete before starting:**
- **124-API-GROUP-UPDATE.md** - Update endpoint and authorization middleware
- **07-SCHEMA-GROUPS.md** - Groups table with CASCADE constraints

---

## Steps

### Step 1: Extend Group Routes - Delete Endpoint

Add the DELETE endpoint to the groups router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

Add this code after the PATCH /:id endpoint:

```typescript
import { requireGroupOwner } from '../middleware/group-auth'

/**
 * DELETE /groups/:id
 * Delete a group (owner only)
 * Cascades to delete all group_members records
 */
groupsRouter.delete('/:id', requireGroupOwner, async (c) => {
  const groupId = c.req.param('id')
  const userId = c.get('userId') as string
  const db = c.env.DB

  try {
    // Fetch group to ensure it exists
    const group = await db
      .prepare('SELECT id, slug, name FROM groups WHERE id = ?')
      .bind(groupId)
      .first<{ id: string; slug: string; name: string }>()

    if (!group) {
      throw new ApiError(
        404,
        'GROUP_NOT_FOUND',
        `Group with ID "${groupId}" not found`
      )
    }

    // Delete group (CASCADE will delete group_members)
    await db
      .prepare('DELETE FROM groups WHERE id = ?')
      .bind(groupId)
      .run()

    // Log deletion for audit trail
    console.log(
      `[Group Deleted] User: ${userId}, Group: ${group.slug} (${group.id}), Timestamp: ${new Date().toISOString()}`
    )

    // Return 204 No Content
    return c.text('', 204)
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err
    }

    console.error('[Group Delete Error]', err)
    throw Errors.internal('Failed to delete group', { originalError: err.message })
  }
})
```

**Explanation:**
- Requires authentication (JWT token)
- Uses `requireGroupOwner` middleware to ensure user is owner
- Fetches group first to validate it exists and return 404 if not
- Deletes group (ON DELETE CASCADE automatically handles group_members)
- Returns 204 No Content on success
- Returns 403 if user is not owner
- Returns 404 if group not found
- Logs deletion for audit trail

---

### Step 2: Verify Group-Auth Middleware Has Strict Owner Check

Ensure the `requireGroupOwner` middleware is properly defined in your group-auth.ts file (created in 124).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/group-auth.ts`

Verify it contains:

```typescript
/**
 * Check if user is group owner
 * Stricter check than requireGroupAdmin
 */
export async function requireGroupOwner(c: Context<HonoEnv>, next: Next) {
  const userId = c.get('userId') as string | undefined
  const groupId = c.req.param('id')

  if (!userId) {
    throw Errors.unauthorized('Authentication required')
  }

  if (!groupId) {
    throw Errors.badRequest('Group ID is required')
  }

  const db = c.env.DB

  // Check if user is owner
  const member = await db
    .prepare(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND role = 'owner'`
    )
    .bind(groupId, userId)
    .first<{ role: string }>()

  if (!member) {
    throw Errors.forbidden(
      'Only group owners can perform this action'
    )
  }

  await next()
}
```

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts` - Add DELETE /:id handler and import

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 2: Delete Without Authentication

```bash
curl -X DELETE http://localhost:8788/api/groups/grp_abc123
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

### Test 3: Delete As Non-Owner

Create a group as User A, then try deleting as User B:

```bash
curl -X DELETE http://localhost:8788/api/groups/grp_abc123 \
  -H "Authorization: Bearer <USER_B_TOKEN>"
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only group owners can perform this action"
  }
}
```

---

### Test 4: Delete As Manager (Should Fail)

Add User B as manager (not owner), then try deleting:

```bash
curl -X DELETE http://localhost:8788/api/groups/grp_abc123 \
  -H "Authorization: Bearer <MANAGER_TOKEN>"
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only group owners can perform this action"
  }
}
```

---

### Test 5: Delete Non-Existent Group

```bash
curl -X DELETE http://localhost:8788/api/groups/grp_nonexistent \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

Expected response (404):
```json
{
  "error": {
    "code": "GROUP_NOT_FOUND",
    "message": "Group with ID \"grp_nonexistent\" not found"
  }
}
```

---

### Test 6: Delete As Owner - Success

```bash
curl -X DELETE http://localhost:8788/api/groups/grp_abc123 \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

Expected response (204 No Content): No response body

---

### Test 7: Verify Group Deleted

Try fetching the deleted group:

```bash
curl http://localhost:8788/api/groups/studio-alpha
```

Expected response (404):
```json
{
  "error": {
    "code": "GROUP_NOT_FOUND",
    "message": "Group with slug \"studio-alpha\" not found"
  }
}
```

---

### Test 8: CASCADE Delete - Verify Members Deleted

Before deletion, note the group ID. After deletion, verify members are gone:

```bash
wrangler d1 execute vfa-gallery --command="SELECT COUNT(*) as count FROM group_members WHERE group_id='grp_abc123';"
```

Expected: Returns 0 (all members cascaded deleted)

---

### Test 9: CASCADE Delete - Multiple Members

Create a group with multiple members, then delete:

1. Create group as User A
2. Add User B as manager
3. Add User C as member
4. Add User D as member
5. Delete group as User A
6. Verify all group_members records are gone:

```bash
wrangler d1 execute vfa-gallery --command="SELECT COUNT(*) FROM group_members WHERE group_id='grp_abc123';"
```

Expected: Returns 0

---

### Test 10: List Groups - Deleted Group Not Shown

After deletion, verify the group doesn't appear in listing:

```bash
curl http://localhost:8788/api/groups
```

Expected: Deleted group not in results

---

### Test 11: Idempotency - Delete Already Deleted Group

After first deletion:

```bash
curl -X DELETE http://localhost:8788/api/groups/grp_abc123 \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

Expected response (404): Group not found

---

### Test 12: Database Verification - Group Deleted

Verify group record is gone:

```bash
wrangler d1 execute vfa-gallery --command="SELECT COUNT(*) FROM groups WHERE id='grp_abc123';"
```

Expected: Returns 0

---

### Test 13: Audit Log Check

Check console logs for deletion message:

Expected log output:
```
[Group Deleted] User: user_xyz, Group: studio-alpha (grp_abc123), Timestamp: 2026-01-18T15:00:00.000Z
```

---

### Test 14: Response Headers - No Content

```bash
curl -I -X DELETE http://localhost:8788/api/groups/grp_abc123 \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

Expected response:
```
HTTP/1.1 204 No Content
Content-Length: 0
```

---

### Test 15: Related Data Consistency

After deleting a group:
1. Verify artworks referencing the group are not affected (if applicable)
2. Verify user records are not affected
3. Verify group still appears in user's creation history if logged separately

---

## Success Criteria

- [ ] TypeScript compilation succeeds
- [ ] DELETE /api/groups/:id endpoint implemented
- [ ] Requires authentication
- [ ] Requires group owner role (not just manager)
- [ ] Returns 401 without authentication
- [ ] Returns 403 for non-owner users
- [ ] Returns 403 for manager users
- [ ] Returns 404 for non-existent groups
- [ ] Returns 204 No Content on success
- [ ] Group record is deleted from database
- [ ] All group_members records are cascade deleted
- [ ] Deleted group cannot be fetched
- [ ] Deleted group doesn't appear in list
- [ ] Audit logging captures deletion event
- [ ] Idempotent behavior for already-deleted groups

---

## Next Steps

Once this build is verified, proceed to **126-API-GROUP-MEMBERS.md** to implement member management endpoints (add, remove, join, leave).
