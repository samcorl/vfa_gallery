# Build 105: GET /api/themes Endpoint

## Goal

Create the `GET /api/themes` endpoint that returns all available themes including system themes and public user-created themes. Include creator information for non-system themes to help users discover themes and identify theme creators.

---

## Spec Extract

**Endpoint:** `GET /api/themes`

**Query Parameters:**
- `limit` (optional, default: 50, max: 100) - Number of themes to return
- `offset` (optional, default: 0) - Pagination offset
- `sortBy` (optional, default: "name") - Sort field: "name", "created_at", "popularity"

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "theme-system-light",
      "name": "System Light",
      "description": "Clean, minimal light theme",
      "isSystem": true,
      "isPublic": true,
      "creator": null,
      "previewUrl": "https://...",
      "usageCount": 142,
      "styles": {
        "primary": "#000000",
        "secondary": "#FFFFFF",
        "accent": "#0066FF",
        "background": "#FFFFFF",
        "surface": "#F5F5F5",
        "text": "#000000",
        "textSecondary": "#666666",
        "border": "#E0E0E0",
        "fontFamily": "system-ui, -apple-system, sans-serif",
        "fontSizeBase": "16px",
        "lineHeightBase": "1.5",
        "borderRadius": "0.25rem"
      },
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    },
    {
      "id": "theme-user-minimal-dark",
      "name": "Minimal Dark",
      "description": "High contrast dark theme for late night browsing",
      "isSystem": false,
      "isPublic": true,
      "creator": {
        "id": "user_xyz789",
        "username": "artist-name",
        "displayName": "Artist Name",
        "avatarUrl": "https://..."
      },
      "usageCount": 23,
      "previewUrl": "https://...",
      "styles": { ... },
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-01-18T14:22:00Z"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**Behavior:**
- Returns paginated list of all public themes (system + public user themes)
- System themes always appear in results
- Includes creator info only for non-system themes
- Supports sorting by name, creation date, or usage count
- No authentication required
- Returns 200 with empty array if no themes match filters

---

## Prerequisites

**Must complete before starting:**
- **11-SCHEMA-THEMES.md** - Themes table schema created
- **15-API-FOUNDATION.md** - Hono router and error handling setup
- **06-SCHEMA-USERS.md** - Users table for creator information

**Reason:** This endpoint queries the themes table and joins with users for creator info.

---

## Steps

### Step 1: Create Theme Response Types

Create type definitions for theme API responses:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts`

```typescript
/**
 * Theme styles object stored in database as JSON
 */
export interface ThemeStyles {
  primary: string;           // Primary brand color
  secondary: string;         // Secondary brand color
  accent: string;           // Accent/highlight color
  background: string;       // Main background color
  surface: string;          // Card/surface background
  text: string;            // Primary text color
  textSecondary: string;   // Secondary text color
  border: string;          // Border color
  fontFamily: string;      // Font family stack
  fontSizeBase: string;    // Base font size (e.g., "16px")
  lineHeightBase: string;  // Base line height (e.g., "1.5")
  borderRadius: string;    // Border radius (e.g., "0.25rem")
}

/**
 * Creator info for non-system themes
 */
export interface ThemeCreator {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Theme response for API endpoints
 */
export interface ThemeResponse {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isPublic: boolean;
  creator: ThemeCreator | null;
  previewUrl: string | null;
  usageCount: number;
  styles: ThemeStyles;
  createdAt: string;
  updatedAt: string;
}

/**
 * Parse styles JSON from database
 */
export function parseThemeStyles(
  stylesData: string | null | undefined
): ThemeStyles {
  const defaults: ThemeStyles = {
    primary: '#000000',
    secondary: '#FFFFFF',
    accent: '#0066FF',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSizeBase: '16px',
    lineHeightBase: '1.5',
    borderRadius: '0.25rem',
  };

  if (!stylesData) {
    return defaults;
  }

  try {
    const parsed = typeof stylesData === 'string' ? JSON.parse(stylesData) : stylesData;
    return {
      ...defaults,
      ...parsed,
    };
  } catch (error) {
    return defaults;
  }
}
```

### Step 2: Create Theme Database Query Function

Create utility function to fetch themes with pagination:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types';
import { ThemeResponse, parseThemeStyles } from '../../types/theme';

/**
 * Sort options for theme list
 */
export type ThemeSortBy = 'name' | 'created_at' | 'popularity';

/**
 * Fetch public themes with pagination
 * Includes system themes and public user-created themes
 */
export async function getPublicThemes(
  db: D1Database,
  limit: number = 50,
  offset: number = 0,
  sortBy: ThemeSortBy = 'name'
): Promise<{ themes: ThemeResponse[]; total: number }> {
  try {
    // Determine sort column and direction
    let orderClause = 'ORDER BY t.name ASC';
    switch (sortBy) {
      case 'created_at':
        orderClause = 'ORDER BY t.created_at DESC';
        break;
      case 'popularity':
        orderClause = 'ORDER BY (SELECT COUNT(*) FROM galleries WHERE theme_id = t.id) DESC, t.name ASC';
        break;
      case 'name':
      default:
        orderClause = 'ORDER BY t.name ASC';
    }

    // Ensure limits are within acceptable ranges
    const validLimit = Math.min(Math.max(1, limit), 100);
    const validOffset = Math.max(0, offset);

    // Get total count of public themes
    const countResult = await db
      .prepare(
        `SELECT COUNT(*) as count FROM themes
         WHERE is_system = 1 OR is_public = 1`
      )
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
          t.created_at,
          t.updated_at,
          t.created_by,
          u.username,
          u.display_name,
          u.avatar_url,
          (SELECT COUNT(*) FROM galleries WHERE theme_id = t.id) as usage_count
        FROM themes t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.is_system = 1 OR t.is_public = 1
        ${orderClause}
        LIMIT ?1 OFFSET ?2`
      )
      .bind(validLimit, validOffset)
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
      previewUrl: null, // TODO: Generate preview image URL
      usageCount: row.usage_count || 0,
      styles: parseThemeStyles(row.styles),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { themes, total };
  } catch (error) {
    console.error('Error fetching public themes:', error);
    return { themes: [], total: 0 };
  }
}

/**
 * Fetch single theme by ID
 */
export async function getThemeById(
  db: D1Database,
  themeId: string
): Promise<ThemeResponse | null> {
  try {
    const result = await db
      .prepare(
        `SELECT
          t.id,
          t.name,
          t.description,
          t.is_system,
          t.is_public,
          t.styles,
          t.created_at,
          t.updated_at,
          t.created_by,
          u.username,
          u.display_name,
          u.avatar_url,
          (SELECT COUNT(*) FROM galleries WHERE theme_id = t.id) as usage_count
        FROM themes t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.id = ?1`
      )
      .bind(themeId)
      .first<any>();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      name: result.name,
      description: result.description,
      isSystem: Boolean(result.is_system),
      isPublic: Boolean(result.is_public),
      creator: result.created_by ? {
        id: result.created_by,
        username: result.username,
        displayName: result.display_name,
        avatarUrl: result.avatar_url,
      } : null,
      previewUrl: null,
      usageCount: result.usage_count || 0,
      styles: parseThemeStyles(result.styles),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  } catch (error) {
    console.error('Error fetching theme:', error);
    return null;
  }
}
```

### Step 3: Create API Endpoint Handler

Create the GET /api/themes endpoint:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/index.ts`

```typescript
import { Hono } from 'hono';
import type { HonoEnv } from '../../../src/types/env';
import { getPublicThemes } from '../../../src/lib/db/themes';
import { errorResponse } from '../../../src/lib/api/errors';

const app = new Hono<HonoEnv>();

/**
 * GET /api/themes
 * Returns list of public themes with pagination
 * No authentication required
 */
app.get('/', async (c) => {
  try {
    // Parse query parameters
    const limit = Math.min(Math.max(1, parseInt(c.query('limit') || '50')), 100);
    const offset = Math.max(0, parseInt(c.query('offset') || '0'));
    const sortBy = (c.query('sortBy') || 'name') as 'name' | 'created_at' | 'popularity';

    // Validate sortBy parameter
    if (!['name', 'created_at', 'popularity'].includes(sortBy)) {
      return errorResponse(c, 400, 'INVALID_SORT', 'sortBy must be "name", "created_at", or "popularity"');
    }

    const db = c.env.DB;
    const { themes, total } = await getPublicThemes(db, limit, offset, sortBy);

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
    console.error('GET /api/themes error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to fetch themes');
  }
});

export const onRequest = app.fetch;
```

### Step 4: Verify Route Structure

Confirm the endpoint file is in the correct location:

```bash
ls -la /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/
```

Expected output: Should show `index.ts` file.

### Step 5: Test the Endpoint Locally

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

In another terminal, test the endpoint:

```bash
# Test basic list
curl -X GET http://localhost:8787/api/themes \
  -H "Content-Type: application/json"

# Test with pagination
curl -X GET "http://localhost:8787/api/themes?limit=10&offset=0" \
  -H "Content-Type: application/json"

# Test with sorting
curl -X GET "http://localhost:8787/api/themes?sortBy=created_at&limit=20" \
  -H "Content-Type: application/json"
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts` - Theme type definitions
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` - Theme database queries
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/index.ts` - Endpoint handler

**Modify:**
- None

---

## Verification

### Test 1: Get All Themes

```bash
curl -X GET http://localhost:8787/api/themes \
  -H "Content-Type: application/json"
```

Expected: `200` status with array of themes and pagination info.

### Test 2: Pagination Works

```bash
curl -X GET "http://localhost:8787/api/themes?limit=10&offset=0" \
  -H "Content-Type: application/json" | jq '.pagination'
```

Expected: Shows pagination with correct limit, offset, and hasMore fields.

### Test 3: System Themes Included

```bash
curl -X GET http://localhost:8787/api/themes \
  -H "Content-Type: application/json" | jq '.data[] | select(.isSystem == true)'
```

Expected: Returns at least one system theme.

### Test 4: Creator Info For Public Themes

```bash
curl -X GET http://localhost:8787/api/themes \
  -H "Content-Type: application/json" | jq '.data[] | select(.isSystem == false) | .creator'
```

Expected: Creator object with id, username, displayName, avatarUrl (or null if no user themes).

### Test 5: Sorting By Creation Date

```bash
curl -X GET "http://localhost:8787/api/themes?sortBy=created_at" \
  -H "Content-Type: application/json" | jq '.data[0:2] | .[].createdAt'
```

Expected: Themes sorted by most recent first.

### Test 6: Invalid Sort Parameter Returns 400

```bash
curl -X GET "http://localhost:8787/api/themes?sortBy=invalid" \
  -H "Content-Type: application/json"
```

Expected: `400` status with error message.

### Test 7: Themes Have Required Fields

```bash
curl -X GET http://localhost:8787/api/themes \
  -H "Content-Type: application/json" | jq '.data[0] | keys'
```

Expected: Includes all required fields: id, name, description, isSystem, isPublic, creator, previewUrl, usageCount, styles, createdAt, updatedAt.

### Test 8: Styles Are Valid Objects

```bash
curl -X GET http://localhost:8787/api/themes \
  -H "Content-Type: application/json" | jq '.data[0].styles | keys'
```

Expected: Has color and typography properties like primary, secondary, accent, fontFamily, etc.

---

## Success Criteria

- [ ] Theme type definitions created at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts`
- [ ] Theme database queries created at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts`
- [ ] Endpoint handler created at `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/index.ts`
- [ ] GET /api/themes returns 200 with paginated theme list
- [ ] System themes included in response
- [ ] Creator info included for non-system themes
- [ ] Pagination works with limit and offset parameters
- [ ] Sorting by name, creation date, or popularity works
- [ ] Invalid sort parameters return 400 error
- [ ] Themes have all required fields including styles

---

## Next Steps

Once verified, proceed to:
- **Build 106:** GET /api/themes/mine endpoint for user's custom themes
- **Build 107:** POST /api/themes endpoint for creating custom themes
