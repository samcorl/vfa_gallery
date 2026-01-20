# Build 110: POST /api/themes/:id/copy Endpoint

## Goal

Create the `POST /api/themes/:id/copy` endpoint that allows authenticated users to copy any public or system theme to their own collection. The copied theme becomes editable and the original theme is referenced via the `copiedFrom` field.

---

## Spec Extract

**Endpoint:** `POST /api/themes/:id/copy`

**Authentication:** Required (JWT token)

**URL Parameters:**
- `id` - Source theme ID to copy (must be public or system theme)

**Request Body (optional):**
```json
{
  "name": "Custom Name (Optional)",
  "description": "Custom description (Optional)"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "theme-user-copy-abc123",
    "name": "System Light (Copy)",
    "description": "A copy of the system light theme",
    "isSystem": false,
    "isPublic": false,
    "creator": {
      "id": "user_xyz789",
      "username": "current-user",
      "displayName": "Current User",
      "avatarUrl": "https://..."
    },
    "copiedFrom": "theme-system-light",
    "previewUrl": "https://...",
    "usageCount": 0,
    "styles": {
      "primary": "#000000",
      ...
    },
    "createdAt": "2026-01-19T10:30:00Z",
    "updatedAt": "2026-01-19T10:30:00Z"
  }
}
```

**Error Responses:**
- `400 BAD_REQUEST` - Name exceeds length limit
- `401 UNAUTHORIZED` - Not authenticated
- `404 NOT_FOUND` - Source theme not found or not public/system
- `500 INTERNAL_ERROR` - Server error

**Behavior:**
- Only public or system themes can be copied
- Cannot copy a theme you already own (return 400)
- Copied theme name defaults to "Original Name (Copy)"
- User can optionally provide custom name and description
- Copied theme is created as private (isPublic: false)
- Original theme ID stored in copiedFrom field
- Returns 201 with newly created theme
- Returns 404 if source theme doesn't exist or is private
- Returns 400 if user already owns the source theme

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware with JWT verification
- **11-SCHEMA-THEMES.md** - Themes table schema created
- **105-API-THEME-LIST.md** - Theme types and queries
- **107-API-THEME-CREATE.md** - Theme creation logic

**Reason:** This endpoint requires authentication, queries public/system themes, and creates new themes.

---

## Steps

### Step 1: Add Theme Copy Request Type

Add request type for copying themes:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts` (modify existing)

Add this interface:

```typescript
/**
 * Request body for copying a theme
 * All fields are optional (defaults will be generated)
 */
export interface CopyThemeRequest {
  name?: string;
  description?: string | null;
}

/**
 * Validation result for theme copy request
 */
export interface CopyThemeValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate theme copy request
 */
export function validateCopyThemeRequest(
  data: any
): CopyThemeValidationResult {
  const errors: string[] = [];

  // Validate name if provided
  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      errors.push('name must be a string');
    } else if (data.name.trim().length === 0) {
      errors.push('name cannot be empty');
    } else if (data.name.length > 100) {
      errors.push('name cannot exceed 100 characters');
    }
  }

  // Validate description if provided
  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== 'string') {
      errors.push('description must be a string');
    } else if (data.description.length > 500) {
      errors.push('description cannot exceed 500 characters');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### Step 2: Add Theme Copy Database Function

Add function to copy themes:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` (modify existing)

Add this function:

```typescript
/**
 * Copy a public or system theme to user's collection
 * Only public or system themes can be copied
 */
export async function copyTheme(
  db: D1Database,
  sourceThemeId: string,
  userId: string,
  customName?: string,
  customDescription?: string | null
): Promise<ThemeResponse | null> {
  try {
    // Fetch the source theme
    const sourceTheme = await getThemeById(db, sourceThemeId);

    if (!sourceTheme) {
      return null;
    }

    // Verify source theme is public or system
    if (!sourceTheme.isPublic && !sourceTheme.isSystem) {
      throw new Error('FORBIDDEN: Cannot copy private themes');
    }

    // Verify user doesn't already own the theme
    if (sourceTheme.creator?.id === userId) {
      throw new Error('BAD_REQUEST: Cannot copy your own theme');
    }

    // Generate name for copied theme
    const baseName = customName || `${sourceTheme.name} (Copy)`;
    const themeName = baseName.trim();

    // Use custom description or default to empty
    const themeDescription = customDescription !== undefined ? customDescription : null;

    // Create the copied theme using existing createTheme function
    const copiedTheme = await createTheme(
      db,
      userId,
      themeName,
      themeDescription,
      sourceTheme.styles,
      false // Always private initially
    );

    if (!copiedTheme) {
      return null;
    }

    // Update the copiedFrom field to reference the original theme
    await db
      .prepare(
        `UPDATE themes
         SET copied_from = ?1
         WHERE id = ?2`
      )
      .bind(sourceThemeId, copiedTheme.id)
      .run();

    // Fetch and return the updated theme with copiedFrom field
    const finalTheme = await getThemeById(db, copiedTheme.id);
    return finalTheme;
  } catch (error) {
    console.error('Error copying theme:', error);
    if (error instanceof Error && (error.message.startsWith('FORBIDDEN') || error.message.startsWith('BAD_REQUEST'))) {
      throw error;
    }
    return null;
  }
}
```

### Step 3: Create API Endpoint Handler

Create a new file for the copy endpoint:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id]/copy.ts`

```typescript
import { Hono } from 'hono';
import type { HonoEnv } from '../../../../src/types/env';
import { withAuth } from '../../../../src/lib/api/middleware/auth';
import { getThemeById, copyTheme } from '../../../../src/lib/db/themes';
import { validateCopyThemeRequest } from '../../../../src/types/theme';
import { errorResponse } from '../../../../src/lib/api/errors';

const app = new Hono<HonoEnv>();

/**
 * POST /api/themes/:id/copy
 * Copy a public or system theme to user's collection
 * Requires authentication
 */
app.post('/', withAuth, async (c) => {
  try {
    const authUser = c.get('user');

    if (!authUser) {
      return errorResponse(c, 401, 'UNAUTHORIZED', 'Not authenticated');
    }

    const sourceThemeId = c.req.param('id');

    if (!sourceThemeId) {
      return errorResponse(c, 400, 'MISSING_ID', 'Theme ID is required');
    }

    // Parse request body (optional)
    let body: any = {};
    try {
      if (c.req.header('content-length') && parseInt(c.req.header('content-length') || '0') > 0) {
        body = await c.req.json();
      }
    } catch (error) {
      return errorResponse(c, 400, 'INVALID_JSON', 'Request body must be valid JSON');
    }

    // Validate request
    const validation = validateCopyThemeRequest(body);
    if (!validation.valid) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const db = c.env.DB;

    // Check if source theme exists and is public/system
    const sourceTheme = await getThemeById(db, sourceThemeId);

    if (!sourceTheme) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Theme not found');
    }

    if (!sourceTheme.isPublic && !sourceTheme.isSystem) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Cannot copy private themes');
    }

    // Copy theme
    try {
      const copiedTheme = await copyTheme(
        db,
        sourceThemeId,
        authUser.userId,
        body.name,
        body.description
      );

      if (!copiedTheme) {
        return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to copy theme');
      }

      return c.json({ data: copiedTheme }, 201);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('FORBIDDEN')) {
          return errorResponse(c, 403, 'FORBIDDEN', error.message.replace('FORBIDDEN: ', ''));
        }
        if (error.message.startsWith('BAD_REQUEST')) {
          return errorResponse(c, 400, 'BAD_REQUEST', error.message.replace('BAD_REQUEST: ', ''));
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('POST /api/themes/:id/copy error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to copy theme');
  }
});

export const onRequest = app.fetch;
```

### Step 4: Verify File Structure

Confirm the endpoint file is created:

```bash
ls -la /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/
```

Expected output: Should show subdirectories including `[id]`.

```bash
ls -la /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id]/
```

Expected output: Should show `copy.ts` file.

### Step 5: Test the Endpoint Locally

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

In another terminal, test with a valid auth token and a public/system theme:

```bash
# Copy a system theme with default name
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Copy a theme with custom name
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Light Theme",
    "description": "Customized for my gallery"
  }'

# Copy without body
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id]/copy.ts` - Copy endpoint handler

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/theme.ts` - Add CopyThemeRequest, validation
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` - Add copyTheme function

---

## Verification

### Test 1: Unauthenticated Request Returns 401

```bash
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Content-Type: application/json"
```

Expected: `401` status with error message.

### Test 2: Copy Nonexistent Theme Returns 404

```bash
curl -X POST http://localhost:8787/api/themes/nonexistent-id/copy \
  -H "Authorization: Bearer YOUR_VALID_TOKEN"
```

Expected: `404` status with NOT_FOUND error.

### Test 3: Copy Private Theme Returns 404

```bash
curl -X POST http://localhost:8787/api/themes/PRIVATE_THEME_ID/copy \
  -H "Authorization: Bearer YOUR_VALID_TOKEN"
```

Expected: `404` status with NOT_FOUND error (cannot copy private themes).

### Test 4: Copy System Theme Returns 201

```bash
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq '.data.id'
```

Expected: `201` status with new theme ID.

### Test 5: Copied Theme Has Default Name

```bash
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq '.data.name'
```

Expected: "System Light (Copy)".

### Test 6: Copied Theme Can Have Custom Name

```bash
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Custom Theme"}' | jq '.data.name'
```

Expected: "My Custom Theme".

### Test 7: copiedFrom Field References Original

```bash
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq '.data.copiedFrom'
```

Expected: "theme-system-light".

### Test 8: Copied Theme is Private By Default

```bash
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq '.data.isPublic'
```

Expected: `false`.

### Test 9: Copied Theme Inherits Styles

```bash
# Get original theme styles
ORIGINAL=$(curl -s http://localhost:8787/api/themes \
  | jq '.data[] | select(.id == "theme-system-light") | .styles.primary')

# Copy theme
COPIED=$(curl -s -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  | jq '.data.styles.primary')

# Compare
[ "$ORIGINAL" = "$COPIED" ] && echo "Styles match"
```

Expected: Copied theme has identical styles to original.

### Test 10: Copied Theme Appears in My Themes

```bash
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq '.data.id' > /tmp/copied_id.txt

COPIED_ID=$(cat /tmp/copied_id.txt | tr -d '"')

curl -s http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq ".data[] | select(.id == \"$COPIED_ID\") | .id"
```

Expected: Copied theme appears in user's theme list.

### Test 11: Cannot Copy Own Theme Returns 400

```bash
# Create a public theme
curl -X POST http://localhost:8787/api/themes \
  -H "Authorization: Bearer USER_TOKEN" \
  -d '{"name": "My Public Theme", "isPublic": true, ...}' | jq '.data.id' > /tmp/own_theme.ts

OWN_THEME=$(cat /tmp/own_theme.ts | tr -d '"')

# Try to copy your own theme
curl -X POST http://localhost:8787/api/themes/$OWN_THEME/copy \
  -H "Authorization: Bearer USER_TOKEN"
```

Expected: `400` status with BAD_REQUEST error.

### Test 12: Custom Description In Copy

```bash
curl -X POST http://localhost:8787/api/themes/theme-system-light/copy \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "My custom description for this copy"
  }' | jq '.data.description'
```

Expected: "My custom description for this copy".

---

## Success Criteria

- [ ] CopyThemeRequest type and validation added
- [ ] copyTheme database function added
- [ ] POST endpoint handler created at `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id]/copy.ts`
- [ ] Unauthenticated requests return 401
- [ ] Nonexistent themes return 404
- [ ] Private themes cannot be copied (return 404)
- [ ] System themes can be copied successfully
- [ ] Public user themes can be copied
- [ ] Copied theme returns 201 with new theme object
- [ ] Default name is "Original Name (Copy)"
- [ ] Custom name can be provided
- [ ] copiedFrom field references original theme
- [ ] Copied theme is private by default
- [ ] Copied theme inherits all styles from original
- [ ] Copied theme creator is authenticated user
- [ ] Copied theme appears in user's /api/themes/mine
- [ ] Cannot copy own theme (returns 400)
- [ ] Custom description can be provided

---

## Next Steps

Once verified, proceed to:
- **Build 111:** UI Theme Picker component for selecting themes
- **Build 112:** UI Theme Preview component for displaying theme previews
