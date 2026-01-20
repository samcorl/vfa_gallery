# Build 107: POST /api/themes Endpoint

## Goal

Create the `POST /api/themes` endpoint that allows authenticated users to create custom themes. Users provide a name, description, and styles object containing colors, fonts, and layout options.

---

## Spec Extract

**Endpoint:** `POST /api/themes`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "name": "My Custom Theme",
  "description": "A custom theme with my favorite colors",
  "isPublic": false,
  "styles": {
    "primary": "#1E3A8A",
    "secondary": "#F3F4F6",
    "accent": "#DC2626",
    "background": "#FFFFFF",
    "surface": "#F9FAFB",
    "text": "#111827",
    "textSecondary": "#6B7280",
    "border": "#E5E7EB",
    "fontFamily": "system-ui, -apple-system, sans-serif",
    "fontSizeBase": "16px",
    "lineHeightBase": "1.5",
    "borderRadius": "0.25rem"
  }
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "theme-user-abc123",
    "name": "My Custom Theme",
    "description": "A custom theme with my favorite colors",
    "isSystem": false,
    "isPublic": false,
    "creator": {
      "id": "user_xyz789",
      "username": "artist-name",
      "displayName": "Artist Name",
      "avatarUrl": "https://..."
    },
    "copiedFrom": null,
    "previewUrl": "https://...",
    "usageCount": 0,
    "styles": {
      "primary": "#1E3A8A",
      "secondary": "#F3F4F6",
      ...
    },
    "createdAt": "2026-01-19T10:30:00Z",
    "updatedAt": "2026-01-19T10:30:00Z"
  }
}
```

**Behavior:**
- Creates a new theme owned by the authenticated user
- `isPublic` defaults to false (private theme)
- Styles must include all required color and typography fields
- Returns 201 with created theme on success
- Returns 400 if required fields missing or styles incomplete
- Returns 401 if not authenticated
- System themes cannot be created via API (is_system always 0)

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware with JWT verification
- **11-SCHEMA-THEMES.md** - Themes table schema created
- **105-API-THEME-LIST.md** - Theme types and database queries
- **106-API-THEME-MINE.md** - User theme queries

**Reason:** This endpoint requires authentication and creates records in the themes table.

---

## Steps

### Step 1: Create Theme Creation Request/Response Types

Add request and creation response types:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts` (modify existing)

Add these interfaces:

```typescript
/**
 * Request body for creating a new theme
 */
export interface CreateThemeRequest {
  name: string;
  description?: string | null;
  isPublic?: boolean;
  styles: ThemeStyles;
}

/**
 * Validation result for theme creation request
 */
export interface CreateThemeValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate theme creation request
 */
export function validateCreateThemeRequest(
  data: any
): CreateThemeValidationResult {
  const errors: string[] = [];

  // Validate name
  if (!data.name || typeof data.name !== 'string') {
    errors.push('name is required and must be a string');
  } else if (data.name.trim().length === 0) {
    errors.push('name cannot be empty');
  } else if (data.name.length > 100) {
    errors.push('name cannot exceed 100 characters');
  }

  // Validate description (optional)
  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== 'string') {
      errors.push('description must be a string');
    } else if (data.description.length > 500) {
      errors.push('description cannot exceed 500 characters');
    }
  }

  // Validate isPublic (optional)
  if (data.isPublic !== undefined && typeof data.isPublic !== 'boolean') {
    errors.push('isPublic must be a boolean');
  }

  // Validate styles object
  if (!data.styles || typeof data.styles !== 'object') {
    errors.push('styles is required and must be an object');
  } else {
    const requiredStyleFields = [
      'primary',
      'secondary',
      'accent',
      'background',
      'surface',
      'text',
      'textSecondary',
      'border',
      'fontFamily',
      'fontSizeBase',
      'lineHeightBase',
      'borderRadius',
    ];

    for (const field of requiredStyleFields) {
      if (!data.styles[field]) {
        errors.push(`styles.${field} is required`);
      } else if (typeof data.styles[field] !== 'string') {
        errors.push(`styles.${field} must be a string`);
      }
    }

    // Validate color fields (basic hex color check)
    const colorFields = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'textSecondary', 'border'];
    for (const field of colorFields) {
      if (data.styles[field]) {
        const colorValue = data.styles[field];
        if (!/^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
          errors.push(`styles.${field} must be a valid hex color (e.g., #FFFFFF)`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### Step 2: Add Theme Creation Database Function

Add function to create themes:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` (modify existing)

Add this function:

```typescript
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new theme for a user
 */
export async function createTheme(
  db: D1Database,
  userId: string,
  name: string,
  description: string | null | undefined,
  styles: ThemeStyles,
  isPublic: boolean = false
): Promise<ThemeResponse | null> {
  try {
    const themeId = `theme-${uuidv4()}`;
    const now = new Date().toISOString();
    const stylesJson = JSON.stringify(styles);

    // Insert theme
    await db
      .prepare(
        `INSERT INTO themes (id, name, description, created_by, is_public, styles, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .bind(
        themeId,
        name.trim(),
        description ? description.trim() : null,
        userId,
        isPublic ? 1 : 0,
        stylesJson,
        now,
        now
      )
      .run();

    // Fetch and return the created theme
    return await getThemeById(db, themeId);
  } catch (error) {
    console.error('Error creating theme:', error);
    return null;
  }
}
```

### Step 3: Create API Endpoint Handler

Create the POST /api/themes endpoint:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/index.ts` (modify existing)

Update the file to include POST handler:

```typescript
import { Hono } from 'hono';
import type { HonoEnv } from '../../../src/types/env';
import { withAuth } from '../../../src/lib/api/middleware/auth';
import { getPublicThemes, createTheme } from '../../../src/lib/db/themes';
import { validateCreateThemeRequest } from '../../../src/types/theme';
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

/**
 * POST /api/themes
 * Create a new custom theme
 * Requires authentication
 */
app.post('/', withAuth, async (c) => {
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

    // Validate request
    const validation = validateCreateThemeRequest(body);
    if (!validation.valid) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const db = c.env.DB;
    const theme = await createTheme(
      db,
      authUser.userId,
      body.name,
      body.description,
      body.styles,
      body.isPublic || false
    );

    if (!theme) {
      return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to create theme');
    }

    return c.json({ data: theme }, 201);
  } catch (error) {
    console.error('POST /api/themes error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to create theme');
  }
});

export const onRequest = app.fetch;
```

### Step 4: Verify File Structure

Confirm endpoint files are in place:

```bash
ls -la /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/
```

Expected output: Should show `index.ts` and `mine.ts`.

### Step 5: Test the Endpoint Locally

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

In another terminal, test with a valid auth token:

```bash
# Test creating a theme
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Theme",
    "description": "A test theme",
    "styles": {
      "primary": "#000000",
      "secondary": "#FFFFFF",
      "accent": "#0066FF",
      "background": "#FFFFFF",
      "surface": "#F5F5F5",
      "text": "#000000",
      "textSecondary": "#666666",
      "border": "#E0E0E0",
      "fontFamily": "system-ui",
      "fontSizeBase": "16px",
      "lineHeightBase": "1.5",
      "borderRadius": "0.25rem"
    }
  }'

# Test creating a public theme
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Public Theme",
    "description": "A public theme",
    "isPublic": true,
    "styles": { ... }
  }'
```

---

## Files to Create/Modify

**Create:**
- None (new functions added to existing files)

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts` - Add CreateThemeRequest, validation
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` - Add createTheme function
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/index.ts` - Add POST handler

---

## Verification

### Test 1: Unauthenticated Request Returns 401

```bash
curl -X POST http://localhost:8787/api/themes \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "styles": {}}'
```

Expected: `401` status with error message.

### Test 2: Valid Theme Creation Returns 201

```bash
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Theme",
    "styles": {
      "primary": "#000000",
      "secondary": "#FFFFFF",
      "accent": "#0066FF",
      "background": "#FFFFFF",
      "surface": "#F5F5F5",
      "text": "#000000",
      "textSecondary": "#666666",
      "border": "#E0E0E0",
      "fontFamily": "system-ui",
      "fontSizeBase": "16px",
      "lineHeightBase": "1.5",
      "borderRadius": "0.25rem"
    }
  }'
```

Expected: `201` status with created theme object.

### Test 3: Missing Name Returns 400

```bash
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"styles": {}}'
```

Expected: `400` status with validation error.

### Test 4: Missing Required Style Fields Returns 400

```bash
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Incomplete Theme",
    "styles": {
      "primary": "#000000"
    }
  }'
```

Expected: `400` status listing missing style fields.

### Test 5: Invalid Color Format Returns 400

```bash
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Colors",
    "styles": {
      "primary": "not-a-color",
      ...
    }
  }'
```

Expected: `400` status with color validation error.

### Test 6: Created Theme Has All Required Fields

```bash
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Test", ... }' | jq '.data | keys'
```

Expected: Includes id, name, description, isSystem, isPublic, creator, copiedFrom, previewUrl, usageCount, styles, createdAt, updatedAt.

### Test 7: Creator Info Matches Authenticated User

```bash
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Test", ... }' | jq '.data.creator.id'
```

Expected: Matches authenticated user's ID.

### Test 8: Theme Can Be Made Public

```bash
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Public Theme",
    "isPublic": true,
    "styles": { ... }
  }' | jq '.data.isPublic'
```

Expected: `true`.

### Test 9: Theme is Private By Default

```bash
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Private Theme",
    "styles": { ... }
  }' | jq '.data.isPublic'
```

Expected: `false`.

### Test 10: System Flag Always False

```bash
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Test", ... }' | jq '.data.isSystem'
```

Expected: Always `false`.

---

## Success Criteria

- [ ] CreateThemeRequest and validation types added
- [ ] createTheme database function added
- [ ] POST /api/themes endpoint implemented
- [ ] Unauthenticated requests return 401
- [ ] Valid requests return 201 with created theme
- [ ] Missing name returns 400 validation error
- [ ] Missing style fields return 400 validation error
- [ ] Invalid color formats return 400 validation error
- [ ] Created theme has all required fields
- [ ] creator info matches authenticated user
- [ ] isPublic defaults to false
- [ ] isSystem always false for user-created themes
- [ ] Styles are properly stored and returned

---

## Next Steps

Once verified, proceed to:
- **Build 108:** PATCH /api/themes/:id endpoint for updating themes
- **Build 109:** DELETE /api/themes/:id endpoint for deleting themes
- **Build 110:** POST /api/themes/:id/copy endpoint for copying themes
