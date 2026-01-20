# Build 30: GET /api/auth/me Endpoint

## Goal
Create the `GET /api/auth/me` endpoint that returns the currently authenticated user's profile information. This is the foundational endpoint for user profile features.

---

## Spec Extract

**API Response:**
```json
{
  "id": "uuid",
  "username": "sam-corl",
  "displayName": "Sam Corl",
  "avatarUrl": "https://...",
  "email": "sam@example.com",
  "bio": "Artist and designer",
  "website": "https://samcorl.com",
  "socials": {
    "instagram": "samcorl",
    "twitter": "samcorl",
    "tiktok": null,
    "youtube": null,
    "bluesky": null,
    "threads": null
  },
  "role": "user",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T12:30:00Z"
}
```

**Behavior:**
- Returns 200 with user data when authenticated
- Returns 401 Unauthorized when not authenticated
- Uses JWT middleware to extract user ID from token
- Returns all non-sensitive user profile fields

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware with JWT verification
- **06-SCHEMA-USERS.md** - Users table schema with all profile fields

**Reason:** This endpoint depends on authenticated requests and queries the users table.

---

## Steps

### Step 1: Verify Auth Middleware Exports

Confirm that auth middleware is properly exported and types are available:

```bash
grep -n "export.*JWTPayload\|export.*AuthUser" /Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/middleware/auth.ts
```

Expected output: Shows `JWTPayload` and `AuthUser` exports.

### Step 2: Create User Response Type

Create a new types file for user API responses:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/user.ts`

```typescript
/**
 * User profile response for API endpoints
 * Excludes sensitive fields like password hashes
 */
export interface UserProfileResponse {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string;
  bio: string | null;
  website: string | null;
  phone: string | null;
  socials: {
    instagram: string | null;
    twitter: string | null;
    tiktok: string | null;
    youtube: string | null;
    bluesky: string | null;
    threads: string | null;
  };
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Parse socials JSON from database
 * Handles both parsed objects and JSON strings
 */
export function parseSocials(
  socialsData: string | null | undefined
): UserProfileResponse['socials'] {
  const defaults = {
    instagram: null,
    twitter: null,
    tiktok: null,
    youtube: null,
    bluesky: null,
    threads: null,
  };

  if (!socialsData) {
    return defaults;
  }

  try {
    const parsed = typeof socialsData === 'string' ? JSON.parse(socialsData) : socialsData;
    return {
      ...defaults,
      ...parsed,
    };
  } catch (error) {
    return defaults;
  }
}
```

### Step 3: Create User Database Query Function

Create a utility function to fetch user by ID:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types';
import { UserProfileResponse, parseSocials } from '../../types/user';

/**
 * Fetch user profile by ID from database
 * Returns formatted user profile response
 */
export async function getUserById(
  db: D1Database,
  userId: string
): Promise<UserProfileResponse | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM users WHERE id = ?1')
      .bind(userId)
      .first<any>();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      username: result.username,
      displayName: result.display_name,
      avatarUrl: result.avatar_url,
      email: result.email,
      bio: result.bio,
      website: result.website,
      phone: result.phone,
      socials: parseSocials(result.socials),
      role: result.role,
      status: result.status,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}
```

### Step 4: Create API Endpoint Handler

Create the GET /api/auth/me endpoint:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/auth/me.ts`

```typescript
import { Hono } from 'hono';
import type { HonoEnv } from '../../../src/types/env';
import { withAuth } from '../../../src/lib/api/middleware/auth';
import { getUserById } from '../../../src/lib/db/users';
import { errorResponse } from '../../../src/lib/api/errors';

const app = new Hono<HonoEnv>();

/**
 * GET /api/auth/me
 * Returns currently authenticated user's profile
 * Requires valid JWT token
 */
app.get('/', withAuth, async (c) => {
  try {
    const authUser = c.get('user');

    if (!authUser) {
      return errorResponse(c, 401, 'UNAUTHORIZED', 'Not authenticated');
    }

    const db = c.env.DB;
    const user = await getUserById(db, authUser.userId);

    if (!user) {
      return errorResponse(c, 404, 'USER_NOT_FOUND', 'User profile not found');
    }

    return c.json(user);
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to fetch user profile');
  }
});

export const onRequest = app.fetch;
```

### Step 5: Verify Route Structure

Confirm the file is in the correct location and the routing will work:

```bash
ls -la /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/auth/
```

Expected output: Should show `me.ts` file created.

### Step 6: Test the Endpoint Locally

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery/site
npm run dev
```

In another terminal, obtain an auth token by logging in (or use an existing token), then test:

```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Expected output: JSON object with user profile matching the spec.

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/user.ts` - User type definitions
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts` - User database queries
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/auth/me.ts` - Endpoint handler

**Modify:**
- None

---

## Verification

### Test 1: Unauthenticated Request Returns 401

```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Content-Type: application/json"
```

Expected: `401` status with error message.

### Test 2: Authenticated Request Returns User Data

```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `200` status with complete user profile JSON.

### Test 3: Response Has All Required Fields

```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" | jq 'keys'
```

Expected: Array includes: `id`, `username`, `displayName`, `avatarUrl`, `email`, `bio`, `website`, `phone`, `socials`, `role`, `status`, `createdAt`, `updatedAt`.

### Test 4: Socials Field Is Properly Formatted

```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" | jq '.socials'
```

Expected: Object with keys: `instagram`, `twitter`, `tiktok`, `youtube`, `bluesky`, `threads` (all null if not set).

### Test 5: Invalid Token Returns 401

```bash
curl -X GET http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `401` status with error message.

---

## Success Criteria

- [ ] User types file created at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/user.ts`
- [ ] User database queries file created at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts`
- [ ] Endpoint handler created at `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/auth/me.ts`
- [ ] Unauthenticated requests return 401
- [ ] Authenticated requests return 200 with complete user profile
- [ ] All required fields present in response
- [ ] Socials field is properly formatted object
- [ ] Invalid tokens return 401

---

## Next Steps

Once verified, proceed to:
- **Build 31:** PATCH /api/users/me endpoint for updating profile
- **Build 33:** Profile view page in React UI
