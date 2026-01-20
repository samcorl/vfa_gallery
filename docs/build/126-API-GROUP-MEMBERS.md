# 126-API-GROUP-MEMBERS.md

## Goal

Create comprehensive member management endpoints for groups including: list members, add/remove members, join group, and leave group.

---

## Spec Extract

From TECHNICAL-SPEC.md - Group Member Operations:

**Endpoints:**
- `GET /api/groups/:id/members` - List group members (public)
- `POST /api/groups/:id/members` - Add member to group (admin only)
- `DELETE /api/groups/:id/members/:userId` - Remove member (admin only)
- `POST /api/groups/:id/join` - Request to join group (auth required)
- `POST /api/groups/:id/leave` - Leave group (auth required)

**GET /api/groups/:id/members Response (200 OK):**
```json
{
  "data": [
    {
      "userId": "user_abc",
      "username": "alice",
      "role": "owner",
      "joinedAt": "2026-01-18T12:00:00Z"
    },
    {
      "userId": "user_def",
      "username": "bob",
      "role": "member",
      "joinedAt": "2026-01-18T13:00:00Z"
    }
  ]
}
```

**POST /api/groups/:id/members Request:**
```json
{
  "userId": "user_xyz",
  "role": "member"
}
```

**POST /api/groups/:id/join Response (200 OK):**
```json
{
  "data": {
    "message": "Successfully joined group"
  }
}
```

---

## Prerequisites

**Must complete before starting:**
- **124-API-GROUP-UPDATE.md** - Authorization middleware for groups
- **07-SCHEMA-GROUPS.md** - Groups and group_members tables
- **06-SCHEMA-USERS.md** - Users table

---

## Steps

### Step 1: Extend Group Routes - Members Listing

Add members listing endpoint to the groups router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

Add this code to your groups router:

```typescript
/**
 * GET /groups/:id/members
 * List all members of a group
 * Public endpoint
 */
groupsRouter.get('/:id/members', async (c) => {
  const groupId = c.req.param('id')
  const db = c.env.DB

  if (!groupId || groupId.trim().length === 0) {
    throw Errors.badRequest('Group ID is required')
  }

  try {
    // Verify group exists
    const group = await db
      .prepare('SELECT id FROM groups WHERE id = ?')
      .bind(groupId)
      .first<{ id: string }>()

    if (!group) {
      throw new ApiError(
        404,
        'GROUP_NOT_FOUND',
        `Group with ID "${groupId}" not found`
      )
    }

    // Fetch members with user info
    const members = await db
      .prepare(
        `SELECT
          group_members.user_id,
          group_members.role,
          group_members.joined_at,
          users.username
         FROM group_members
         JOIN users ON group_members.user_id = users.id
         WHERE group_members.group_id = ?
         ORDER BY group_members.role DESC, group_members.joined_at ASC`
      )
      .bind(groupId)
      .all<{
        user_id: string
        role: string
        joined_at: string
        username: string
      }>()

    const data = (members.results || []).map((m) => ({
      userId: m.user_id,
      username: m.username,
      role: m.role,
      joinedAt: m.joined_at,
    }))

    return c.json({ data }, 200)
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err
    }

    console.error('[Group Members List Error]', err)
    throw Errors.internal('Failed to fetch group members', {
      originalError: err.message,
    })
  }
})
```

---

### Step 2: Add Member Endpoint

Add member to group (admin only).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

Add this code:

```typescript
import { requireGroupAdmin } from '../middleware/group-auth'

/**
 * POST /groups/:id/members
 * Add a member to group (admin only)
 */
groupsRouter.post('/:id/members', requireGroupAdmin, async (c) => {
  const groupId = c.req.param('id')
  const db = c.env.DB

  // Parse request body
  let body: { userId: string; role?: string }
  try {
    body = await c.req.json()
  } catch (err) {
    throw Errors.badRequest('Invalid JSON in request body')
  }

  // Validate userId
  if (!body.userId) {
    throw Errors.badRequest('Field "userId" is required')
  }

  if (typeof body.userId !== 'string') {
    throw Errors.badRequest('Field "userId" must be a string')
  }

  const userId = body.userId.trim()
  const role = body.role || 'member'

  // Validate role
  const validRoles = ['owner', 'manager', 'member']
  if (!validRoles.includes(role)) {
    throw Errors.badRequest(`Role must be one of: ${validRoles.join(', ')}`)
  }

  try {
    // Verify group exists
    const group = await db
      .prepare('SELECT id FROM groups WHERE id = ?')
      .bind(groupId)
      .first<{ id: string }>()

    if (!group) {
      throw new ApiError(
        404,
        'GROUP_NOT_FOUND',
        `Group with ID "${groupId}" not found`
      )
    }

    // Verify user exists
    const user = await db
      .prepare('SELECT id, username FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; username: string }>()

    if (!user) {
      throw new ApiError(
        404,
        'USER_NOT_FOUND',
        `User with ID "${userId}" not found`
      )
    }

    // Check if user is already member
    const existing = await db
      .prepare('SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?')
      .bind(groupId, userId)
      .first<{ user_id: string }>()

    if (existing) {
      throw Errors.conflict(`User is already a member of this group`)
    }

    // Add member
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO group_members (group_id, user_id, role, joined_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(groupId, userId, role, now)
      .run()

    return c.json(
      {
        data: {
          userId: user.id,
          username: user.username,
          role,
          joinedAt: now,
        },
      },
      201
    )
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err
    }

    console.error('[Add Member Error]', err)
    throw Errors.internal('Failed to add member', { originalError: err.message })
  }
})
```

---

### Step 3: Remove Member Endpoint

Remove member from group (admin only).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

Add this code:

```typescript
/**
 * DELETE /groups/:id/members/:userId
 * Remove a member from group (admin only)
 * Cannot remove the owner
 */
groupsRouter.delete('/:id/members/:userId', requireGroupAdmin, async (c) => {
  const groupId = c.req.param('id')
  const memberId = c.req.param('userId')
  const currentUserId = c.get('userId') as string

  if (!memberId || memberId.trim().length === 0) {
    throw Errors.badRequest('User ID is required')
  }

  try {
    // Verify group exists
    const group = await db
      .prepare('SELECT id FROM groups WHERE id = ?')
      .bind(groupId)
      .first<{ id: string }>()

    if (!group) {
      throw new ApiError(
        404,
        'GROUP_NOT_FOUND',
        `Group with ID "${groupId}" not found`
      )
    }

    // Fetch member to check role
    const member = await db
      .prepare(
        `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`
      )
      .bind(groupId, memberId)
      .first<{ role: string }>()

    if (!member) {
      throw new ApiError(
        404,
        'MEMBER_NOT_FOUND',
        `User is not a member of this group`
      )
    }

    // Cannot remove owner
    if (member.role === 'owner') {
      throw Errors.badRequest('Cannot remove group owner')
    }

    // Cannot remove self unless you're the only admin
    if (memberId === currentUserId) {
      const adminCount = await db
        .prepare(
          `SELECT COUNT(*) as count FROM group_members
           WHERE group_id = ? AND role IN ('owner', 'manager')`
        )
        .bind(groupId)
        .first<{ count: number }>()

      if (adminCount && adminCount.count <= 1) {
        throw Errors.badRequest(
          'Cannot remove yourself as the last administrator'
        )
      }
    }

    // Remove member
    await db
      .prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
      .bind(groupId, memberId)
      .run()

    return c.text('', 204)
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err
    }

    console.error('[Remove Member Error]', err)
    throw Errors.internal('Failed to remove member', { originalError: err.message })
  }
})
```

---

### Step 4: Join Group Endpoint

Allow users to join a group (auth required).

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

Add this code:

```typescript
import { requireAuth } from '../middleware/auth'

/**
 * POST /groups/:id/join
 * Request to join a group
 * Auth required
 */
groupsRouter.post('/:id/join', requireAuth, async (c) => {
  const groupId = c.req.param('id')
  const userId = c.get('userId') as string
  const db = c.env.DB

  try {
    // Verify group exists
    const group = await db
      .prepare('SELECT id FROM groups WHERE id = ?')
      .bind(groupId)
      .first<{ id: string }>()

    if (!group) {
      throw new ApiError(
        404,
        'GROUP_NOT_FOUND',
        `Group with ID "${groupId}" not found`
      )
    }

    // Check if user is already member
    const existing = await db
      .prepare('SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?')
      .bind(groupId, userId)
      .first<{ user_id: string }>()

    if (existing) {
      throw Errors.conflict('You are already a member of this group')
    }

    // Add user as member (not admin)
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO group_members (group_id, user_id, role, joined_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(groupId, userId, 'member', now)
      .run()

    return c.json(
      {
        data: {
          message: 'Successfully joined group',
        },
      },
      200
    )
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err
    }

    console.error('[Join Group Error]', err)
    throw Errors.internal('Failed to join group', { originalError: err.message })
  }
})
```

---

### Step 5: Leave Group Endpoint

Allow users to leave a group.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

Add this code:

```typescript
/**
 * POST /groups/:id/leave
 * Leave a group
 * Auth required
 * Cannot leave if only owner remaining
 */
groupsRouter.post('/:id/leave', requireAuth, async (c) => {
  const groupId = c.req.param('id')
  const userId = c.get('userId') as string
  const db = c.env.DB

  try {
    // Verify group exists
    const group = await db
      .prepare('SELECT id FROM groups WHERE id = ?')
      .bind(groupId)
      .first<{ id: string }>()

    if (!group) {
      throw new ApiError(
        404,
        'GROUP_NOT_FOUND',
        `Group with ID "${groupId}" not found`
      )
    }

    // Check if user is member
    const member = await db
      .prepare(
        `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`
      )
      .bind(groupId, userId)
      .first<{ role: string }>()

    if (!member) {
      throw new ApiError(
        400,
        'NOT_A_MEMBER',
        'You are not a member of this group'
      )
    }

    // If user is owner, check if they're the only owner
    if (member.role === 'owner') {
      const ownerCount = await db
        .prepare(
          `SELECT COUNT(*) as count FROM group_members
           WHERE group_id = ? AND role = 'owner'`
        )
        .bind(groupId)
        .first<{ count: number }>()

      if (ownerCount && ownerCount.count <= 1) {
        throw Errors.badRequest(
          'Cannot leave as the last owner. Transfer ownership first.'
        )
      }
    }

    // Remove user from group
    await db
      .prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
      .bind(groupId, userId)
      .run()

    return c.json(
      {
        data: {
          message: 'Successfully left group',
        },
      },
      200
    )
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err
    }

    console.error('[Leave Group Error]', err)
    throw Errors.internal('Failed to leave group', { originalError: err.message })
  }
})
```

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts` - Add all member management endpoints

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 2: List Members (Empty Group)

Create a new group and list its members:

```bash
curl http://localhost:8788/api/groups/grp_abc123/members
```

Expected response (200):
```json
{
  "data": [
    {
      "userId": "user_xyz",
      "username": "creator",
      "role": "owner",
      "joinedAt": "2026-01-18T12:00:00Z"
    }
  ]
}
```

---

### Test 3: Add Member - Without Auth

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/members \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_new"}'
```

Expected response (401): Authentication required

---

### Test 4: Add Member - As Non-Admin

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MEMBER_TOKEN>" \
  -d '{"userId": "user_new"}'
```

Expected response (403): Permission denied

---

### Test 5: Add Member - As Admin

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{"userId": "user_bob", "role": "manager"}'
```

Expected response (201):
```json
{
  "data": {
    "userId": "user_bob",
    "username": "bob",
    "role": "manager",
    "joinedAt": "2026-01-18T13:00:00Z"
  }
}
```

---

### Test 6: Add Duplicate Member

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{"userId": "user_bob"}'
```

Expected response (409): User already member

---

### Test 7: Add Non-Existent User

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{"userId": "user_nonexistent"}'
```

Expected response (404): User not found

---

### Test 8: List Members - Multiple Members

After adding members, list them:

```bash
curl http://localhost:8788/api/groups/grp_abc123/members
```

Expected response (200): All members with correct roles and join times

---

### Test 9: Remove Member - As Admin

```bash
curl -X DELETE http://localhost:8788/api/groups/grp_abc123/members/user_bob \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

Expected response (204): No content

---

### Test 10: Remove Non-Existent Member

```bash
curl -X DELETE http://localhost:8788/api/groups/grp_abc123/members/user_nonexistent \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

Expected response (404): Member not found

---

### Test 11: Remove Owner

Try removing the owner:

```bash
curl -X DELETE http://localhost:8788/api/groups/grp_abc123/members/user_xyz \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

Expected response (400): Cannot remove owner

---

### Test 12: Join Group - Without Auth

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/join
```

Expected response (401): Authentication required

---

### Test 13: Join Group - Success

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/join \
  -H "Authorization: Bearer <NEW_USER_TOKEN>"
```

Expected response (200):
```json
{
  "data": {
    "message": "Successfully joined group"
  }
}
```

---

### Test 14: Join Group - Already Member

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/join \
  -H "Authorization: Bearer <NEW_USER_TOKEN>"
```

Expected response (409): Already member

---

### Test 15: Leave Group - Without Auth

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/leave
```

Expected response (401): Authentication required

---

### Test 16: Leave Group - Not a Member

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/leave \
  -H "Authorization: Bearer <OTHER_USER_TOKEN>"
```

Expected response (400): Not a member

---

### Test 17: Leave Group - Success

```bash
curl -X POST http://localhost:8788/api/groups/grp_abc123/leave \
  -H "Authorization: Bearer <MEMBER_TOKEN>"
```

Expected response (200):
```json
{
  "data": {
    "message": "Successfully left group"
  }
}
```

---

### Test 18: Leave Group - As Only Owner

Create group with only one owner, try leaving:

```bash
curl -X POST http://localhost:8788/api/groups/grp_def456/leave \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

Expected response (400): Cannot leave as last owner

---

### Test 19: Member Count Consistency

After adding/removing members, check member count in group listing:

```bash
curl http://localhost:8788/api/groups/grp_abc123
```

Expected: memberCount matches actual member count

---

### Test 20: Remove Last Admin (Self)

Add yourself as the only admin with other members, try removing yourself:

```bash
curl -X DELETE http://localhost:8788/api/groups/grp_abc123/members/user_current \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Expected response (400): Cannot remove yourself as last admin

---

## Success Criteria

- [ ] TypeScript compilation succeeds
- [ ] GET /api/groups/:id/members endpoint implemented
- [ ] POST /api/groups/:id/members endpoint implemented
- [ ] DELETE /api/groups/:id/members/:userId endpoint implemented
- [ ] POST /api/groups/:id/join endpoint implemented
- [ ] POST /api/groups/:id/leave endpoint implemented
- [ ] Members listed in order: owners first, then by join date
- [ ] Add member validates user exists and not already member
- [ ] Add member requires admin authorization
- [ ] Remove member prevents removing owner
- [ ] Remove member prevents removing last admin
- [ ] Join group adds user as regular member
- [ ] Join group prevents duplicate membership
- [ ] Leave group prevents leaving if only owner
- [ ] All endpoints validate group existence
- [ ] Database records are accurate after all operations

---

## Next Steps

Once this build is verified, proceed to **127-UI-GROUP-PUBLIC.md** to create the public group page frontend.
