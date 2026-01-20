# Build 141: POST /api/admin/users/:id/activate Endpoint

## Goal
Create the `POST /api/admin/users/:id/activate` endpoint that reactivates a suspended or pending user account (sets status='active'), logs the action to activity history, and returns confirmation. Used to approve new accounts or reinstate suspended users.

---

## Spec Extract

**Request:**
```
POST /api/admin/users/{userId}/activate
```

**Request Body (optional):**
```json
{
  "reason": "Appeals review completed"
}
```

**Response (200 OK):**
```json
{
  "id": "usr_abc123",
  "username": "artist-name",
  "email": "artist@example.com",
  "status": "active",
  "activatedAt": "2024-01-19T15:50:00Z",
  "activatedBy": "admin_id_123",
  "activationReason": "Appeals review completed"
}
```

**Errors:**
- 401 Unauthorized: Not authenticated
- 403 Forbidden: User is not admin
- 404 Not Found: User not found
- 409 Conflict: User already active
- 400 Bad Request: Invalid user ID or request body

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware
- **140-API-ADMIN-USERS-SUSPEND.md** - User suspension endpoint
- **06-SCHEMA-USERS.md** - Users table with status column

**Reason:** Endpoint mirrors suspend endpoint but activates accounts instead.

---

## Steps

### Step 1: Extend Admin Users Database Module

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/admin/users.ts` (append)

Add this function:

```typescript
/**
 * Activate a user account (from pending or suspended)
 */
export async function activateUser(
  db: D1Database,
  userId: string,
  adminId: string,
  reason?: string
): Promise<{
  id: string;
  username: string;
  email: string;
  status: string;
  activatedAt: string;
  activatedBy: string;
  activationReason: string | null;
} | null> {
  // Check if user exists and current status
  const user = await db
    .prepare(`SELECT id, username, email, status FROM users WHERE id = ?`)
    .bind(userId)
    .first<any>();

  if (!user) {
    return null;
  }

  // Check if already active
  if (user.status === 'active') {
    throw new Error('User is already active');
  }

  // Update user status to active
  const updateQuery = `
    UPDATE users
    SET status = 'active', updated_at = datetime('now')
    WHERE id = ?
    RETURNING id, username, email, status, updated_at as activatedAt
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
      .bind(logId, userId, adminId, 'user_activated', details)
      .run();
  } catch (error) {
    // Activity log table might not exist yet, continue without it
    console.warn('[Activate User] Activity log failed:', error);
  }

  return {
    id: updated.id,
    username: updated.username,
    email: updated.email,
    status: updated.status,
    activatedAt: updated.activatedAt,
    activatedBy: adminId,
    activationReason: reason || null,
  };
}
```

---

### Step 2: Create Validation for Activate Request

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/admin-users.ts` (append)

Add this validation:

```typescript
/**
 * Activate user input
 */
export interface ActivateUserInput {
  reason?: string;
}

/**
 * Validate activate user request
 */
export function validateActivateUser(input: any): ValidationError[] {
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
 * Sanitize activate input
 */
export function sanitizeActivateUser(input: any): ActivateUserInput {
  const sanitized: ActivateUserInput = {};

  if (input && 'reason' in input && input.reason) {
    sanitized.reason = input.reason.trim();
  }

  return sanitized;
}
```

---

### Step 3: Create API Route Handler

Create the POST endpoint for activating users.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/users-activate.ts`

```typescript
/**
 * POST /api/admin/users/:id/activate - Activate a user account
 */

import type { HonoContext } from '../../../../types/env';
import { requireAuth, requireAdmin, requireCurrentUser } from '../../middleware/auth';
import { Errors } from '../../errors';
import { validateUserId } from '../../../validation/admin-users';
import { validateActivateUser, sanitizeActivateUser } from '../../../validation/admin-users';
import { activateUser } from '../../../db/admin/users';

/**
 * Response type for activate
 */
interface ActivateUserResponse {
  id: string;
  username: string;
  email: string;
  status: string;
  activatedAt: string;
  activatedBy: string;
  activationReason: string | null;
}

/**
 * Handler for POST /api/admin/users/:id/activate
 */
export async function handleActivateAdminUser(c: HonoContext) {
  // Middleware ensures user is authenticated admin
  const adminUser = requireCurrentUser(c);
  const userId = c.req.param('id');

  // Validate user ID
  const validation = validateUserId(userId);
  if (!validation.valid) {
    throw Errors.badRequest(validation.error);
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

  // Validate activate input
  const validationErrors = validateActivateUser(input);
  if (validationErrors.length > 0) {
    throw Errors.badRequest('Invalid activation request', {
      errors: validationErrors,
    });
  }

  // Sanitize input
  const sanitized = sanitizeActivateUser(input);

  try {
    const db = c.env.DB;

    // Activate the user
    const result = await activateUser(db, userId, adminUser.userId, sanitized.reason);

    if (!result) {
      throw Errors.notFound('User not found');
    }

    const response: ActivateUserResponse = result as ActivateUserResponse;

    return c.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('already active')) {
      throw Errors.conflict('User is already active');
    }
    if (errorMessage.includes('User not found')) {
      throw Errors.notFound('User not found');
    }

    console.error('[Activate User] Error:', error);
    throw Errors.internal('Failed to activate user');
  }
}

/**
 * Register route with middleware
 */
export function registerAdminUsersActivateRoute(app: any) {
  app.post('/api/admin/users/:id/activate', requireAuth, requireAdmin, handleActivateAdminUser);
}
```

---

### Step 4: Update Main API File

Update the main Hono app to register the new endpoint.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Add these lines:

```typescript
// Add import
import { registerAdminUsersActivateRoute } from './routes/admin/users-activate'

// Add route registration
registerAdminUsersActivateRoute(app)
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/admin/users-activate.ts`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/admin/users.ts` - Add activateUser function
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/admin-users.ts` - Add activation validation
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Add route registration

---

## Verification

### Test 1: Activate Suspended User

Activate a previously suspended user:

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Appeals review completed"}' \
  http://localhost:8788/api/admin/users/usr_abc123/activate
```

Expected response (200):
```json
{
  "id": "usr_abc123",
  "username": "artist-name",
  "email": "artist@example.com",
  "status": "active",
  "activatedAt": "2024-01-19T15:50:00Z",
  "activatedBy": "admin_id_123",
  "activationReason": "Appeals review completed"
}
```

---

### Test 2: Activate Pending User

Activate a user with status='pending':

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Email verified"}' \
  http://localhost:8788/api/admin/users/usr_pending/activate
```

Expected response (200) with new status='active'.

---

### Test 3: Activate Without Reason

Activate without providing a reason:

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123/activate
```

Expected response (200) with `activationReason: null`.

---

### Test 4: Already Active User

Try to activate a user that's already active:

```bash
# First activation
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123/activate

# Second activation (should fail)
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123/activate
```

Expected response (409):
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "User is already active"
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
  http://localhost:8788/api/admin/users/usr_abc123/activate
```

Expected response (400) with validation error.

---

### Test 6: User Not Found

Activate non-existent user:

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_nonexistent/activate
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

Attempt activation as non-admin:

```bash
curl -X POST \
  -H "Authorization: Bearer <user-token>" \
  http://localhost:8788/api/admin/users/usr_abc123/activate
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

### Test 8: Suspend/Activate Cycle

Test complete suspend and activate cycle:

```bash
# Activate
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"reason": "Initial activation"}' \
  http://localhost:8788/api/admin/users/usr_abc123/activate

# Suspend
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"reason": "Violation"}' \
  http://localhost:8788/api/admin/users/usr_abc123/suspend

# Activate again
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"reason": "Reinstated"}' \
  http://localhost:8788/api/admin/users/usr_abc123/activate

# Verify final status
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123 | jq '.status'
```

Expected: Final status is 'active'.

---

### Test 9: Activity Log Created

If activity_log table exists, verify entries:

```bash
wrangler d1 execute vfa_gallery_db --command \
  "SELECT action, details FROM activity_logs WHERE user_id='usr_abc123' ORDER BY created_at DESC LIMIT 1;"
```

Expected: Returns one row with `action: 'user_activated'`.

---

### Test 10: Verify Status Change

Confirm the user's status changed in database:

```bash
# Get user before activation
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123 | jq '.status'

# Activate user
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123/activate

# Get user after activation
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8788/api/admin/users/usr_abc123 | jq '.status'
```

Expected: Status changes to 'active' in second query.

---

## Summary

This build creates a user activation endpoint with:
- Activation of suspended or pending accounts
- Optional reason tracking for audit purposes
- Activity logging of activation actions
- Prevents double-activation of active accounts
- Admin-only access control
- Mirrors suspend endpoint for consistency
- Comprehensive error handling

Enables admins to approve new accounts and reinstate suspended users.

---

**Next step:** Proceed to **142-UI-ADMIN-USERS.md** to create the user management UI page.
