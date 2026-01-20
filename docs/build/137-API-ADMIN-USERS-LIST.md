# Build 137: GET /api/admin/users Endpoint

## Goal
Create the `GET /api/admin/users` endpoint that returns a searchable, paginated list of all users with status, role, and artwork count information. Admins use this to manage users and identify accounts needing action.

---

## Spec Extract

**Query Parameters:**
```
- page: integer (default: 1)
- limit: integer (default: 20, max: 100)
- search: string (optional, search by username or email)
- status: string (optional, filter by status: 'pending', 'active', 'suspended', 'deleted')
- sort: string (optional, default: 'created_at', values: 'created_at', 'updated_at', 'username')
- order: string (optional, default: 'desc', values: 'asc', 'desc')
```

**Response (200 OK):**
```json
{
  "users": [
    {
      "id": "usr_abc123",
      "username": "artist-name",
      "email": "artist@example.com",
      "displayName": "Artist Name",
      "status": "active",
      "role": "user",
      "artworkCount": 42,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T13:45:00Z",
      "lastLoginAt": "2024-01-18T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  }
}
```

**Errors:**
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User is not admin
- 400 Bad Request: Invalid pagination or filter values

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware
- **06-SCHEMA-USERS.md** - Users table must exist
- **26-SCHEMA-ARTWORKS.md** - Artworks table for counting

**Reason:** Endpoint requires admin authentication and must query users and artwork counts from database.

---

## Steps

### Step 1: Create Admin Users Validation Module

Create validation rules for user list queries.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/admin-users.ts`

```typescript
/**
 * Validation for admin user list endpoints
 */

export interface ListUsersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  sort?: string;
  order?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Valid sort fields for user list
 */
const VALID_SORT_FIELDS = ['created_at', 'updated_at', 'username'];

/**
 * Valid status filters
 */
const VALID_STATUSES = ['pending', 'active', 'suspended', 'deleted'];

/**
 * Validate user list query parameters
 */
export function validateListUsersQuery(query: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate page
  const page = parseInt(query.page || '1');
  if (isNaN(page) || page < 1) {
    errors.push({
      field: 'page',
      message: 'page must be a positive integer',
    });
  }

  // Validate limit
  const limit = parseInt(query.limit || '20');
  if (isNaN(limit) || limit < 1 || limit > 100) {
    errors.push({
      field: 'limit',
      message: 'limit must be between 1 and 100',
    });
  }

  // Validate search
  if (query.search && typeof query.search !== 'string') {
    errors.push({
      field: 'search',
      message: 'search must be a string',
    });
  }
  if (query.search && query.search.length > 255) {
    errors.push({
      field: 'search',
      message: 'search must be 255 characters or less',
    });
  }

  // Validate status filter
  if (query.status && !VALID_STATUSES.includes(query.status)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  // Validate sort
  if (query.sort && !VALID_SORT_FIELDS.includes(query.sort)) {
    errors.push({
      field: 'sort',
      message: `sort must be one of: ${VALID_SORT_FIELDS.join(', ')}`,
    });
  }

  // Validate order
  if (query.order && !['asc', 'desc'].includes(query.order)) {
    errors.push({
      field: 'order',
      message: 'order must be "asc" or "desc"',
    });
  }

  return errors;
}

/**
 * Parse and sanitize query parameters
 */
export function parseListUsersQuery(query: any): ListUsersQuery {
  return {
    page: Math.max(1, parseInt(query.page || '1')),
    limit: Math.min(100, Math.max(1, parseInt(query.limit || '20'))),
    search: query.search?.trim() || undefined,
    status: query.status || undefined,
    sort: query.sort || 'created_at',
    order: query.order || 'desc',
  };
}
```

---

### Step 2: Create Database Query Module

Create a database access module for fetching users and counting artworks.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/admin/users.ts`

```typescript
/**
 * Database queries for admin user management
 */

import type { D1Database } from '@cloudflare/workers-types';
import { generateId } from '../../id-generator';

export interface UserWithCount {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  status: string;
  role: string;
  artworkCount: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface ListUsersResult {
  users: UserWithCount[];
  total: number;
}

/**
 * Fetch paginated list of users with artwork counts
 */
export async function listUsers(
  db: D1Database,
  page: number,
  limit: number,
  search?: string,
  status?: string,
  sort: string = 'created_at',
  order: string = 'desc'
): Promise<ListUsersResult> {
  // Build WHERE clause
  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    conditions.push('(u.username LIKE ? OR u.email LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }

  if (status) {
    conditions.push('u.status = ?');
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate sort and order to prevent SQL injection
  const validSort = ['created_at', 'updated_at', 'username'].includes(sort) ? sort : 'created_at';
  const validOrder = ['asc', 'desc'].includes(order.toLowerCase()) ? order.toUpperCase() : 'DESC';

  // Build the main query
  const offset = (page - 1) * limit;

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as count FROM users u
    ${whereClause}
  `;

  const countResult = await db.prepare(countQuery).bind(...params).first<{ count: number }>();
  const total = countResult?.count || 0;

  // Get paginated users with artwork counts
  const usersQuery = `
    SELECT
      u.id,
      u.username,
      u.email,
      u.display_name as displayName,
      u.status,
      u.role,
      COUNT(a.id) as artworkCount,
      u.created_at as createdAt,
      u.updated_at as updatedAt,
      u.last_login_at as lastLoginAt
    FROM users u
    LEFT JOIN artworks a ON u.id = a.user_id
    ${whereClause}
    GROUP BY u.id
    ORDER BY u.${validSort} ${validOrder}
    LIMIT ? OFFSET ?
  `;

  const bindParams = [...params, limit, offset];
  const users = await db.prepare(usersQuery).bind(...bindParams).all<UserWithCount>();

  return {
    users: users.results || [],
    total,
  };
}
```

---

### Step 3: Create API Route

Create the GET endpoint for listing users.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/users-list.ts`

```typescript
/**
 * GET /api/admin/users - List all users with pagination and filtering
 */

import type { HonoContext } from '../../../../types/env';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { Errors } from '../../errors';
import { validateListUsersQuery, parseListUsersQuery } from '../../../validation/admin-users';
import { listUsers } from '../../../db/admin/users';

/**
 * Handler for GET /api/admin/users
 */
export async function handleListAdminUsers(c: HonoContext) {
  // Middleware ensures user is authenticated admin
  const query = c.req.query();

  // Validate query parameters
  const validationErrors = validateListUsersQuery(query);
  if (validationErrors.length > 0) {
    throw Errors.badRequest('Invalid query parameters', {
      errors: validationErrors,
    });
  }

  // Parse and sanitize parameters
  const { page, limit, search, status, sort, order } = parseListUsersQuery(query);

  try {
    // Query database
    const db = c.env.DB;
    const result = await listUsers(db, page, limit, search, status, sort, order);

    // Calculate pagination info
    const totalPages = Math.ceil(result.total / limit);

    return c.json({
      users: result.users,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: totalPages,
      },
    });
  } catch (error) {
    console.error('[Admin Users List] Database error:', error);
    throw Errors.internal('Failed to fetch users');
  }
}

/**
 * Register route with middleware
 */
export function registerAdminUsersListRoute(app: any) {
  app.get('/api/admin/users', requireAuth, requireAdmin, handleListAdminUsers);
}
```

---

### Step 4: Update Main API File

Update the main Hono app to register the new endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add these lines in the appropriate route registration section:

```typescript
// Add import
import { registerAdminUsersListRoute } from './routes/admin/users-list'

// Add route registration (inside your app initialization or routes section)
registerAdminUsersListRoute(app)
```

---

### Step 5: Add Type Definitions

Ensure the response types are properly typed.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/admin.ts` (create if not exists)

```typescript
/**
 * Admin API response types
 */

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  status: string;
  role: string;
  artworkCount: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface ListUsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/admin-users.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/admin/users.ts`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/users-list.ts`
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/admin.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Add route registration

---

## Verification

### Test 1: TypeScript Compilation

Run the TypeScript compiler to ensure no type errors:

```bash
npx tsc --noEmit
```

Expected: No type errors in the new files.

---

### Test 2: List All Users Without Filters

Request all users with defaults:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users
```

Expected response (200):
```json
{
  "users": [
    {
      "id": "usr_001",
      "username": "artist-one",
      "email": "artist1@example.com",
      "displayName": "Artist One",
      "status": "active",
      "role": "user",
      "artworkCount": 15,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T13:45:00Z",
      "lastLoginAt": "2024-01-18T10:30:00Z"
    },
    {
      "id": "usr_002",
      "username": "artist-two",
      "email": "artist2@example.com",
      "displayName": "Artist Two",
      "status": "active",
      "role": "user",
      "artworkCount": 28,
      "createdAt": "2024-01-02T00:00:00Z",
      "updatedAt": "2024-01-16T14:20:00Z",
      "lastLoginAt": "2024-01-19T08:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "pages": 3
  }
}
```

---

### Test 3: Filter by Status

Request users with status='suspended':

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8788/api/admin/users?status=suspended"
```

Expected: Returns only users with `status: 'suspended'`.

---

### Test 4: Search by Username

Request users matching search pattern:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8788/api/admin/users?search=artist"
```

Expected: Returns users whose username or email contains 'artist'.

---

### Test 5: Search by Email

Request users by email:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8788/api/admin/users?search=example.com"
```

Expected: Returns users whose email contains 'example.com'.

---

### Test 6: Pagination

Request second page with limit:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8788/api/admin/users?page=2&limit=10"
```

Expected response includes:
- Users from positions 11-20 (offset = 10)
- `pagination.page = 2`
- `pagination.limit = 10`

---

### Test 7: Sorting

Request sorted by username ascending:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8788/api/admin/users?sort=username&order=asc"
```

Expected: Users sorted alphabetically by username.

---

### Test 8: Invalid Status Filter

Request with invalid status:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8788/api/admin/users?status=invalid"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid query parameters",
    "errors": [
      {
        "field": "status",
        "message": "status must be one of: pending, active, suspended, deleted"
      }
    ]
  }
}
```

---

### Test 9: Invalid Limit

Request with out-of-range limit:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8788/api/admin/users?limit=200"
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid query parameters",
    "errors": [
      {
        "field": "limit",
        "message": "limit must be between 1 and 100"
      }
    ]
  }
}
```

---

### Test 10: Without Admin Role

Request as non-admin user:

```bash
curl -H "Authorization: Bearer <user-token>" \
  http://localhost:8788/api/admin/users
```

Expected response (403):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

---

### Test 11: Artwork Count Accuracy

Verify artwork counts are correct by querying a specific user:

```bash
# Check admin response
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8788/api/admin/users?search=artist-one" | jq '.users[0].artworkCount'

# Verify in database
wrangler d1 execute vfa_gallery_db --command "SELECT COUNT(*) FROM artworks WHERE user_id='usr_001';"
```

Expected: Both should return the same count.

---

## Summary

This build creates a powerful admin user list endpoint with:
- Pagination support (configurable page and limit)
- Full-text search on username and email
- Status filtering (pending, active, suspended, deleted)
- Flexible sorting by created_at, updated_at, or username
- Artwork count aggregation for each user
- Comprehensive validation of query parameters
- Admin-only access control

The endpoint enables admins to quickly find and manage users across the platform.

---

**Next step:** Proceed to **138-API-ADMIN-USERS-GET.md** to create the endpoint for fetching individual user details.
