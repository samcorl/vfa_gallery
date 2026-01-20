# Build 139: PATCH /api/admin/users/:id Endpoint

## Goal
Create the `PATCH /api/admin/users/:id` endpoint that allows admins to update user status, role, and per-user limits (gallery_limit, collection_limit, artwork_limit, daily_upload_limit). Essential for managing user capabilities and privileges.

---

## Spec Extract

**Request Body (all fields optional):**
```json
{
  "status": "active",
  "role": "user",
  "galleryLimit": 500,
  "collectionLimit": 1000,
  "artworkLimit": 5000,
  "dailyUploadLimit": 10
}
```

**Valid Values:**
- `status`: 'pending', 'active', 'suspended', 'deleted'
- `role`: 'user', 'admin'
- `galleryLimit`: integer >= 1 (max user value)
- `collectionLimit`: integer >= 1 (max user value)
- `artworkLimit`: integer >= 1 (max user value)
- `dailyUploadLimit`: integer >= 1 (max user value)

**Response (200 OK):**
```json
{
  "id": "usr_abc123",
  "username": "artist-name",
  "email": "artist@example.com",
  "status": "active",
  "role": "user",
  "galleryLimit": 500,
  "collectionLimit": 1000,
  "artworkLimit": 5000,
  "dailyUploadLimit": 10,
  "updatedAt": "2024-01-19T15:30:00Z"
}
```

**Errors:**
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User is not admin
- 404 Not Found: User not found
- 400 Bad Request: Invalid field values

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware
- **138-API-ADMIN-USERS-GET.md** - Admin user get endpoint
- **06-SCHEMA-USERS.md** - Users table with status, role, limits columns

**Reason:** Endpoint requires admin auth and modifies user records.

---

## Steps

### Step 1: Create Validation Module for User Updates

Create validation rules for admin user updates.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/admin-users.ts` (append)

Add these functions:

```typescript
/**
 * Admin user update input
 */
export interface AdminUpdateUserInput {
  status?: string;
  role?: string;
  galleryLimit?: number;
  collectionLimit?: number;
  artworkLimit?: number;
  dailyUploadLimit?: number;
}

/**
 * Valid user statuses
 */
const VALID_STATUSES = ['pending', 'active', 'suspended', 'deleted'];

/**
 * Valid user roles
 */
const VALID_ROLES = ['user', 'admin'];

/**
 * Validate admin user update input
 */
export function validateAdminUpdateUser(input: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate status
  if ('status' in input && input.status !== null && input.status !== undefined) {
    if (typeof input.status !== 'string') {
      errors.push({
        field: 'status',
        message: 'status must be a string',
      });
    } else if (!VALID_STATUSES.includes(input.status)) {
      errors.push({
        field: 'status',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }
  }

  // Validate role
  if ('role' in input && input.role !== null && input.role !== undefined) {
    if (typeof input.role !== 'string') {
      errors.push({
        field: 'role',
        message: 'role must be a string',
      });
    } else if (!VALID_ROLES.includes(input.role)) {
      errors.push({
        field: 'role',
        message: `role must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }
  }

  // Validate galleryLimit
  if ('galleryLimit' in input && input.galleryLimit !== null && input.galleryLimit !== undefined) {
    const limit = parseInt(input.galleryLimit);
    if (isNaN(limit) || limit < 1) {
      errors.push({
        field: 'galleryLimit',
        message: 'galleryLimit must be a positive integer',
      });
    } else if (limit > 10000) {
      errors.push({
        field: 'galleryLimit',
        message: 'galleryLimit cannot exceed 10000',
      });
    }
  }

  // Validate collectionLimit
  if ('collectionLimit' in input && input.collectionLimit !== null && input.collectionLimit !== undefined) {
    const limit = parseInt(input.collectionLimit);
    if (isNaN(limit) || limit < 1) {
      errors.push({
        field: 'collectionLimit',
        message: 'collectionLimit must be a positive integer',
      });
    } else if (limit > 10000) {
      errors.push({
        field: 'collectionLimit',
        message: 'collectionLimit cannot exceed 10000',
      });
    }
  }

  // Validate artworkLimit
  if ('artworkLimit' in input && input.artworkLimit !== null && input.artworkLimit !== undefined) {
    const limit = parseInt(input.artworkLimit);
    if (isNaN(limit) || limit < 1) {
      errors.push({
        field: 'artworkLimit',
        message: 'artworkLimit must be a positive integer',
      });
    } else if (limit > 100000) {
      errors.push({
        field: 'artworkLimit',
        message: 'artworkLimit cannot exceed 100000',
      });
    }
  }

  // Validate dailyUploadLimit
  if ('dailyUploadLimit' in input && input.dailyUploadLimit !== null && input.dailyUploadLimit !== undefined) {
    const limit = parseInt(input.dailyUploadLimit);
    if (isNaN(limit) || limit < 1) {
      errors.push({
        field: 'dailyUploadLimit',
        message: 'dailyUploadLimit must be a positive integer',
      });
    } else if (limit > 1000) {
      errors.push({
        field: 'dailyUploadLimit',
        message: 'dailyUploadLimit cannot exceed 1000',
      });
    }
  }

  return errors;
}

/**
 * Sanitize admin update input
 */
export function sanitizeAdminUpdateUser(input: any): AdminUpdateUserInput {
  const sanitized: AdminUpdateUserInput = {};

  if ('status' in input && input.status) {
    sanitized.status = input.status;
  }
  if ('role' in input && input.role) {
    sanitized.role = input.role;
  }
  if ('galleryLimit' in input && input.galleryLimit !== null && input.galleryLimit !== undefined) {
    sanitized.galleryLimit = Math.max(1, parseInt(input.galleryLimit));
  }
  if ('collectionLimit' in input && input.collectionLimit !== null && input.collectionLimit !== undefined) {
    sanitized.collectionLimit = Math.max(1, parseInt(input.collectionLimit));
  }
  if ('artworkLimit' in input && input.artworkLimit !== null && input.artworkLimit !== undefined) {
    sanitized.artworkLimit = Math.max(1, parseInt(input.artworkLimit));
  }
  if ('dailyUploadLimit' in input && input.dailyUploadLimit !== null && input.dailyUploadLimit !== undefined) {
    sanitized.dailyUploadLimit = Math.max(1, parseInt(input.dailyUploadLimit));
  }

  return sanitized;
}
```

---

### Step 2: Create Database Update Function

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/admin/users.ts` (append)

Add this function:

```typescript
/**
 * Update user details (status, role, limits)
 */
export async function updateUser(
  db: D1Database,
  userId: string,
  updates: {
    status?: string;
    role?: string;
    galleryLimit?: number;
    collectionLimit?: number;
    artworkLimit?: number;
    dailyUploadLimit?: number;
  }
): Promise<{ id: string; status: string; role: string; updatedAt: string } | null> {
  // Build dynamic UPDATE query
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.role !== undefined) {
    setClauses.push('role = ?');
    values.push(updates.role);
  }
  if (updates.galleryLimit !== undefined) {
    setClauses.push('gallery_limit = ?');
    values.push(updates.galleryLimit);
  }
  if (updates.collectionLimit !== undefined) {
    setClauses.push('collection_limit = ?');
    values.push(updates.collectionLimit);
  }
  if (updates.artworkLimit !== undefined) {
    setClauses.push('artwork_limit = ?');
    values.push(updates.artworkLimit);
  }
  if (updates.dailyUploadLimit !== undefined) {
    setClauses.push('daily_upload_limit = ?');
    values.push(updates.dailyUploadLimit);
  }

  // Always update the updated_at timestamp
  setClauses.push("updated_at = datetime('now')");

  if (setClauses.length === 1) {
    // No updates to make (only updated_at was set)
    return null;
  }

  values.push(userId);

  const query = `
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id = ?
    RETURNING id, status, role, updated_at as updatedAt
  `;

  const result = await db.prepare(query).bind(...values).first<any>();

  return result || null;
}
```

---

### Step 3: Create API Route Handler

Create the PATCH endpoint for updating user details.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/users-update.ts`

```typescript
/**
 * PATCH /api/admin/users/:id - Update user status, role, and limits
 */

import type { HonoContext } from '../../../../types/env';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { Errors } from '../../errors';
import { validateUserId } from '../../../validation/admin-users';
import { validateAdminUpdateUser, sanitizeAdminUpdateUser } from '../../../validation/admin-users';
import { updateUser, getUserById } from '../../../db/admin/users';

/**
 * Response type for update
 */
interface UpdateUserResponse {
  id: string;
  username: string;
  email: string;
  status: string;
  role: string;
  galleryLimit: number;
  collectionLimit: number;
  artworkLimit: number;
  dailyUploadLimit: number;
  updatedAt: string;
}

/**
 * Handler for PATCH /api/admin/users/:id
 */
export async function handleUpdateAdminUser(c: HonoContext) {
  // Middleware ensures user is authenticated admin
  const userId = c.req.param('id');

  // Validate user ID
  const validation = validateUserId(userId);
  if (!validation.valid) {
    throw Errors.badRequest(validation.error);
  }

  // Parse request body
  let input: any;
  try {
    input = await c.req.json();
  } catch (error) {
    throw Errors.badRequest('Invalid JSON in request body');
  }

  // Validate update input
  const validationErrors = validateAdminUpdateUser(input);
  if (validationErrors.length > 0) {
    throw Errors.badRequest('Invalid update fields', {
      errors: validationErrors,
    });
  }

  // Sanitize input
  const sanitized = sanitizeAdminUpdateUser(input);

  // Check if there are any updates to make
  if (Object.keys(sanitized).length === 0) {
    throw Errors.badRequest('No valid fields to update');
  }

  try {
    const db = c.env.DB;

    // Verify user exists first
    const existingUser = await getUserById(db, userId);
    if (!existingUser) {
      throw Errors.notFound('User not found');
    }

    // Update the user
    const updated = await updateUser(db, userId, sanitized);

    if (!updated) {
      throw Errors.internal('Failed to update user');
    }

    // Build response with complete data
    const response: UpdateUserResponse = {
      id: updated.id,
      username: existingUser.username,
      email: existingUser.email,
      status: updated.status,
      role: updated.role,
      galleryLimit: sanitized.galleryLimit || existingUser.galleryLimit,
      collectionLimit: sanitized.collectionLimit || existingUser.collectionLimit,
      artworkLimit: sanitized.artworkLimit || existingUser.artworkLimit,
      dailyUploadLimit: sanitized.dailyUploadLimit || existingUser.dailyUploadLimit,
      updatedAt: updated.updatedAt,
    };

    return c.json(response);
  } catch (error) {
    if (error instanceof Error && (error.message === 'User not found' || error.message.includes('NOT_FOUND'))) {
      throw error;
    }
    console.error('[Admin User Update] Database error:', error);
    throw Errors.internal('Failed to update user');
  }
}

/**
 * Register route with middleware
 */
export function registerAdminUsersUpdateRoute(app: any) {
  app.patch('/api/admin/users/:id', requireAuth, requireAdmin, handleUpdateAdminUser);
}
```

---

### Step 4: Update Main API File

Update the main Hono app to register the new endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add these lines:

```typescript
// Add import
import { registerAdminUsersUpdateRoute } from './routes/admin/users-update'

// Add route registration
registerAdminUsersUpdateRoute(app)
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/users-update.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/admin/users.ts` - Add updateUser function
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/admin-users.ts` - Add validation functions
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Add route registration

---

## Verification

### Test 1: Update User Status

Update a user's status from 'pending' to 'active':

```bash
curl -X PATCH \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}' \
  http://localhost:8788/api/admin/users/usr_abc123
```

Expected response (200):
```json
{
  "id": "usr_abc123",
  "username": "artist-name",
  "email": "artist@example.com",
  "status": "active",
  "role": "user",
  "galleryLimit": 500,
  "collectionLimit": 1000,
  "artworkLimit": 5000,
  "dailyUploadLimit": 10,
  "updatedAt": "2024-01-19T15:30:00Z"
}
```

---

### Test 2: Update Multiple Fields

Update status, role, and limits:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active",
    "role": "user",
    "galleryLimit": 1000,
    "artworkLimit": 10000
  }' \
  http://localhost:8788/api/admin/users/usr_abc123
```

Expected response (200) with all fields updated.

---

### Test 3: Promote to Admin

Change user role to admin:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}' \
  http://localhost:8788/api/admin/users/usr_abc123
```

Expected response (200) with `role: "admin"`.

---

### Test 4: Invalid Status Value

Send invalid status:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid"}' \
  http://localhost:8788/api/admin/users/usr_abc123
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid update fields",
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

### Test 5: Gallery Limit Too High

Send limit exceeding maximum:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryLimit": 50000}' \
  http://localhost:8788/api/admin/users/usr_abc123
```

Expected response (400) with validation error.

---

### Test 6: Negative Limit

Send negative limit:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"artworkLimit": -5}' \
  http://localhost:8788/api/admin/users/usr_abc123
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid update fields",
    "errors": [
      {
        "field": "artworkLimit",
        "message": "artworkLimit must be a positive integer"
      }
    ]
  }
}
```

---

### Test 7: No Fields to Update

Send empty body:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:8788/api/admin/users/usr_abc123
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "No valid fields to update"
  }
}
```

---

### Test 8: User Not Found

Update non-existent user:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}' \
  http://localhost:8788/api/admin/users/usr_nonexistent
```

Expected response (404):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

---

### Test 9: Without Admin Role

Update as non-admin:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended"}' \
  http://localhost:8788/api/admin/users/usr_abc123
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

### Test 10: Verify Database Update

After updating a user, verify the change persists:

```bash
# Update the user
curl -X PATCH \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"galleryLimit": 750}' \
  http://localhost:8788/api/admin/users/usr_abc123

# Fetch the user to confirm
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123 | jq '.galleryLimit'
```

Expected: Both responses show `galleryLimit: 750`.

---

## Summary

This build creates a comprehensive user update endpoint with:
- Status management (pending, active, suspended, deleted)
- Role assignment (user, admin)
- Per-user limit configuration (galleries, collections, artworks, daily uploads)
- Comprehensive validation of all update fields
- Atomic database updates with timestamp tracking
- Admin-only access control
- Detailed error responses for invalid input

Enables admins to fully manage user accounts and resource limits.

---

**Next step:** Proceed to **140-API-ADMIN-USERS-SUSPEND.md** to create the user suspension endpoint.
