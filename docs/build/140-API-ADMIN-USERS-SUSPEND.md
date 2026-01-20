# Build 140: POST /api/admin/users/:id/suspend Endpoint

## Goal
Create the `POST /api/admin/users/:id/suspend` endpoint that suspends a user account (sets status='suspended'), logs the action to activity history, and returns confirmation. Used to quickly deactivate user accounts for violations or other issues.

---

## Spec Extract

**Request:**
```
POST /api/admin/users/{userId}/suspend
```

**Request Body (optional):**
```json
{
  "reason": "Inappropriate content"
}
```

**Response (200 OK):**
```json
{
  "id": "usr_abc123",
  "username": "artist-name",
  "email": "artist@example.com",
  "status": "suspended",
  "suspendedAt": "2024-01-19T15:45:00Z",
  "suspendedBy": "admin_id_123",
  "suspendReason": "Inappropriate content"
}
```

**Errors:**
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User is not admin
- 404 Not Found: User not found
- 409 Conflict: User already suspended
- 400 Bad Request: Invalid user ID or request body

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware
- **139-API-ADMIN-USERS-UPDATE.md** - User update endpoint
- **06-SCHEMA-USERS.md** - Users table with status column

**Reason:** Endpoint requires admin auth and modifies user status. Should also have activity logging table.

---

## Steps

### Step 1: Extend Admin Users Database Module

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/admin/users.ts` (append)

Add these functions:

```typescript
/**
 * Suspend a user account
 */
export async function suspendUser(
  db: D1Database,
  userId: string,
  adminId: string,
  reason?: string
): Promise<{
  id: string;
  username: string;
  email: string;
  status: string;
  suspendedAt: string;
  suspendedBy: string;
  suspendReason: string | null;
} | null> {
  // Check if user exists and current status
  const user = await db
    .prepare(`SELECT id, username, email, status FROM users WHERE id = ?`)
    .bind(userId)
    .first<any>();

  if (!user) {
    return null;
  }

  // Check if already suspended
  if (user.status === 'suspended') {
    throw new Error('User is already suspended');
  }

  // Update user status to suspended
  const updateQuery = `
    UPDATE users
    SET status = 'suspended', updated_at = datetime('now')
    WHERE id = ?
    RETURNING id, username, email, status, updated_at as suspendedAt
  `;

  const updated = await db.prepare(updateQuery).bind(userId).first<any>();

  // Log activity (if activity_log table exists)
  try {
    const activityLogQuery = `
      INSERT INTO activity_logs (id, user_id, admin_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `;

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const details = JSON.stringify({
      reason: reason || null,
      previous_status: user.status,
    });

    await db
      .prepare(activityLogQuery)
      .bind(logId, userId, adminId, 'user_suspended', details)
      .run();
  } catch (error) {
    // Activity log table might not exist yet, continue without it
    console.warn('[Suspend User] Activity log failed:', error);
  }

  return {
    id: updated.id,
    username: updated.username,
    email: updated.email,
    status: updated.status,
    suspendedAt: updated.suspendedAt,
    suspendedBy: adminId,
    suspendReason: reason || null,
  };
}
```

---

### Step 2: Create Validation for Suspend Request

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/admin-users.ts` (append)

Add this validation:

```typescript
/**
 * Suspend user input
 */
export interface SuspendUserInput {
  reason?: string;
}

/**
 * Validate suspend user request
 */
export function validateSuspendUser(input: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate reason (optional but if provided must be string)
  if (input && 'reason' in input && input.reason !== null && input.reason !== undefined) {
    if (typeof input.reason !== 'string') {
      errors.push({
        field: 'reason',
        message: 'reason must be a string',
      });
    } else if (input.reason.length > 1000) {
      errors.push({
        field: 'reason',
        message: 'reason must be 1000 characters or less',
      });
    } else if (input.reason.trim().length === 0) {
      errors.push({
        field: 'reason',
        message: 'reason cannot be empty if provided',
      });
    }
  }

  return errors;
}

/**
 * Sanitize suspend input
 */
export function sanitizeSuspendUser(input: any): SuspendUserInput {
  const sanitized: SuspendUserInput = {};

  if (input && 'reason' in input && input.reason) {
    sanitized.reason = input.reason.trim();
  }

  return sanitized;
}
```

---

### Step 3: Create API Route Handler

Create the POST endpoint for suspending users.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/users-suspend.ts`

```typescript
/**
 * POST /api/admin/users/:id/suspend - Suspend a user account
 */

import type { HonoContext } from '../../../../types/env';
import { requireAuth, requireAdmin, requireCurrentUser } from '../../middleware/auth';
import { Errors } from '../../errors';
import { validateUserId } from '../../../validation/admin-users';
import { validateSuspendUser, sanitizeSuspendUser } from '../../../validation/admin-users';
import { suspendUser } from '../../../db/admin/users';

/**
 * Response type for suspend
 */
interface SuspendUserResponse {
  id: string;
  username: string;
  email: string;
  status: string;
  suspendedAt: string;
  suspendedBy: string;
  suspendReason: string | null;
}

/**
 * Handler for POST /api/admin/users/:id/suspend
 */
export async function handleSuspendAdminUser(c: HonoContext) {
  // Middleware ensures user is authenticated admin
  const adminUser = requireCurrentUser(c);
  const userId = c.req.param('id');

  // Validate user ID
  const validation = validateUserId(userId);
  if (!validation.valid) {
    throw Errors.badRequest(validation.error);
  }

  // Prevent admin from suspending themselves
  if (userId === adminUser.userId) {
    throw Errors.badRequest('Cannot suspend your own account');
  }

  // Parse request body
  let input: any = {};
  try {
    const contentType = c.req.header('content-type');
    if (contentType && contentType.includes('application/json')) {
      input = await c.req.json();
    }
  } catch (error) {
    throw Errors.badRequest('Invalid JSON in request body');
  }

  // Validate suspend input
  const validationErrors = validateSuspendUser(input);
  if (validationErrors.length > 0) {
    throw Errors.badRequest('Invalid suspend request', {
      errors: validationErrors,
    });
  }

  // Sanitize input
  const sanitized = sanitizeSuspendUser(input);

  try {
    const db = c.env.DB;

    // Suspend the user
    const result = await suspendUser(db, userId, adminUser.userId, sanitized.reason);

    if (!result) {
      throw Errors.notFound('User not found');
    }

    const response: SuspendUserResponse = result as SuspendUserResponse;

    return c.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('already suspended')) {
      throw Errors.conflict('User is already suspended');
    }
    if (errorMessage.includes('User not found')) {
      throw Errors.notFound('User not found');
    }

    console.error('[Suspend User] Error:', error);
    throw Errors.internal('Failed to suspend user');
  }
}

/**
 * Register route with middleware
 */
export function registerAdminUsersSuspendRoute(app: any) {
  app.post('/api/admin/users/:id/suspend', requireAuth, requireAdmin, handleSuspendAdminUser);
}
```

---

### Step 4: Update Main API File

Update the main Hono app to register the new endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add these lines:

```typescript
// Add import
import { registerAdminUsersSuspendRoute } from './routes/admin/users-suspend'

// Add route registration
registerAdminUsersSuspendRoute(app)
```

---

### Step 5: Add Error Response Types

Update the error handling if needed to include conflict errors.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/errors.ts` (verify/update)

Ensure there's a conflict error function:

```typescript
/**
 * Conflict error (409)
 */
export const conflict = (message: string, data?: any): ErrorResponse => {
  const error = new Error(message) as any;
  error.statusCode = 409;
  error.code = 'CONFLICT';
  error.data = data;
  return error;
};
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/users-suspend.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/admin/users.ts` - Add suspendUser function
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/admin-users.ts` - Add suspend validation
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Add route registration
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/errors.ts` - Verify conflict error exists

---

## Verification

### Test 1: Suspend Active User

Suspend a user account:

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Inappropriate content"}' \
  http://localhost:8788/api/admin/users/usr_abc123/suspend
```

Expected response (200):
```json
{
  "id": "usr_abc123",
  "username": "artist-name",
  "email": "artist@example.com",
  "status": "suspended",
  "suspendedAt": "2024-01-19T15:45:00Z",
  "suspendedBy": "admin_id_123",
  "suspendReason": "Inappropriate content"
}
```

---

### Test 2: Suspend Without Reason

Suspend without providing a reason:

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123/suspend
```

Expected response (200) with `suspendReason: null`.

---

### Test 3: Already Suspended User

Try to suspend a user that's already suspended:

```bash
# First suspension
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123/suspend

# Second suspension (should fail)
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123/suspend
```

Expected response (409):
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "User is already suspended"
  }
}
```

---

### Test 4: Self-Suspension Prevention

Try to suspend own account:

```bash
# Using an admin's own token to suspend themselves
curl -X POST \
  -H "Authorization: Bearer <admin-token-for-admin_id_123>" \
  http://localhost:8788/api/admin/users/admin_id_123/suspend
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Cannot suspend your own account"
  }
}
```

---

### Test 5: Reason Too Long

Send a reason exceeding 1000 characters:

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d "{\"reason\": \"$(python3 -c 'print("x" * 1001)')\"}" \
  http://localhost:8788/api/admin/users/usr_abc123/suspend
```

Expected response (400) with validation error.

---

### Test 6: User Not Found

Suspend non-existent user:

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_nonexistent/suspend
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

### Test 7: Non-Admin User

Attempt suspension as non-admin:

```bash
curl -X POST \
  -H "Authorization: Bearer <user-token>" \
  http://localhost:8788/api/admin/users/usr_abc123/suspend
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

### Test 8: Verify Status Change

Confirm the user's status changed in database:

```bash
# Suspend user
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123/suspend

# Fetch user to verify
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123 | jq '.status'
```

Expected: Both responses show `status: "suspended"`.

---

### Test 9: Activity Log Created

If activity_log table exists, verify entry was created:

```bash
wrangler d1 execute vfa_gallery_db --command \
  "SELECT action, details FROM activity_logs WHERE user_id='usr_abc123' AND action='user_suspended' LIMIT 1;"
```

Expected: Returns one row with `action: 'user_suspended'` and JSON details containing the reason.

---

## Summary

This build creates a user suspension endpoint with:
- Quick account suspension (sets status to suspended)
- Optional reason tracking for audit purposes
- Activity logging of suspension actions
- Self-suspension prevention
- Idempotency check (prevents duplicate suspensions)
- Admin-only access control
- Comprehensive error handling

Enables admins to quickly deactivate accounts for policy violations.

---

**Next step:** Proceed to **141-API-ADMIN-USERS-ACTIVATE.md** to create the user activation endpoint.
