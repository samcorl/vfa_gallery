# 124-API-GROUP-UPDATE.md

## Goal

Create the `PATCH /api/groups/:id` endpoint to allow group owners/admins to update group information (name, website, email, phone, socials, logo).

---

## Spec Extract

From TECHNICAL-SPEC.md - Group CRUD Operations:

- **Endpoint:** `PATCH /api/groups/:id`
- **Authentication:** Required (JWT token)
- **Authorization:** User must be group owner or manager
- **Request Body (partial update):**
  ```json
  {
    "name": "Studio Alpha Updated",
    "website": "https://studio-alpha.com",
    "email": "contact@studio-alpha.com",
    "phone": "+1-555-0100",
    "socials": {
      "twitter": "@studioalpha",
      "instagram": "studioalpha"
    }
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "data": {
      "id": "grp_abc123def456",
      "slug": "studio-alpha",
      "name": "Studio Alpha Updated",
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
      "updatedAt": "2026-01-18T14:30:00Z",
      "memberCount": 5,
      "isOwner": true
    }
  }
  ```
- **Response (403 Forbidden):** User is not group owner or manager
- **Response (404 Not Found):** Group does not exist

---

## Prerequisites

**Must complete before starting:**
- **123-API-GROUP-GET.md** - Get group endpoint
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **07-SCHEMA-GROUPS.md** - Groups and group_members tables created

---

## Steps

### Step 1: Create Authorization Middleware for Groups

Add a helper to check group membership and role.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/group-auth.ts`

```typescript
import type { Context, Next } from 'hono'
import type { HonoEnv } from '../../../types/env'
import { Errors } from '../errors'

/**
 * Middleware to check if user has required role in group
 * Required roles: 'owner' or 'manager'
 */
export async function requireGroupAdmin(c: Context<HonoEnv>, next: Next) {
  const userId = c.get('userId') as string | undefined
  const groupId = c.req.param('id')

  if (!userId) {
    throw Errors.unauthorized('Authentication required')
  }

  if (!groupId) {
    throw Errors.badRequest('Group ID is required')
  }

  const db = c.env.DB

  // Check if user is member with owner or manager role
  const member = await db
    .prepare(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND role IN ('owner', 'manager')`
    )
    .bind(groupId, userId)
    .first<{ role: string }>()

  if (!member) {
    throw Errors.forbidden(
      'You do not have permission to manage this group'
    )
  }

  // Store role for use in handler
  c.set('groupRole', member.role)

  await next()
}

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

### Step 2: Extend Group Routes - Update Endpoint

Add the PATCH endpoint to the groups router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

Add imports at the top:

```typescript
import { requireGroupAdmin } from '../middleware/group-auth'
import {
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidSocials,
} from '../utils/group'
```

Add this code after the GET /:slug endpoint:

```typescript
/**
 * PATCH /groups/:id
 * Update group information (owner/manager only)
 */
groupsRouter.patch('/:id', requireGroupAdmin, async (c) => {
  const groupId = c.req.param('id')
  const db = c.env.DB

  // Parse request body
  let body: Partial<CreateGroupRequest>
  try {
    body = await c.req.json()
  } catch (err) {
    throw Errors.badRequest('Invalid JSON in request body')
  }

  try {
    // Fetch current group
    const currentGroup = await db
      .prepare('SELECT * FROM groups WHERE id = ?')
      .bind(groupId)
      .first<GroupRow>()

    if (!currentGroup) {
      throw new ApiError(
        404,
        'GROUP_NOT_FOUND',
        `Group with ID "${groupId}" not found`
      )
    }

    // Build update object with only provided fields
    const updates: any = {}
    const now = new Date().toISOString()

    // Validate and add name if provided
    if (body.name !== undefined) {
      if (!body.name) {
        throw Errors.badRequest('Group name cannot be empty')
      }

      if (typeof body.name !== 'string') {
        throw Errors.badRequest('Group name must be a string')
      }

      const name = body.name.trim()
      if (name.length < GROUP_NAME_MIN || name.length > GROUP_NAME_MAX) {
        throw Errors.badRequest(
          `Group name must be between ${GROUP_NAME_MIN} and ${GROUP_NAME_MAX} characters`
        )
      }

      updates.name = name
    }

    // Validate and add website if provided
    if (body.website !== undefined) {
      if (body.website !== null) {
        if (typeof body.website !== 'string') {
          throw Errors.badRequest('Website must be a string')
        }

        const website = body.website.trim()
        if (website.length > GROUP_WEBSITE_MAX) {
          throw Errors.badRequest(
            `Website URL must not exceed ${GROUP_WEBSITE_MAX} characters`
          )
        }

        if (website.length > 0 && !isValidUrl(website)) {
          throw Errors.badRequest('Website must be a valid URL (e.g., https://example.com)')
        }

        updates.website = website.length > 0 ? website : null
      } else {
        updates.website = null
      }
    }

    // Validate and add email if provided
    if (body.email !== undefined) {
      if (body.email !== null) {
        if (typeof body.email !== 'string') {
          throw Errors.badRequest('Email must be a string')
        }

        const email = body.email.trim()
        if (email.length > GROUP_EMAIL_MAX) {
          throw Errors.badRequest(
            `Email must not exceed ${GROUP_EMAIL_MAX} characters`
          )
        }

        if (email.length > 0 && !isValidEmail(email)) {
          throw Errors.badRequest('Email must be a valid email address')
        }

        updates.email = email.length > 0 ? email : null
      } else {
        updates.email = null
      }
    }

    // Validate and add phone if provided
    if (body.phone !== undefined) {
      if (body.phone !== null) {
        if (typeof body.phone !== 'string') {
          throw Errors.badRequest('Phone must be a string')
        }

        const phone = body.phone.trim()
        if (phone.length > GROUP_PHONE_MAX) {
          throw Errors.badRequest(
            `Phone must not exceed ${GROUP_PHONE_MAX} characters`
          )
        }

        if (phone.length > 0 && !isValidPhone(phone)) {
          throw Errors.badRequest('Phone must be a valid phone number')
        }

        updates.phone = phone.length > 0 ? phone : null
      } else {
        updates.phone = null
      }
    }

    // Validate and add socials if provided
    if (body.socials !== undefined) {
      if (body.socials !== null) {
        if (!isValidSocials(body.socials)) {
          throw Errors.badRequest('Socials must be an object with string values')
        }

        updates.socials = JSON.stringify(body.socials)
      } else {
        updates.socials = null
      }
    }

    // If no valid updates provided, return current group
    if (Object.keys(updates).length === 0) {
      const memberCount = await db
        .prepare('SELECT COUNT(*) as count FROM group_members WHERE group_id = ?')
        .bind(groupId)
        .first<{ count: number }>()

      const group = groupRowToApi(currentGroup, memberCount?.count || 0, true)
      return c.json({ data: group }, 200)
    }

    // Add updated_at timestamp
    updates.updated_at = now

    // Build dynamic UPDATE query
    const columns = Object.keys(updates)
    const placeholders = columns.map(() => '?').join(', ')
    const setClause = columns.map((col) => `${col} = ?`).join(', ')
    const values = columns.flatMap((col) => [updates[col]])

    const updateQuery = `
      UPDATE groups
      SET ${setClause}
      WHERE id = ?
    `

    values.push(groupId)

    await db.prepare(updateQuery).bind(...values).run()

    // Fetch and return updated group
    const updatedRow = await db
      .prepare('SELECT * FROM groups WHERE id = ?')
      .bind(groupId)
      .first<GroupRow>()

    if (!updatedRow) {
      throw Errors.internal('Failed to retrieve updated group')
    }

    const memberCount = await db
      .prepare('SELECT COUNT(*) as count FROM group_members WHERE group_id = ?')
      .bind(groupId)
      .first<{ count: number }>()

    const group = groupRowToApi(updatedRow, memberCount?.count || 0, true)

    return c.json({ data: group }, 200)
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err
    }

    console.error('[Group Update Error]', err)
    throw Errors.internal('Failed to update group', { originalError: err.message })
  }
})
```

**Explanation:**
- Requires authentication (JWT token)
- Uses `requireGroupAdmin` middleware to check user is owner or manager
- Only updates fields that are provided in request body (partial update)
- Validates all fields (name, website, email, phone, socials)
- Allows setting fields to null to clear them
- Returns updated group with all fields
- Returns 403 if user is not owner/manager
- Returns 404 if group not found

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/group-auth.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts` - Add PATCH /:id handler and imports

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 2: Update Without Authentication

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'
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

### Test 3: Update As Non-Member

Using JWT token from a different user:

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OTHER_USER_TOKEN>" \
  -d '{"name": "Updated Name"}'
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to manage this group"
  }
}
```

---

### Test 4: Update As Owner

Using JWT token from group creator:

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{"name": "Studio Alpha Updated"}'
```

Expected response (200):
```json
{
  "data": {
    "id": "grp_abc123",
    "slug": "studio-alpha",
    "name": "Studio Alpha Updated",
    ...
    "updatedAt": "2026-01-18T14:30:00Z"
  }
}
```

---

### Test 5: Partial Update - Name Only

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{"name": "New Name"}'
```

Expected: Only name changes, other fields remain unchanged

---

### Test 6: Partial Update - Email and Phone

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{
    "email": "newemail@example.com",
    "phone": "+1-555-0200"
  }'
```

Expected: Email and phone update, name and other fields unchanged

---

### Test 7: Clear Email Field

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{"email": null}'
```

Expected: Email field becomes null in response

---

### Test 8: Validation - Invalid Email

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{"email": "invalid-email"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Email must be a valid email address"
  }
}
```

---

### Test 9: Validation - Invalid URL

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{"website": "not-a-url"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Website must be a valid URL (e.g., https://example.com)"
  }
}
```

---

### Test 10: Update Socials

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{
    "socials": {
      "twitter": "@newtwitterhandle",
      "youtube": "channel/abc123"
    }
  }'
```

Expected response (200): Socials object properly updated and parsed

---

### Test 11: Timestamp Updated

Update a group and check the updatedAt timestamp:

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{"name": "New Name"}'
```

Expected: updatedAt is newer than initial creation time

---

### Test 12: Non-Existent Group

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_nonexistent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{"name": "Updated"}'
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

### Test 13: Empty Update (No Fields)

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -d '{}'
```

Expected response (200): Returns current group unchanged

---

### Test 14: Manager Can Update

Add a second user as manager, then try updating as that user:

```bash
curl -X PATCH http://localhost:8788/api/groups/grp_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -d '{"name": "Updated by Manager"}'
```

Expected response (200): Update succeeds

---

### Test 15: Database Verification

Verify the update in database:

```bash
wrangler d1 execute vfa-gallery --command="SELECT id, name, email, updated_at FROM groups WHERE id='grp_abc123';"
```

Expected: Shows updated values and new updated_at timestamp

---

## Success Criteria

- [ ] TypeScript compilation succeeds
- [ ] PATCH /api/groups/:id endpoint implemented
- [ ] Requires authentication
- [ ] Requires group owner or manager role
- [ ] Returns 401 without authentication
- [ ] Returns 403 for non-member users
- [ ] Returns 404 for non-existent groups
- [ ] Returns 200 for successful update
- [ ] Supports partial updates (only specified fields)
- [ ] Validates name, email, website, phone formats
- [ ] Allows clearing fields by setting to null
- [ ] Updates timestamp to current time
- [ ] Returns full updated group object
- [ ] Only owner/manager can update
- [ ] Database record is updated correctly

---

## Next Steps

Once this build is verified, proceed to **125-API-GROUP-DELETE.md** to allow group owners to delete groups.
