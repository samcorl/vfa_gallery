# 123-API-GROUP-GET.md

## Goal

Create the `GET /api/groups/:slug` endpoint to fetch a single group by slug with full member list and details.

---

## Spec Extract

From TECHNICAL-SPEC.md - Group CRUD Operations:

- **Endpoint:** `GET /api/groups/:slug`
- **Authentication:** Not required (public endpoint)
- **Response (200 OK):**
  ```json
  {
    "data": {
      "id": "grp_abc123def456",
      "slug": "studio-alpha",
      "name": "Studio Alpha",
      "website": "https://studio-alpha.com",
      "email": "contact@studio-alpha.com",
      "phone": "+1-555-0100",
      "socials": {
        "twitter": "@studioalpha",
        "instagram": "studioalpha"
      },
      "logoUrl": null,
      "createdBy": "user_xyz789",
      "createdAt": "2026-01-18T12:00:00Z",
      "updatedAt": "2026-01-18T12:00:00Z",
      "memberCount": 5,
      "members": [
        {
          "userId": "user_abc",
          "username": "alice",
          "role": "owner",
          "joinedAt": "2026-01-18T12:00:00Z"
        },
        {
          "userId": "user_def",
          "username": "bob",
          "role": "manager",
          "joinedAt": "2026-01-18T13:00:00Z"
        }
      ]
    }
  }
  ```
- **Response (404 Not Found):** Group with this slug does not exist

---

## Prerequisites

**Must complete before starting:**
- **122-API-GROUP-LIST.md** - List endpoint and pagination utilities
- **07-SCHEMA-GROUPS.md** - Groups and group_members tables created

---

## Steps

### Step 1: Create Extended Group Response Type

Update group types to include members list.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/group.ts`

Add these types after existing Group interface:

```typescript
/**
 * Group member detail with user info
 */
export interface GroupMemberDetail extends GroupMember {
  username: string
}

/**
 * Extended group response with members list
 */
export interface GroupWithMembers extends Group {
  members?: GroupMemberDetail[]
}

/**
 * User info for group member response
 */
export interface UserInfo {
  id: string
  username: string
  email?: string
  avatarUrl?: string | null
}

/**
 * Transform database row with members to API response
 */
export function groupRowToApiWithMembers(
  row: GroupRow,
  members: (GroupMemberRow & { username: string })[],
  isOwner?: boolean
): GroupWithMembers {
  const group = groupRowToApi(row, members.length, isOwner)

  return {
    ...group,
    members: members.map((m) => ({
      userId: m.user_id,
      username: m.username,
      role: m.role as 'owner' | 'manager' | 'member',
      joinedAt: m.joined_at,
    })),
  }
}
```

---

### Step 2: Extend Group Routes - Get by Slug

Add the GET endpoint to the groups router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

Add this code after the list endpoint (GET /):

```typescript
import {
  Group,
  GroupWithMembers,
  GroupRow,
  GroupMemberRow,
  groupRowToApi,
  groupRowToApiWithMembers,
} from '../../../types/group'

/**
 * GET /groups/:slug
 * Fetch a single group by slug with all members
 * Public endpoint (no authentication required)
 */
groupsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB

  if (!slug || slug.trim().length === 0) {
    throw Errors.badRequest('Group slug is required')
  }

  try {
    // Fetch group
    const groupRow = await db
      .prepare('SELECT * FROM groups WHERE slug = ?')
      .bind(slug)
      .first<GroupRow>()

    if (!groupRow) {
      throw new ApiError(
        404,
        'GROUP_NOT_FOUND',
        `Group with slug "${slug}" not found`
      )
    }

    // Fetch group members with user info
    const members = await db
      .prepare(
        `SELECT
          group_members.group_id,
          group_members.user_id,
          group_members.role,
          group_members.joined_at,
          users.username
         FROM group_members
         JOIN users ON group_members.user_id = users.id
         WHERE group_members.group_id = ?
         ORDER BY group_members.joined_at ASC`
      )
      .bind(groupRow.id)
      .all<GroupMemberRow & { username: string }>()

    const membersList = members.results || []

    // Determine if current user is owner (for response metadata)
    const currentUserId = c.get('userId') as string | undefined
    const isOwner = currentUserId
      ? membersList.some((m) => m.user_id === currentUserId && m.role === 'owner')
      : false

    // Transform and return
    const group = groupRowToApiWithMembers(groupRow, membersList, isOwner)

    return c.json({ data: group }, 200)
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err
    }

    console.error('[Group Get Error]', err)
    throw Errors.internal('Failed to fetch group', { originalError: err.message })
  }
})
```

**Explanation:**
- Fetches group by slug (not by ID) for public URL sharing
- Returns 404 if group not found
- Fetches all members with user info via JOIN
- Determines if current user (if authenticated) is an owner
- Returns full group object with members array

---

### Step 3: Handle Optional Authentication

Update the authentication check to not require auth globally.

The GET endpoint should work without authentication, but can accept optional auth context. Ensure the middleware allows:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/auth.ts`

The existing middleware should already support optional context via `c.get('userId')` returning undefined when not authenticated. Verify that your group routes can be accessed without auth tokens.

If needed, add an optional auth middleware:

```typescript
/**
 * Optional authentication middleware
 * Sets userId if token is valid, but doesn't throw if missing
 */
export async function optionalAuth(c: Context<HonoEnv>, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    await next()
    return
  }

  // Use existing auth logic to verify token
  try {
    const token = authHeader.replace('Bearer ', '')
    // Verify and extract userId
    // Set c.set('userId', userId) if valid
  } catch {
    // Silent fail - token invalid but endpoint is public
  }

  await next()
}
```

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/group.ts` - Add GroupWithMembers and helper functions
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts` - Add GET /:slug handler

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 2: Get Non-Existent Group

```bash
curl http://localhost:8788/api/groups/nonexistent-group
```

Expected response (404):
```json
{
  "error": {
    "code": "GROUP_NOT_FOUND",
    "message": "Group with slug \"nonexistent-group\" not found"
  }
}
```

---

### Test 3: Get Existing Group

First, create a group:

```bash
curl -X POST http://localhost:8788/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "name": "Studio Alpha",
    "website": "https://studio-alpha.com",
    "email": "contact@studio-alpha.com",
    "phone": "+1-555-0100",
    "socials": {
      "twitter": "@studioalpha"
    }
  }'
```

Then fetch it by slug:

```bash
curl http://localhost:8788/api/groups/studio-alpha
```

Expected response (200):
```json
{
  "data": {
    "id": "grp_abc123",
    "slug": "studio-alpha",
    "name": "Studio Alpha",
    "website": "https://studio-alpha.com",
    "email": "contact@studio-alpha.com",
    "phone": "+1-555-0100",
    "socials": {
      "twitter": "@studioalpha"
    },
    "logoUrl": null,
    "createdBy": "user_xyz",
    "createdAt": "2026-01-18T12:00:00Z",
    "updatedAt": "2026-01-18T12:00:00Z",
    "memberCount": 1,
    "members": [
      {
        "userId": "user_xyz",
        "username": "creator",
        "role": "owner",
        "joinedAt": "2026-01-18T12:00:00Z"
      }
    ]
  }
}
```

---

### Test 4: Get Group Without Authentication

```bash
curl http://localhost:8788/api/groups/studio-alpha
```

Expected: Works fine (public endpoint), returns group data

---

### Test 5: Get Group With Authentication

Using same token that created the group:

```bash
curl http://localhost:8788/api/groups/studio-alpha \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

Expected response (200):
```json
{
  "data": {
    ...
    "isOwner": true,
    "members": [...]
  }
}
```

---

### Test 6: Get Group As Different User

Using a different JWT token:

```bash
curl http://localhost:8788/api/groups/studio-alpha \
  -H "Authorization: Bearer <DIFFERENT_JWT_TOKEN>"
```

Expected response (200):
```json
{
  "data": {
    ...
    "isOwner": false,
    "members": [...]
  }
}
```

---

### Test 7: Members List Accuracy

Add additional members to the group using the member management endpoint (see 126).

```bash
curl http://localhost:8788/api/groups/studio-alpha
```

Expected: Members array includes all added members with correct roles and joinedAt timestamps

---

### Test 8: Members Ordered by Join Date

Add members at different times.

```bash
curl http://localhost:8788/api/groups/studio-alpha
```

Expected: Members in members array are ordered by joinedAt (ascending)

---

### Test 9: Empty Members List (Owner Only)

Get a newly created group with just the owner:

```bash
curl http://localhost:8788/api/groups/studio-alpha
```

Expected response includes:
```json
{
  "memberCount": 1,
  "members": [
    {
      "role": "owner",
      ...
    }
  ]
}
```

---

### Test 10: Case Sensitivity

Slugs should be lowercase. Try accessing with mixed case:

```bash
curl http://localhost:8788/api/groups/Studio-Alpha
```

Expected response (404): Slug lookup is case-sensitive

---

### Test 11: Group With Special Characters in Response

Create group with socials that have special characters:

```bash
curl http://localhost:8788/api/groups/studio-alpha
```

Expected: Socials object properly parsed from JSON string

---

## Success Criteria

- [ ] TypeScript compilation succeeds
- [ ] GET /api/groups/:slug endpoint implemented
- [ ] Public endpoint (no authentication required)
- [ ] Returns 404 for non-existent group slugs
- [ ] Returns 200 with full group data for existing groups
- [ ] Response includes all group fields
- [ ] Response includes memberCount
- [ ] Response includes members array
- [ ] Members array includes userId, username, role, joinedAt for each member
- [ ] Members array is ordered by joinedAt ascending
- [ ] isOwner field is true for authenticated user who is owner
- [ ] isOwner field is false for non-owner users
- [ ] isOwner field is false or omitted for unauthenticated requests
- [ ] Socials object is properly parsed from JSON storage
- [ ] Slug lookup is case-sensitive

---

## Next Steps

Once this build is verified, proceed to **124-API-GROUP-UPDATE.md** to allow group admins to update group information.
