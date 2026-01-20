# 122-API-GROUP-LIST.md

## Goal

Create the `GET /api/groups` endpoint to return a paginated public list of all groups with member count, sortable and filterable.

---

## Spec Extract

From TECHNICAL-SPEC.md - Group CRUD Operations:

- **Endpoint:** `GET /api/groups`
- **Authentication:** Not required (public endpoint)
- **Query Parameters:**
  - `page` (optional): Page number, default 1
  - `limit` (optional): Items per page, default 20, max 100
  - `sort` (optional): Sort field, default 'created_at', options: 'created_at', 'name', 'members'
  - `order` (optional): Sort order, default 'desc', options: 'asc', 'desc'
  - `search` (optional): Search by group name (case-insensitive partial match)

- **Response (200 OK):**
  ```json
  {
    "data": [
      {
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
        "memberCount": 5
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
  ```

---

## Prerequisites

**Must complete before starting:**
- **121-API-GROUP-CREATE.md** - Group creation endpoint and types defined
- **07-SCHEMA-GROUPS.md** - Groups and group_members tables created

---

## Steps

### Step 1: Create Pagination Types and Utilities

Add pagination utilities to support listing endpoints.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/pagination.ts`

```typescript
/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

/**
 * Parse and validate pagination parameters from query string
 */
export function parsePaginationParams(
  pageParam?: string,
  limitParam?: string
): PaginationParams {
  let page = 1
  let limit = 20

  if (pageParam) {
    const parsedPage = parseInt(pageParam, 10)
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage
    }
  }

  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10)
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      // Max limit of 100 to prevent abuse
      limit = Math.min(parsedLimit, 100)
    }
  }

  const offset = (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const pages = Math.ceil(total / limit)

  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  }
}

/**
 * Validate sort field and order
 */
export function validateSortParams(
  sort?: string,
  order?: string,
  validFields?: string[]
): { sortField: string; sortOrder: 'ASC' | 'DESC' } {
  const defaultFields = validFields || ['created_at', 'name', 'members']
  const sortField = sort && defaultFields.includes(sort) ? sort : 'created_at'
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC'

  return { sortField, sortOrder }
}
```

**Explanation:**
- `PaginationMeta` tracks page, limit, total count, total pages, and navigation flags
- `parsePaginationParams()` safely parses page/limit with defaults
- Enforces max limit of 100 to prevent expensive queries
- `validateSortParams()` ensures sort field is allowed

---

### Step 2: Extend Group Routes - List Endpoint

Add the list endpoint to the groups router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts`

Add this code after the POST handler:

```typescript
import {
  PaginatedResponse,
  parsePaginationParams,
  calculatePaginationMeta,
  validateSortParams,
} from '../utils/pagination'

/**
 * GET /groups
 * List all groups with pagination, search, and sorting
 * Public endpoint (no authentication required)
 */
groupsRouter.get('/', async (c) => {
  const db = c.env.DB

  // Parse pagination parameters
  const page = c.req.query('page')
  const limit = c.req.query('limit')
  const sort = c.req.query('sort')
  const order = c.req.query('order')
  const search = c.req.query('search')

  const { page: pageNum, limit: limitNum, offset } = parsePaginationParams(page, limit)
  const { sortField, sortOrder } = validateSortParams(sort, order, [
    'created_at',
    'name',
    'members',
  ])

  try {
    // Build WHERE clause for search
    let whereClause = ''
    let params: any[] = []

    if (search && search.trim()) {
      whereClause = 'WHERE groups.name LIKE ?'
      params.push(`%${search}%`)
    }

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as count FROM groups'
    if (whereClause) {
      countQuery += ` ${whereClause}`
    }

    const countResult = await db
      .prepare(countQuery)
      .bind(...params)
      .first<{ count: number }>()

    const total = countResult?.count || 0

    if (total === 0) {
      return c.json<PaginatedResponse<Group>>(
        {
          data: [],
          pagination: calculatePaginationMeta(pageNum, limitNum, 0),
        },
        200
      )
    }

    // Build main query with member count
    let query = `
      SELECT
        groups.*,
        COUNT(group_members.user_id) as member_count
      FROM groups
      LEFT JOIN group_members ON groups.id = group_members.group_id
    `

    if (whereClause) {
      query += ` ${whereClause}`
    }

    query += ` GROUP BY groups.id`

    // Add sorting
    if (sortField === 'members') {
      query += ` ORDER BY member_count ${sortOrder}`
    } else {
      query += ` ORDER BY groups.${sortField} ${sortOrder}`
    }

    // Add pagination
    query += ` LIMIT ? OFFSET ?`
    params.push(limitNum, offset)

    const groups = await db
      .prepare(query)
      .bind(...params)
      .all<GroupRow & { member_count: number }>()

    // Transform results
    const data = (groups.results || []).map((row) =>
      groupRowToApi(row, row.member_count)
    )

    return c.json<PaginatedResponse<Group>>(
      {
        data,
        pagination: calculatePaginationMeta(pageNum, limitNum, total),
      },
      200
    )
  } catch (err: any) {
    console.error('[Group List Error]', err)
    throw Errors.internal('Failed to fetch groups', { originalError: err.message })
  }
})
```

**Explanation:**
- Public endpoint (no authentication required)
- Supports pagination with page/limit query parameters
- Supports sorting by created_at, name, or member count
- Supports search by group name (case-insensitive)
- Counts group members using LEFT JOIN
- Returns pagination metadata with hasNext/hasPrev flags
- Properly escapes search query to prevent SQL injection

---

### Step 3: Add Response Type to Group Types File

Update the Group types file to export PaginatedResponse.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/group.ts`

Add at the top after imports:

```typescript
import type { PaginatedResponse } from '../lib/api/utils/pagination'

export type GroupListResponse = PaginatedResponse<Group>
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/utils/pagination.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/groups.ts` - Add GET / handler
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/group.ts` - Add import for PaginatedResponse

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 2: List Groups (Default Pagination)

```bash
curl http://localhost:8788/api/groups
```

Expected response (200):
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "pages": 0,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### Test 3: Create Test Data and List

First, create a few groups using the POST endpoint (see 121-API-GROUP-CREATE.md).

Then list with default pagination:

```bash
curl http://localhost:8788/api/groups
```

Expected response (200):
```json
{
  "data": [
    {
      "id": "grp_abc123",
      "slug": "studio-alpha",
      "name": "Studio Alpha",
      "memberCount": 1,
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### Test 4: List with Pagination

Create 25 groups, then request page 2:

```bash
curl "http://localhost:8788/api/groups?page=2&limit=20"
```

Expected response (200):
```json
{
  "data": [...5 items...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 25,
    "pages": 2,
    "hasNext": false,
    "hasPrev": true
  }
}
```

---

### Test 5: List with Custom Limit

```bash
curl "http://localhost:8788/api/groups?limit=5"
```

Expected response (200):
```json
{
  "data": [...5 items...],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 25,
    "pages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### Test 6: Limit Enforcement (Max 100)

```bash
curl "http://localhost:8788/api/groups?limit=500"
```

Expected: Returns with limit=100 (max enforced), not 500

---

### Test 7: Sort by Name (Ascending)

```bash
curl "http://localhost:8788/api/groups?sort=name&order=asc"
```

Expected: Groups sorted alphabetically by name

---

### Test 8: Sort by Member Count (Descending)

```bash
curl "http://localhost:8788/api/groups?sort=members&order=desc"
```

Expected: Groups sorted by member count, highest first

---

### Test 9: Search by Group Name

Create groups with names: "Studio Alpha", "Studio Beta", "Gallery Gamma"

```bash
curl "http://localhost:8788/api/groups?search=Studio"
```

Expected response: Only groups with "Studio" in name (2 groups)

---

### Test 10: Search Case-Insensitive

```bash
curl "http://localhost:8788/api/groups?search=studio"
```

Expected response: Same as Test 9 (case-insensitive)

---

### Test 11: Search with No Results

```bash
curl "http://localhost:8788/api/groups?search=nonexistent"
```

Expected response (200):
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "pages": 0,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### Test 12: Invalid Page Number

```bash
curl "http://localhost:8788/api/groups?page=abc"
```

Expected: Defaults to page 1

---

### Test 13: Member Count Accuracy

Create a group with multiple members (using the member management endpoint from 126).

```bash
curl http://localhost:8788/api/groups
```

Expected: Group shows accurate memberCount

---

### Test 14: Response Includes All Group Fields

```bash
curl "http://localhost:8788/api/groups?limit=1"
```

Expected: Each group object includes: id, slug, name, website, email, phone, socials, logoUrl, createdBy, createdAt, updatedAt, memberCount

---

## Success Criteria

- [ ] Pagination utilities file created
- [ ] GET /api/groups endpoint implemented
- [ ] TypeScript compilation succeeds
- [ ] Public endpoint (no authentication required)
- [ ] Returns paginated response with data and pagination metadata
- [ ] Pagination metadata includes: page, limit, total, pages, hasNext, hasPrev
- [ ] Page parameter works correctly
- [ ] Limit parameter works correctly with max of 100
- [ ] Sort by created_at works (default)
- [ ] Sort by name works
- [ ] Sort by member count works
- [ ] Order parameter (asc/desc) works correctly
- [ ] Search by name works (case-insensitive)
- [ ] Member count is accurate
- [ ] Invalid query parameters default to safe values
- [ ] Empty result returns valid pagination with empty data array
- [ ] Response includes all group fields

---

## Next Steps

Once this build is verified, proceed to **123-API-GROUP-GET.md** to fetch a single group by slug.
