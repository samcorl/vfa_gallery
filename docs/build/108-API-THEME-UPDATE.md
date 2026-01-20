# Build 108: PATCH /api/themes/:id Endpoint

## Goal

Create the `PATCH /api/themes/:id` endpoint that allows users to update their custom themes. Only the theme owner can update a theme. System themes cannot be updated via API.

---

## Spec Extract

**Endpoint:** `PATCH /api/themes/:id`

**Authentication:** Required (JWT token)

**URL Parameters:**
- `id` - Theme ID to update

**Request Body (all fields optional):**
```json
{
  "name": "Updated Theme Name",
  "description": "Updated description",
  "isPublic": true,
  "styles": {
    "primary": "#1E3A8A",
    "secondary": "#F3F4F6",
    "accent": "#DC2626",
    "background": "#FFFFFF",
    "surface": "#F9FAFB",
    "text": "#111827",
    "textSecondary": "#6B7280",
    "border": "#E5E7EB",
    "fontFamily": "system-ui",
    "fontSizeBase": "16px",
    "lineHeightBase": "1.5",
    "borderRadius": "0.25rem"
  }
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "theme-user-abc123",
    "name": "Updated Theme Name",
    "description": "Updated description",
    "isSystem": false,
    "isPublic": true,
    "creator": {
      "id": "user_xyz789",
      "username": "artist-name",
      "displayName": "Artist Name",
      "avatarUrl": "https://..."
    },
    "copiedFrom": null,
    "previewUrl": "https://...",
    "usageCount": 2,
    "styles": {
      "primary": "#1E3A8A",
      ...
    },
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-01-19T15:45:00Z"
  }
}
```

**Error Responses:**
- `400 BAD_REQUEST` - Invalid request body or invalid color formats
- `401 UNAUTHORIZED` - Not authenticated
- `403 FORBIDDEN` - Authenticated user is not the theme owner
- `404 NOT_FOUND` - Theme does not exist
- `500 INTERNAL_ERROR` - Server error

**Behavior:**
- Only theme owner can update their theme
- System themes cannot be updated
- Can update any combination of fields
- At least one field must be provided (empty PATCH returns 400)
- If styles provided, must include all required style fields
- Returns 200 with updated theme on success
- Returns 403 if user tries to update someone else's theme
- Returns 404 if theme doesn't exist

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware with JWT verification
- **11-SCHEMA-THEMES.md** - Themes table schema created
- **105-API-THEME-LIST.md** - Theme types and queries
- **107-API-THEME-CREATE.md** - Theme validation

**Reason:** This endpoint requires ownership verification and uses themes table.

---

## Steps

### Step 1: Add Update Request Validation Type

Add request type and validation for theme updates:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts` (modify existing)

Add these interfaces:

```typescript
/**
 * Request body for updating a theme
 * All fields are optional
 */
export interface UpdateThemeRequest {
  name?: string;
  description?: string | null;
  isPublic?: boolean;
  styles?: Partial<ThemeStyles>;
}

/**
 * Validation result for theme update request
 */
export interface UpdateThemeValidationResult {
  valid: boolean;
  errors: string[];
  hasChanges: boolean;
}

/**
 * Validate theme update request
 * At least one field must be provided
 */
export function validateUpdateThemeRequest(
  data: any
): UpdateThemeValidationResult {
  const errors: string[] = [];
  let hasChanges = false;

  // Check if any fields provided
  if (
    data.name === undefined &&
    data.description === undefined &&
    data.isPublic === undefined &&
    data.styles === undefined
  ) {
    errors.push('At least one field must be provided to update');
    return { valid: false, errors, hasChanges: false };
  }

  // Validate name if provided
  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      errors.push('name must be a string');
    } else if (data.name.trim().length === 0) {
      errors.push('name cannot be empty');
    } else if (data.name.length > 100) {
      errors.push('name cannot exceed 100 characters');
    } else {
      hasChanges = true;
    }
  }

  // Validate description if provided
  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== 'string') {
      errors.push('description must be a string');
    } else if (data.description.length > 500) {
      errors.push('description cannot exceed 500 characters');
    } else {
      hasChanges = true;
    }
  } else if (data.description === null) {
    hasChanges = true;
  }

  // Validate isPublic if provided
  if (data.isPublic !== undefined) {
    if (typeof data.isPublic !== 'boolean') {
      errors.push('isPublic must be a boolean');
    } else {
      hasChanges = true;
    }
  }

  // Validate styles if provided
  if (data.styles !== undefined) {
    if (typeof data.styles !== 'object' || Array.isArray(data.styles)) {
      errors.push('styles must be an object');
    } else {
      // Validate color fields (basic hex color check)
      const colorFields = [
        'primary',
        'secondary',
        'accent',
        'background',
        'surface',
        'text',
        'textSecondary',
        'border',
      ];
      for (const field of colorFields) {
        if (data.styles[field]) {
          const colorValue = data.styles[field];
          if (!/^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
            errors.push(`styles.${field} must be a valid hex color (e.g., #FFFFFF)`);
          }
        }
      }
      if (Object.keys(data.styles).length > 0) {
        hasChanges = true;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    hasChanges,
  };
}
```

### Step 2: Add Theme Update Database Function

Add function to update themes:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` (modify existing)

Add this function:

```typescript
/**
 * Update an existing theme
 * Only updates fields that are provided
 */
export async function updateTheme(
  db: D1Database,
  themeId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string | null;
    isPublic?: boolean;
    styles?: Partial<ThemeStyles>;
  }
): Promise<ThemeResponse | null> {
  try {
    // First, fetch the current theme to verify ownership and check if system theme
    const currentTheme = await getThemeById(db, themeId);

    if (!currentTheme) {
      return null;
    }

    // Verify ownership (creator ID must match user ID)
    if (currentTheme.creator?.id !== userId) {
      throw new Error('FORBIDDEN: Cannot update theme owned by another user');
    }

    // Verify not a system theme
    if (currentTheme.isSystem) {
      throw new Error('FORBIDDEN: Cannot update system themes');
    }

    // Build update query dynamically based on provided fields
    const updates_to_apply: any[] = [];
    const values: any[] = [themeId, userId];

    if (updates.name !== undefined) {
      updates_to_apply.push('name = ?3');
      values.push(updates.name.trim());
    }

    if (updates.description !== undefined) {
      updates_to_apply.push(`description = ?${values.length + 1}`);
      values.push(updates.description ? updates.description.trim() : null);
    }

    if (updates.isPublic !== undefined) {
      updates_to_apply.push(`is_public = ?${values.length + 1}`);
      values.push(updates.isPublic ? 1 : 0);
    }

    if (updates.styles !== undefined) {
      // Merge with existing styles to preserve unmodified fields
      const mergedStyles = {
        ...currentTheme.styles,
        ...updates.styles,
      };
      updates_to_apply.push(`styles = ?${values.length + 1}`);
      values.push(JSON.stringify(mergedStyles));
    }

    if (updates_to_apply.length === 0) {
      return currentTheme;
    }

    // Always update the updated_at timestamp
    const now = new Date().toISOString();
    updates_to_apply.push(`updated_at = ?${values.length + 1}`);
    values.push(now);

    const setClause = updates_to_apply.join(', ');
    const query = `UPDATE themes SET ${setClause} WHERE id = ? AND created_by = ?`;

    await db
      .prepare(query)
      .bind(...values)
      .run();

    // Fetch and return the updated theme
    return await getThemeById(db, themeId);
  } catch (error) {
    console.error('Error updating theme:', error);
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      throw error;
    }
    return null;
  }
}
```

### Step 3: Create API Endpoint Handler

Create a new file for the PATCH endpoint:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id].ts`

```typescript
import { Hono } from 'hono';
import type { HonoEnv } from '../../../src/types/env';
import { withAuth } from '../../../src/lib/api/middleware/auth';
import { getThemeById, updateTheme } from '../../../src/lib/db/themes';
import { validateUpdateThemeRequest } from '../../../src/types/theme';
import { errorResponse } from '../../../src/lib/api/errors';

const app = new Hono<HonoEnv>();

/**
 * PATCH /api/themes/:id
 * Update an existing theme
 * Requires authentication and ownership
 */
app.patch('/:id', withAuth, async (c) => {
  try {
    const authUser = c.get('user');

    if (!authUser) {
      return errorResponse(c, 401, 'UNAUTHORIZED', 'Not authenticated');
    }

    const themeId = c.req.param('id');

    if (!themeId) {
      return errorResponse(c, 400, 'MISSING_ID', 'Theme ID is required');
    }

    // Parse request body
    let body: any;
    try {
      body = await c.req.json();
    } catch (error) {
      return errorResponse(c, 400, 'INVALID_JSON', 'Request body must be valid JSON');
    }

    // Validate request
    const validation = validateUpdateThemeRequest(body);
    if (!validation.valid) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    // Check theme exists
    const db = c.env.DB;
    const theme = await getThemeById(db, themeId);

    if (!theme) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Theme not found');
    }

    // Check ownership
    if (theme.creator?.id !== authUser.userId) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Cannot update theme owned by another user');
    }

    // Check if system theme
    if (theme.isSystem) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Cannot update system themes');
    }

    // Update theme
    try {
      const updatedTheme = await updateTheme(db, themeId, authUser.userId, body);

      if (!updatedTheme) {
        return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to update theme');
      }

      return c.json({ data: updatedTheme });
    } catch (error) {
      if (error instanceof Error && error.message.includes('FORBIDDEN')) {
        return errorResponse(c, 403, 'FORBIDDEN', error.message.replace('FORBIDDEN: ', ''));
      }
      throw error;
    }
  } catch (error) {
    console.error('PATCH /api/themes/:id error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to update theme');
  }
});

export const onRequest = app.fetch;
```

### Step 4: Verify File Structure

Confirm endpoint files are in place:

```bash
ls -la /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/
```

Expected output: Should show `index.ts`, `mine.ts`, and `[id].ts`.

### Step 5: Test the Endpoint Locally

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

In another terminal, test with a valid auth token and an existing user theme:

```bash
# Update theme name
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Theme Name"}'

# Update only styles
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "styles": {
      "primary": "#FF0000",
      "accent": "#00FF00"
    }
  }'

# Update multiple fields
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated",
    "isPublic": true,
    "description": "New description"
  }'
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id].ts` - PATCH endpoint handler

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts` - Add UpdateThemeRequest, validation
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` - Add updateTheme function

---

## Verification

### Test 1: Unauthenticated Request Returns 401

```bash
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated"}'
```

Expected: `401` status with error message.

### Test 2: Update Nonexistent Theme Returns 404

```bash
curl -X PATCH http://localhost:8787/api/themes/nonexistent-id \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated"}'
```

Expected: `404` status with NOT_FOUND error.

### Test 3: Update Someone Else's Theme Returns 403

```bash
curl -X PATCH http://localhost:8787/api/themes/OTHER_USER_THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacked"}'
```

Expected: `403` status with FORBIDDEN error.

### Test 4: Empty PATCH Returns 400

```bash
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `400` status with validation error.

### Test 5: Update Name Successfully

```bash
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Name"}' | jq '.data.name'
```

Expected: Returns updated name.

### Test 6: Update Description To Null

```bash
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": null}' | jq '.data.description'
```

Expected: `null`.

### Test 7: Update isPublic

```bash
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isPublic": true}' | jq '.data.isPublic'
```

Expected: `true`.

### Test 8: Update Partial Styles

```bash
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"styles": {"primary": "#FF0000"}}' | jq '.data.styles.primary'
```

Expected: `"#FF0000"` (other style fields unchanged).

### Test 9: Invalid Color Returns 400

```bash
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"styles": {"primary": "not-a-color"}}'
```

Expected: `400` status with validation error.

### Test 10: Updated Timestamp Changes

```bash
# Get original timestamp
ORIGINAL=$(curl -s http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq -r '.data[0].updatedAt')

# Update theme
curl -X PATCH http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated"}'

# Get new timestamp
NEW=$(curl -s http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq -r '.data[0].updatedAt')

# Compare
[ "$ORIGINAL" != "$NEW" ] && echo "Timestamp updated"
```

Expected: Timestamps should differ.

---

## Success Criteria

- [ ] UpdateThemeRequest type and validation added
- [ ] updateTheme database function added
- [ ] PATCH endpoint handler created at `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id].ts`
- [ ] Unauthenticated requests return 401
- [ ] Nonexistent themes return 404
- [ ] Attempts to update other users' themes return 403
- [ ] Attempts to update system themes return 403
- [ ] Empty PATCH returns 400
- [ ] Valid updates return 200 with updated theme
- [ ] Name, description, isPublic can be updated
- [ ] Partial style updates work (preserving unchanged fields)
- [ ] Invalid colors return 400
- [ ] updatedAt timestamp changes on updates

---

## Next Steps

Once verified, proceed to:
- **Build 109:** DELETE /api/themes/:id endpoint for deleting themes
- **Build 110:** POST /api/themes/:id/copy endpoint for copying themes
