# Build 31: PATCH /api/users/me Endpoint

## Goal
Create the `PATCH /api/users/me` endpoint that allows authenticated users to update their profile information (displayName, bio, website, phone, socials). Prevents users from changing username, email, role, or status.

---

## Spec Extract

**Request Body (all fields optional):**
```json
{
  "displayName": "Sam Corl",
  "bio": "Artist and designer based in NYC",
  "website": "https://samcorl.com",
  "phone": "+1-234-567-8900",
  "socials": {
    "instagram": "samcorl",
    "twitter": "samcorl",
    "tiktok": null,
    "youtube": "UCxxxxxx",
    "bluesky": "samcorl.bsky.social",
    "threads": "samcorl"
  }
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "username": "sam-corl",
  "displayName": "Sam Corl",
  "avatarUrl": "https://...",
  "email": "sam@example.com",
  "bio": "Artist and designer based in NYC",
  "website": "https://samcorl.com",
  "phone": "+1-234-567-8900",
  "socials": {
    "instagram": "samcorl",
    "twitter": "samcorl",
    "tiktok": null,
    "youtube": "UCxxxxxx",
    "bluesky": "samcorl.bsky.social",
    "threads": "samcorl"
  },
  "role": "user",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T13:45:00Z"
}
```

**Validation:**
- `displayName`: string, max 255 characters
- `bio`: string, max 1000 characters
- `website`: valid URL format (http/https only)
- `phone`: optional, basic format validation
- `socials`: object with optional social media handles
- Fields `username`, `email`, `role`, `status` cannot be modified (ignored if included)

---

## Prerequisites

**Must complete before starting:**
- **30-API-USER-ME.md** - GET /api/auth/me endpoint for fetching current user
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware

**Reason:** This endpoint depends on authenticated requests and reuses user response types.

---

## Steps

### Step 1: Create Validation Utilities

Create a validation module for user profile updates:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/users.ts`

```typescript
/**
 * Validation rules for user profile updates
 */
export interface UpdateUserInput {
  displayName?: string | null;
  bio?: string | null;
  website?: string | null;
  phone?: string | null;
  socials?: Record<string, string | null> | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate URL format (http or https only)
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate phone number format (basic check)
 * Allows +, digits, spaces, dashes, parentheses
 */
function isValidPhoneFormat(phone: string): boolean {
  const phoneRegex = /^[\d\s\-+()]+$/;
  return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20;
}

/**
 * Validate user profile update input
 * Returns array of validation errors (empty if valid)
 */
export function validateUpdateUser(input: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for disallowed fields
  const disallowedFields = ['id', 'username', 'email', 'role', 'status', 'avatarUrl', 'createdAt'];
  for (const field of disallowedFields) {
    if (field in input) {
      errors.push({
        field,
        message: `Cannot modify ${field}`,
      });
    }
  }

  // Validate displayName
  if ('displayName' in input && input.displayName !== null && input.displayName !== undefined) {
    if (typeof input.displayName !== 'string') {
      errors.push({
        field: 'displayName',
        message: 'displayName must be a string',
      });
    } else if (input.displayName.length > 255) {
      errors.push({
        field: 'displayName',
        message: 'displayName must be 255 characters or less',
      });
    } else if (input.displayName.trim().length === 0) {
      errors.push({
        field: 'displayName',
        message: 'displayName cannot be empty',
      });
    }
  }

  // Validate bio
  if ('bio' in input && input.bio !== null && input.bio !== undefined) {
    if (typeof input.bio !== 'string') {
      errors.push({
        field: 'bio',
        message: 'bio must be a string',
      });
    } else if (input.bio.length > 1000) {
      errors.push({
        field: 'bio',
        message: 'bio must be 1000 characters or less',
      });
    }
  }

  // Validate website
  if ('website' in input && input.website !== null && input.website !== undefined) {
    if (typeof input.website !== 'string') {
      errors.push({
        field: 'website',
        message: 'website must be a string',
      });
    } else if (!isValidUrl(input.website)) {
      errors.push({
        field: 'website',
        message: 'website must be a valid URL (http or https)',
      });
    }
  }

  // Validate phone
  if ('phone' in input && input.phone !== null && input.phone !== undefined) {
    if (typeof input.phone !== 'string') {
      errors.push({
        field: 'phone',
        message: 'phone must be a string',
      });
    } else if (!isValidPhoneFormat(input.phone)) {
      errors.push({
        field: 'phone',
        message: 'phone must be in valid format',
      });
    }
  }

  // Validate socials
  if ('socials' in input && input.socials !== null && input.socials !== undefined) {
    if (typeof input.socials !== 'object' || Array.isArray(input.socials)) {
      errors.push({
        field: 'socials',
        message: 'socials must be an object',
      });
    } else {
      const validSocialKeys = ['instagram', 'twitter', 'tiktok', 'youtube', 'bluesky', 'threads'];
      for (const key in input.socials) {
        if (!validSocialKeys.includes(key)) {
          errors.push({
            field: 'socials',
            message: `Unknown social media platform: ${key}`,
          });
        } else if (
          input.socials[key] !== null &&
          input.socials[key] !== undefined &&
          typeof input.socials[key] !== 'string'
        ) {
          errors.push({
            field: 'socials',
            message: `socials.${key} must be a string or null`,
          });
        } else if (input.socials[key] && typeof input.socials[key] === 'string') {
          if (input.socials[key].length > 255) {
            errors.push({
              field: 'socials',
              message: `socials.${key} must be 255 characters or less`,
            });
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Sanitize update input - only include allowed fields
 */
export function sanitizeUpdateUser(input: any): UpdateUserInput {
  const allowed: UpdateUserInput = {};

  if ('displayName' in input) allowed.displayName = input.displayName ?? null;
  if ('bio' in input) allowed.bio = input.bio ?? null;
  if ('website' in input) allowed.website = input.website ?? null;
  if ('phone' in input) allowed.phone = input.phone ?? null;
  if ('socials' in input) allowed.socials = input.socials ?? null;

  return allowed;
}
```

### Step 2: Create Database Update Function

Add a function to update user profile in the users database module:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts` (modify existing)

Add this function to the existing file:

```typescript
/**
 * Update user profile fields
 * Returns updated user profile or null if update fails
 */
export async function updateUserProfile(
  db: D1Database,
  userId: string,
  updates: UpdateUserInput
): Promise<UserProfileResponse | null> {
  try {
    // Build dynamic UPDATE query
    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const bindValues: any[] = [];
    let bindIndex = 1;

    if ('displayName' in updates && updates.displayName !== undefined) {
      setClauses.push(`display_name = ?${bindIndex}`);
      bindValues.push(updates.displayName);
      bindIndex++;
    }

    if ('bio' in updates && updates.bio !== undefined) {
      setClauses.push(`bio = ?${bindIndex}`);
      bindValues.push(updates.bio);
      bindIndex++;
    }

    if ('website' in updates && updates.website !== undefined) {
      setClauses.push(`website = ?${bindIndex}`);
      bindValues.push(updates.website);
      bindIndex++;
    }

    if ('phone' in updates && updates.phone !== undefined) {
      setClauses.push(`phone = ?${bindIndex}`);
      bindValues.push(updates.phone);
      bindIndex++;
    }

    if ('socials' in updates && updates.socials !== undefined) {
      const socialsJson = updates.socials ? JSON.stringify(updates.socials) : null;
      setClauses.push(`socials = ?${bindIndex}`);
      bindValues.push(socialsJson);
      bindIndex++;
    }

    // If no updates provided, return current user
    if (setClauses.length === 1) {
      return getUserById(db, userId);
    }

    // Add user ID to bind values
    bindValues.push(userId);

    // Execute update
    const query = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?${bindIndex}`;
    await db.prepare(query).bind(...bindValues).run();

    // Fetch and return updated user
    return getUserById(db, userId);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return null;
  }
}

// Add to imports at top of file
import type { UpdateUserInput } from '../../lib/validation/users';
```

### Step 3: Create API Endpoint Handler

Create the PATCH /api/users/me endpoint:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/users/me.ts`

```typescript
import { Hono } from 'hono';
import type { HonoEnv } from '../../../src/types/env';
import { withAuth } from '../../../src/lib/api/middleware/auth';
import { getUserById, updateUserProfile } from '../../../src/lib/db/users';
import { validateUpdateUser, sanitizeUpdateUser } from '../../../src/lib/validation/users';
import { errorResponse } from '../../../src/lib/api/errors';

const app = new Hono<HonoEnv>();

/**
 * PATCH /api/users/me
 * Update current user's profile
 * Allowed fields: displayName, bio, website, phone, socials
 */
app.patch('/', withAuth, async (c) => {
  try {
    const authUser = c.get('user');

    if (!authUser) {
      return errorResponse(c, 401, 'UNAUTHORIZED', 'Not authenticated');
    }

    // Parse request body
    let body: any;
    try {
      body = await c.req.json();
    } catch (error) {
      return errorResponse(c, 400, 'INVALID_JSON', 'Request body must be valid JSON');
    }

    // Validate input
    const validationErrors = validateUpdateUser(body);
    if (validationErrors.length > 0) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: validationErrors,
        },
        400
      );
    }

    // Sanitize input
    const sanitized = sanitizeUpdateUser(body);

    // Check if there's anything to update
    if (Object.keys(sanitized).length === 0) {
      // No updates, return current user
      const db = c.env.DB;
      const user = await getUserById(db, authUser.userId);

      if (!user) {
        return errorResponse(c, 404, 'USER_NOT_FOUND', 'User profile not found');
      }

      return c.json(user);
    }

    // Update user profile
    const db = c.env.DB;
    const updatedUser = await updateUserProfile(db, authUser.userId, sanitized);

    if (!updatedUser) {
      return errorResponse(c, 500, 'UPDATE_FAILED', 'Failed to update user profile');
    }

    return c.json(updatedUser);
  } catch (error) {
    console.error('PATCH /api/users/me error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to update user profile');
  }
});

export const onRequest = app.fetch;
```

### Step 4: Verify File Structure

Confirm the file is in the correct location:

```bash
ls -la /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/users/
```

Expected output: Should show `me.ts` file.

### Step 5: Test the Endpoint Locally

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery/site
npm run dev
```

Then test updating bio:

```bash
curl -X PATCH http://localhost:8787/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Artist and designer based in NYC",
    "website": "https://samcorl.com"
  }'
```

Expected: `200` status with updated user profile.

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/users.ts` - Validation logic
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/users/me.ts` - PATCH endpoint

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts` - Add updateUserProfile function

---

## Verification

### Test 1: Unauthenticated Request Returns 401

```bash
curl -X PATCH http://localhost:8787/api/users/me \
  -H "Content-Type: application/json" \
  -d '{"bio": "test"}'
```

Expected: `401` status.

### Test 2: Update Single Field

```bash
curl -X PATCH http://localhost:8787/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio": "New bio text"}'
```

Expected: `200` status with updated user, bio field changed.

### Test 3: Update Multiple Fields

```bash
curl -X PATCH http://localhost:8787/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Sam Corl",
    "bio": "Artist and designer",
    "website": "https://samcorl.com",
    "phone": "+1-234-567-8900"
  }'
```

Expected: `200` status with all fields updated.

### Test 4: Cannot Update Protected Fields

```bash
curl -X PATCH http://localhost:8787/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "hacker", "role": "admin"}'
```

Expected: `400` status with validation error about disallowed fields.

### Test 5: Invalid Website URL

```bash
curl -X PATCH http://localhost:8787/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"website": "not-a-url"}'
```

Expected: `400` status with validation error.

### Test 6: Too Long Bio

```bash
curl -X PATCH http://localhost:8787/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio": "'$(printf 'a%.0s' {1..1001})'"}'
```

Expected: `400` status with validation error about length.

### Test 7: Update with Social Media

```bash
curl -X PATCH http://localhost:8787/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "socials": {
      "instagram": "samcorl",
      "twitter": "samcorl",
      "youtube": "UCxxxxxx"
    }
  }'
```

Expected: `200` status with socials field updated.

### Test 8: Empty Update Returns Current User

```bash
curl -X PATCH http://localhost:8787/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `200` status with current user data unchanged.

### Test 9: Updated_at Timestamp Changes

```bash
curl -X PATCH http://localhost:8787/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio": "Updated bio"}' | jq '.updatedAt'
```

Expected: Current timestamp.

---

## Success Criteria

- [ ] Validation module created at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/validation/users.ts`
- [ ] Database update function added to users module
- [ ] Endpoint handler created at `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/users/me.ts`
- [ ] Unauthenticated requests return 401
- [ ] Can update individual profile fields
- [ ] Can update multiple fields in one request
- [ ] Cannot modify protected fields (username, email, role, status)
- [ ] Invalid URLs rejected
- [ ] Field length limits enforced
- [ ] Social media handles accepted and stored
- [ ] updated_at timestamp automatically updated
- [ ] Validation errors include field-level details

---

## Next Steps

Once verified, proceed to:
- **Build 32:** POST /api/users/me/avatar endpoint for avatar upload
- **Build 34:** Profile edit form in React UI
