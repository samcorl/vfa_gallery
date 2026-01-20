# 121-API-GROUP-CREATE.md

## Goal

Create the `POST /api/groups` endpoint to allow authenticated users to create new groups with automatic slug generation, member addition, and role assignment.

---

## Spec Extract

From TECHNICAL-SPEC.md - Group CRUD Operations:

- **Endpoint:** `POST /api/groups`
- **Authentication:** Required (JWT token)
- **Request Body:**
  ```json
  {
    "name": "Studio Alpha",
    "website": "https://studio-alpha.com",
    "email": "contact@studio-alpha.com",
    "phone": "+1-555-0100",
    "socials": {
      "twitter": "@studioalpha",
      "instagram": "studioalpha"
    }
  }
  ```
- **Response (201 Created):**
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
      "memberCount": 1,
      "isOwner": true
    }
  }
  ```
- **Slug Uniqueness:** Globally unique (different users cannot have groups with same slug)
- **Slug Generation:** Auto-generated from name, must be URL-safe
- **Creator Role:** User who creates group is automatically added as owner with `role='owner'` in group_members

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono router and error handling setup
- **16-API-MIDDLEWARE-AUTH.md** - JWT authentication middleware
- **07-SCHEMA-GROUPS.md** - Groups and group_members tables created
- **121-API-GROUP-CREATE.md** - This file (create types and utilities first)

---

## Steps

### Step 1: Create Group Types

Define TypeScript types for group API responses.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/group.ts`

```typescript
/**
 * Group type for API responses
 * Matches database schema with camelCase property names
 */
export interface Group {
  id: string
  slug: string
  name: string
  website: string | null
  email: string | null
  phone: string | null
  socials: Record<string, string> | null
  logoUrl: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  memberCount?: number
  isOwner?: boolean
}

/**
 * Request body for creating a group
 */
export interface CreateGroupRequest {
  name: string
  website?: string | null
  email?: string | null
  phone?: string | null
  socials?: Record<string, string> | null
}

/**
 * Group member type
 */
export interface GroupMember {
  userId: string
  role: 'owner' | 'manager' | 'member'
  joinedAt: string
}

/**
 * Database row type (snake_case from SQLite)
 */
export interface GroupRow {
  id: string
  slug: string
  name: string
  website: string | null
  email: string | null
  phone: string | null
  socials: string | null
  logo_url: string | null
  created_by: string
  created_at: string
  updated_at: string
}

/**
 * Database row type for group members
 */
export interface GroupMemberRow {
  group_id: string
  user_id: string
  role: string
  joined_at: string
}

/**
 * Transform database row to API response
 */
export function groupRowToApi(
  row: GroupRow,
  memberCount?: number,
  isOwner?: boolean
): Group {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    website: row.website,
    email: row.email,
    phone: row.phone,
    socials: row.socials ? JSON.parse(row.socials) : null,
    logoUrl: row.logo_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberCount,
    isOwner,
  }
}

/**
 * Transform API request to database format
 */
export function groupApiToDb(data: CreateGroupRequest) {
  return {
    ...data,
    socials: data.socials ? JSON.stringify(data.socials) : null,
  }
}
```

**Explanation:**
- `Group` interface is the API response format (camelCase)
- `GroupRow` matches SQLite schema (snake_case)
- `CreateGroupRequest` defines request validation
- `groupRowToApi()` transforms database rows to API responses
- `socials` converts between JSON object and string storage
- `memberCount` and `isOwner` are computed on demand

---

### Step 2: Create Group Utilities

Create utility functions for slug generation and validation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/group.ts`

```typescript
/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate phone format (basic check for digits and common symbols)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s+().-]{7,}$/
  return phoneRegex.test(phone)
}

/**
 * Validate website URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Generate URL-safe slug from text
 * Converts to lowercase, removes special characters, replaces spaces with hyphens
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '')   // Remove leading/trailing hyphens
}

/**
 * Generate unique slug for a group
 * If slug already exists globally, appends a numeric suffix
 * Example: "studio-alpha" -> "studio-alpha-1", "studio-alpha-2", etc.
 */
export async function generateUniqueGroupSlug(
  db: any,
  baseSlug: string
): Promise<string> {
  // Check if base slug already exists
  const existing = await db
    .prepare('SELECT slug FROM groups WHERE slug = ?')
    .bind(baseSlug)
    .first()

  if (!existing) {
    return baseSlug
  }

  // Find next available numbered slug
  let counter = 1
  let candidateSlug = `${baseSlug}-${counter}`

  while (true) {
    const conflict = await db
      .prepare('SELECT slug FROM groups WHERE slug = ?')
      .bind(candidateSlug)
      .first()

    if (!conflict) {
      return candidateSlug
    }

    counter++
    candidateSlug = `${baseSlug}-${counter}`

    // Safety limit to prevent infinite loop
    if (counter > 1000) {
      throw new Error('Unable to generate unique group slug after 1000 attempts')
    }
  }
}

/**
 * Validate socials object
 * Each value should be a string (social media handle or username)
 */
export function isValidSocials(socials: any): boolean {
  if (typeof socials !== 'object' || socials === null) {
    return false
  }

  // Check that all values are strings
  for (const key in socials) {
    if (typeof socials[key] !== 'string') {
      return false
    }
  }

  return true
}
```

**Explanation:**
- Validates email, phone, and website URL formats
- `generateSlug()` converts text to URL-safe format
- `generateUniqueGroupSlug()` ensures global slug uniqueness
- `isValidSocials()` validates social media object structure
- Prevents infinite loops with 1000-attempt safety limit

---

### Step 3: Create Group Routes File

Create the main groups API routes file.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

```typescript
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import type { HonoEnv } from '../../../types/env'
import { ApiError, Errors } from '../errors'
import { requireAuth } from '../middleware/auth'
import {
  generateSlug,
  generateUniqueGroupSlug,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidSocials,
} from '../utils/group'
import {
  Group,
  CreateGroupRequest,
  GroupRow,
  GroupMemberRow,
  groupRowToApi,
} from '../../../types/group'

// Group configuration
const GROUP_NAME_MIN = 1
const GROUP_NAME_MAX = 255
const GROUP_EMAIL_MAX = 255
const GROUP_PHONE_MAX = 20
const GROUP_WEBSITE_MAX = 2048

export const groupsRouter = new Hono<HonoEnv>()

/**
 * POST /groups
 * Create a new group for the authenticated user
 * User is automatically added as owner
 */
groupsRouter.post('/', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const db = c.env.DB

  // Parse and validate request body
  let body: CreateGroupRequest
  try {
    body = await c.req.json()
  } catch (err) {
    throw Errors.badRequest('Invalid JSON in request body')
  }

  // Validate required field: name
  if (!body.name) {
    throw Errors.badRequest('Field "name" is required')
  }

  if (typeof body.name !== 'string') {
    throw Errors.badRequest('Field "name" must be a string')
  }

  const name = body.name.trim()

  // Validate name length
  if (name.length < GROUP_NAME_MIN || name.length > GROUP_NAME_MAX) {
    throw Errors.badRequest(
      `Group name must be between ${GROUP_NAME_MIN} and ${GROUP_NAME_MAX} characters`
    )
  }

  // Validate optional website
  const website = body.website ? body.website.trim() : null
  if (website) {
    if (website.length > GROUP_WEBSITE_MAX) {
      throw Errors.badRequest(
        `Website URL must not exceed ${GROUP_WEBSITE_MAX} characters`
      )
    }
    if (!isValidUrl(website)) {
      throw Errors.badRequest('Website must be a valid URL (e.g., https://example.com)')
    }
  }

  // Validate optional email
  const email = body.email ? body.email.trim() : null
  if (email) {
    if (email.length > GROUP_EMAIL_MAX) {
      throw Errors.badRequest(
        `Email must not exceed ${GROUP_EMAIL_MAX} characters`
      )
    }
    if (!isValidEmail(email)) {
      throw Errors.badRequest('Email must be a valid email address')
    }
  }

  // Validate optional phone
  const phone = body.phone ? body.phone.trim() : null
  if (phone) {
    if (phone.length > GROUP_PHONE_MAX) {
      throw Errors.badRequest(
        `Phone must not exceed ${GROUP_PHONE_MAX} characters`
      )
    }
    if (!isValidPhone(phone)) {
      throw Errors.badRequest('Phone must be a valid phone number')
    }
  }

  // Validate optional socials
  let socialsJson: string | null = null
  if (body.socials) {
    if (!isValidSocials(body.socials)) {
      throw Errors.badRequest('Socials must be an object with string values')
    }
    socialsJson = JSON.stringify(body.socials)
  }

  // Generate slug from name
  const baseSlug = generateSlug(name)
  if (!baseSlug) {
    throw Errors.badRequest(
      'Group name must contain at least one alphanumeric character'
    )
  }

  // Ensure slug is unique globally
  const slug = await generateUniqueGroupSlug(db, baseSlug)

  // Generate group ID
  const groupId = `grp_${nanoid()}`

  // Create group record
  const now = new Date().toISOString()

  try {
    // Start transaction to create group and add creator as owner
    await db
      .prepare(
        `INSERT INTO groups (id, slug, name, website, email, phone, socials, logo_url, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        groupId,
        slug,
        name,
        website,
        email,
        phone,
        socialsJson,
        null, // logo_url
        userId,
        now,
        now
      )
      .run()

    // Add creator as owner
    await db
      .prepare(
        `INSERT INTO group_members (group_id, user_id, role, joined_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(groupId, userId, 'owner', now)
      .run()
  } catch (err: any) {
    console.error('[Group Create Error]', err)

    // Check for UNIQUE constraint violation (slug already exists)
    if (err.message?.includes('UNIQUE constraint failed')) {
      throw Errors.conflict(
        'A group with this name already exists'
      )
    }

    throw Errors.internal('Failed to create group', { originalError: err.message })
  }

  // Fetch and return created group
  const createdRow = await db
    .prepare('SELECT * FROM groups WHERE id = ?')
    .bind(groupId)
    .first<GroupRow>()

  if (!createdRow) {
    throw Errors.internal('Failed to retrieve created group')
  }

  const group = groupRowToApi(createdRow, 1, true)

  return c.json({ data: group }, 201)
})

export default groupsRouter
```

**Explanation:**
- Validates all optional fields: website (URL), email (email format), phone (phone format), socials (object)
- Enforces field length limits
- Generates URL-safe slug from name
- Ensures slug uniqueness globally
- Uses `nanoid()` for group ID generation
- Automatically adds creator as owner in group_members table
- Sets timestamps and creates two records in transaction
- Returns 201 Created with full group object
- Detailed error messages for validation failures

---

### Step 4: Register Group Routes in Main API

Add the groups router to the main Hono app.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Update the imports and routing section:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { HonoEnv } from '../../types/env'
import { apiErrorHandler } from './errors'
import { groupsRouter } from './routes/groups'  // Add this import

// Initialize Hono app with strict typing
export const app = new Hono<HonoEnv>()

// ... CORS middleware setup (unchanged) ...

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Mount group routes
app.route('/groups', groupsRouter)  // Add this line

// Global error handler (must be last)
app.onError(apiErrorHandler)

export default app
```

**Explanation:**
- Imports the groups router
- Mounts it at `/groups` path, making routes accessible at `/api/groups/*`
- Router inherits auth middleware and error handling from main app

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/group.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/group.ts`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Add groups router import and route mounting

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 2: Create a Group (Missing Authentication)

Start the development server:

```bash
npx wrangler pages dev
```

In another terminal:

```bash
curl -X POST http://localhost:8788/api/groups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Studio Alpha"
  }'
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

### Test 3: Create a Group (With Authentication)

First, obtain a valid JWT token from the authentication endpoint. Assuming you have a valid token:

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
      "twitter": "@studioalpha",
      "instagram": "studioalpha"
    }
  }'
```

Expected response (201):
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
    "createdAt": "2026-01-18T12:00:00.000Z",
    "updatedAt": "2026-01-18T12:00:00.000Z",
    "memberCount": 1,
    "isOwner": true
  }
}
```

---

### Test 4: Slug Generation

Create group with name requiring normalization:

```bash
curl -X POST http://localhost:8788/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"name": "Studio & Alpha (2025)"}'
```

Expected: `"slug": "studio-alpha-2025"` (special characters removed, spaces converted to hyphens)

---

### Test 5: Slug Uniqueness

Create two groups with different names that generate same slug:

```bash
# First group
curl -X POST http://localhost:8788/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"name": "Studio Alpha"}'

# Second group - will get slug with suffix
curl -X POST http://localhost:8788/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"name": "Studio-Alpha"}'
```

Expected slugs:
- First: `"slug": "studio-alpha"`
- Second: `"slug": "studio-alpha-1"`

---

### Test 6: Validation - Invalid Email

```bash
curl -X POST http://localhost:8788/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "name": "Test Group",
    "email": "invalid-email"
  }'
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

### Test 7: Validation - Invalid URL

```bash
curl -X POST http://localhost:8788/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "name": "Test Group",
    "website": "not-a-url"
  }'
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

### Test 8: Validation - Invalid Phone

```bash
curl -X POST http://localhost:8788/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "name": "Test Group",
    "phone": "123"
  }'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Phone must be a valid phone number"
  }
}
```

---

### Test 9: Validation - Missing Name Field

```bash
curl -X POST http://localhost:8788/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"email": "contact@example.com"}'
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Field \"name\" is required"
  }
}
```

---

### Test 10: Database Verification

Verify group and creator as owner were created:

```bash
wrangler d1 execute vfa-gallery --command="SELECT * FROM groups ORDER BY created_at DESC LIMIT 1;"
```

Expected: Shows the created group with all fields.

Verify creator is owner:

```bash
wrangler d1 execute vfa-gallery --command="SELECT * FROM group_members WHERE role='owner' ORDER BY joined_at DESC LIMIT 1;"
```

Expected: Shows creator user in owner role.

---

## Success Criteria

- [ ] All files created with correct paths
- [ ] TypeScript compilation succeeds
- [ ] POST /api/groups endpoint responds with 401 without authentication
- [ ] POST /api/groups endpoint creates group and returns 201 with authenticated request
- [ ] Group is created with all provided fields (name, website, email, phone, socials)
- [ ] Slug is generated correctly from group name
- [ ] Slug is globally unique with numeric suffix for conflicts
- [ ] Special characters in name are removed from slug
- [ ] Email validation enforces valid format
- [ ] Phone validation enforces valid format
- [ ] Website URL validation enforces valid format
- [ ] Socials object validation enforces object with string values
- [ ] Creator is automatically added as owner in group_members
- [ ] Validation errors return 400 with descriptive messages
- [ ] Group record is created in database with correct fields
- [ ] Group ID is unique (uses nanoid)
- [ ] Created/updated timestamps are set to current time
- [ ] Response includes memberCount (1) and isOwner (true)

---

## Next Steps

Once this build is verified, proceed to **122-API-GROUP-LIST.md** to add pagination and listing functionality for groups.
