# Build 106: GET /api/themes/mine Endpoint

## Goal

Create the `GET /api/themes/mine` endpoint that returns the current authenticated user's custom themes (both private and public). This allows users to manage their theme collection and see which themes they've created or copied.

---

## Spec Extract

**Endpoint:** `GET /api/themes/mine`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `limit` (optional, default: 50, max: 100) - Number of themes to return
- `offset` (optional, default: 0) - Pagination offset
- `includeSystem` (optional, default: false) - Include system themes in response

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "theme-user-custom-1",
      "name": "My Dark Theme",
      "description": "Personal dark theme with custom colors",
      "isSystem": false,
      "isPublic": false,
      "creator": {
        "id": "user_current",
        "username": "current-user",
        "displayName": "Current User",
        "avatarUrl": "https://..."
      },
      "copiedFrom": null,
      "previewUrl": "https://...",
      "usageCount": 2,
      "styles": {
        "primary": "#1E1E1E",
        "secondary": "#FFFFFF",
        "accent": "#00FF00",
        ...
      },
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-01-18T14:22:00Z"
    },
    {
      "id": "theme-user-copy-1",
      "name": "System Light (Copy)",
      "description": "A copy of the system light theme",
      "isSystem": false,
      "isPublic": true,
      "creator": { ... },
      "copiedFrom": "theme-system-light",
      "previewUrl": "https://...",
      "usageCount": 5,
      "styles": { ... },
      "createdAt": "2026-01-17T09:00:00Z",
      "updatedAt": "2026-01-17T09:00:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Behavior:**
- Returns only themes created by or owned by the authenticated user
- Includes both private and public user themes
- Can optionally include system themes if requested
- Shows `copiedFrom` field if theme is a copy of another theme
- Supports pagination with limit and offset
- Returns 401 if not authenticated
- Returns 200 with empty array if user has no themes

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware with JWT verification
- **11-SCHEMA-THEMES.md** - Themes table schema created
- **105-API-THEME-LIST.md** - Theme types and basic database queries

**Reason:** This endpoint requires authentication and uses the themes table and user context.

---

## Steps

### Step 1: Extend Theme Response Type

Add `copiedFrom` field to the theme response type:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts` (modify existing)

Add this field to the `ThemeResponse` interface:

```typescript
export interface ThemeResponse {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isPublic: boolean;
  creator: ThemeCreator | null;
  copiedFrom?: string | null;  // Add this line
  previewUrl: string | null;
  usageCount: number;
  styles: ThemeStyles;
  createdAt: string;
  updatedAt: string;
}
```

### Step 2: Add User Theme Query Function

Add a new function to the themes database file:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` (modify existing)

Add this function:

```typescript
/**
 * Fetch user's custom themes (both private and public)
 * Includes themes created by the user and system themes if requested
 */
export async function getUserThemes(
  db: D1Database,
  userId: string,
  limit: number = 50,
  offset: number = 0,
  includeSystem: boolean = false
): Promise<{ themes: ThemeResponse[]; total: number }> {
  try {
    // Ensure limits are within acceptable ranges
    const validLimit = Math.min(Math.max(1, limit), 100);
    const validOffset = Math.max(0, offset);

    // Build WHERE clause
    let whereClause = 'WHERE t.created_by = ?1';
    const params: any[] = [userId];

    if (includeSystem) {
      whereClause = 'WHERE (t.created_by = ?1 OR t.is_system = 1)';
    }

    // Get total count
    const countResult = await db
      .prepare(
        `SELECT COUNT(*) as count FROM themes t
         ${whereClause}`
      )
      .bind(...params)
      .first<{ count: number }>();

    const total = countResult?.count || 0;

    // Get paginated results
    const results = await db
      .prepare(
        `SELECT
          t.id,
          t.name,
          t.description,
          t.is_system,
          t.is_public,
          t.styles,
          t.copied_from,
          t.created_at,
          t.updated_at,
          t.created_by,
          u.username,
          u.display_name,
          u.avatar_url,
          (SELECT COUNT(*) FROM galleries WHERE theme_id = t.id) as usage_count
        FROM themes t
        LEFT JOIN users u ON t.created_by = u.id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}`
      )
      .bind(...params, validLimit, validOffset)
      .all<any>();

    const themes: ThemeResponse[] = results.results.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isSystem: Boolean(row.is_system),
      isPublic: Boolean(row.is_public),
      creator: row.created_by ? {
        id: row.created_by,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      } : null,
      copiedFrom: row.copied_from,
      previewUrl: null,
      usageCount: row.usage_count || 0,
      styles: parseThemeStyles(row.styles),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { themes, total };
  } catch (error) {
    console.error('Error fetching user themes:', error);
    return { themes: [], total: 0 };
  }
}
```

### Step 3: Create API Endpoint Handler

Create the GET /api/themes/mine endpoint:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/mine.ts`

```typescript
import { Hono } from 'hono';
import type { HonoEnv } from '../../../src/types/env';
import { withAuth } from '../../../src/lib/api/middleware/auth';
import { getUserThemes } from '../../../src/lib/db/themes';
import { errorResponse } from '../../../src/lib/api/errors';

const app = new Hono<HonoEnv>();

/**
 * GET /api/themes/mine
 * Returns current user's custom themes
 * Requires authentication
 */
app.get('/', withAuth, async (c) => {
  try {
    const authUser = c.get('user');

    if (!authUser) {
      return errorResponse(c, 401, 'UNAUTHORIZED', 'Not authenticated');
    }

    // Parse query parameters
    const limit = Math.min(Math.max(1, parseInt(c.query('limit') || '50')), 100);
    const offset = Math.max(0, parseInt(c.query('offset') || '0'));
    const includeSystem = c.query('includeSystem') === 'true';

    const db = c.env.DB;
    const { themes, total } = await getUserThemes(
      db,
      authUser.userId,
      limit,
      offset,
      includeSystem
    );

    return c.json({
      data: themes,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('GET /api/themes/mine error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to fetch user themes');
  }
});

export const onRequest = app.fetch;
```

### Step 4: Verify File Structure

Confirm the file is created in the correct location:

```bash
ls -la /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/
```

Expected output: Should show both `index.ts` and `mine.ts`.

### Step 5: Test the Endpoint Locally

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

In another terminal, get a valid auth token and test:

```bash
# Test basic list of user's themes
curl -X GET http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Test with pagination
curl -X GET "http://localhost:8787/api/themes/mine?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Test including system themes
curl -X GET "http://localhost:8787/api/themes/mine?includeSystem=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/mine.ts` - Endpoint handler

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts` - Add copiedFrom field
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` - Add getUserThemes function

---

## Verification

### Test 1: Unauthenticated Request Returns 401

```bash
curl -X GET http://localhost:8787/api/themes/mine \
  -H "Content-Type: application/json"
```

Expected: `401` status with error message.

### Test 2: Authenticated Request Returns User Themes

```bash
curl -X GET http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `200` status with array of themes created by user.

### Test 3: Pagination Works

```bash
curl -X GET "http://localhost:8787/api/themes/mine?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" | jq '.pagination'
```

Expected: Shows pagination with correct total, limit, offset, and hasMore.

### Test 4: copiedFrom Field Present For Copied Themes

```bash
curl -X GET http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" | jq '.data[] | select(.copiedFrom != null) | .copiedFrom'
```

Expected: Returns ID of original theme for copied themes, or empty if no copied themes.

### Test 5: Creator Info Shows Current User

```bash
curl -X GET http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" | jq '.data[0].creator'
```

Expected: Creator info matches authenticated user.

### Test 6: IncludeSystem Parameter Works

```bash
curl -X GET "http://localhost:8787/api/themes/mine?includeSystem=true" \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" | jq '.data[] | select(.isSystem == true)'
```

Expected: Returns system themes when includeSystem=true.

### Test 7: Without includeSystem System Themes Not Included

```bash
curl -X GET http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" | jq '.data[].isSystem'
```

Expected: All items should be false (no system themes).

### Test 8: Empty List Returns 200

Without creating any user themes first, test returns empty array:

```bash
curl -X GET http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer NEW_USER_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `200` status with empty data array.

---

## Success Criteria

- [ ] Theme response type updated with copiedFrom field
- [ ] getUserThemes function added to theme database queries
- [ ] Endpoint handler created at `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/mine.ts`
- [ ] Unauthenticated requests return 401
- [ ] Authenticated requests return 200 with user's themes
- [ ] Only user's own themes returned (not other users')
- [ ] Pagination works correctly
- [ ] copiedFrom field present and populated for copied themes
- [ ] creator info shows current user
- [ ] includeSystem parameter works correctly
- [ ] System themes excluded by default

---

## Next Steps

Once verified, proceed to:
- **Build 107:** POST /api/themes endpoint for creating custom themes
- **Build 108:** PATCH /api/themes/:id endpoint for updating themes
