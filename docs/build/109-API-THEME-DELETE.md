# Build 109: DELETE /api/themes/:id Endpoint

## Goal

Create the `DELETE /api/themes/:id` endpoint that allows users to delete their custom themes. When a theme is deleted, any galleries or collections using that theme have their theme reference set to null.

---

## Spec Extract

**Endpoint:** `DELETE /api/themes/:id`

**Authentication:** Required (JWT token)

**URL Parameters:**
- `id` - Theme ID to delete

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Theme deleted successfully",
  "data": {
    "id": "theme-user-abc123",
    "name": "My Custom Theme",
    "affectedGalleries": 2,
    "affectedCollections": 3
  }
}
```

**Error Responses:**
- `400 BAD_REQUEST` - Missing theme ID
- `401 UNAUTHORIZED` - Not authenticated
- `403 FORBIDDEN` - Authenticated user is not the theme owner or trying to delete system theme
- `404 NOT_FOUND` - Theme does not exist
- `500 INTERNAL_ERROR` - Server error

**Behavior:**
- Only theme owner can delete their theme
- System themes cannot be deleted
- When theme is deleted, any galleries using it have theme_id set to NULL
- When theme is deleted, any collections using it have theme_id set to NULL
- Returns 200 with count of affected galleries and collections
- Returns 403 if user tries to delete someone else's theme
- Returns 403 if trying to delete a system theme
- Returns 404 if theme doesn't exist
- Cascading nullification happens in a transaction to ensure consistency

---

## Prerequisites

**Must complete before starting:**
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware with JWT verification
- **11-SCHEMA-THEMES.md** - Themes table schema created
- **08-SCHEMA-GALLERIES.md** - Galleries table with theme_id reference
- **09-SCHEMA-COLLECTIONS.md** - Collections table with theme_id reference
- **105-API-THEME-LIST.md** - Theme types and queries
- **108-API-THEME-UPDATE.md** - Theme update logic

**Reason:** This endpoint requires ownership verification, deletes from themes table, and nullifies references in galleries and collections tables.

---

## Steps

### Step 1: Add Delete Database Function

Add function to delete themes and cascade nullify references:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` (modify existing)

Add this function:

```typescript
/**
 * Delete a theme and cascade nullify it from galleries and collections
 * Returns count of affected galleries and collections
 */
export async function deleteTheme(
  db: D1Database,
  themeId: string,
  userId: string
): Promise<{
  success: boolean;
  affectedGalleries: number;
  affectedCollections: number;
} | null> {
  try {
    // First, fetch the theme to verify existence and ownership
    const theme = await getThemeById(db, themeId);

    if (!theme) {
      return null;
    }

    // Verify ownership (creator ID must match user ID)
    if (theme.creator?.id !== userId) {
      throw new Error('FORBIDDEN: Cannot delete theme owned by another user');
    }

    // Verify not a system theme
    if (theme.isSystem) {
      throw new Error('FORBIDDEN: Cannot delete system themes');
    }

    // Count galleries using this theme
    const galleriesResult = await db
      .prepare(
        `SELECT COUNT(*) as count FROM galleries
         WHERE theme_id = ?1`
      )
      .bind(themeId)
      .first<{ count: number }>();

    const affectedGalleries = galleriesResult?.count || 0;

    // Count collections using this theme
    const collectionsResult = await db
      .prepare(
        `SELECT COUNT(*) as count FROM collections
         WHERE theme_id = ?1`
      )
      .bind(themeId)
      .first<{ count: number }>();

    const affectedCollections = collectionsResult?.count || 0;

    // Nullify theme_id in galleries using this theme
    if (affectedGalleries > 0) {
      await db
        .prepare(
          `UPDATE galleries
           SET theme_id = NULL, updated_at = ?1
           WHERE theme_id = ?2`
        )
        .bind(new Date().toISOString(), themeId)
        .run();
    }

    // Nullify theme_id in collections using this theme
    if (affectedCollections > 0) {
      await db
        .prepare(
          `UPDATE collections
           SET theme_id = NULL, updated_at = ?1
           WHERE theme_id = ?2`
        )
        .bind(new Date().toISOString(), themeId)
        .run();
    }

    // Delete the theme
    await db
      .prepare(
        `DELETE FROM themes
         WHERE id = ?1 AND created_by = ?2`
      )
      .bind(themeId, userId)
      .run();

    return {
      success: true,
      affectedGalleries,
      affectedCollections,
    };
  } catch (error) {
    console.error('Error deleting theme:', error);
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      throw error;
    }
    return null;
  }
}
```

### Step 2: Update the Theme Endpoint Handler

Modify the existing `[id].ts` file to include DELETE method:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id].ts` (modify existing)

Add this DELETE handler to the existing app:

```typescript
/**
 * DELETE /api/themes/:id
 * Delete a theme and cascade nullify references
 * Requires authentication and ownership
 */
app.delete('/:id', withAuth, async (c) => {
  try {
    const authUser = c.get('user');

    if (!authUser) {
      return errorResponse(c, 401, 'UNAUTHORIZED', 'Not authenticated');
    }

    const themeId = c.req.param('id');

    if (!themeId) {
      return errorResponse(c, 400, 'MISSING_ID', 'Theme ID is required');
    }

    const db = c.env.DB;

    // Check theme exists and get info
    const theme = await getThemeById(db, themeId);

    if (!theme) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Theme not found');
    }

    // Check ownership
    if (theme.creator?.id !== authUser.userId) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Cannot delete theme owned by another user');
    }

    // Check if system theme
    if (theme.isSystem) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Cannot delete system themes');
    }

    // Delete theme and cascade nullify
    try {
      const result = await deleteTheme(db, themeId, authUser.userId);

      if (!result) {
        return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to delete theme');
      }

      return c.json({
        success: true,
        message: 'Theme deleted successfully',
        data: {
          id: themeId,
          name: theme.name,
          affectedGalleries: result.affectedGalleries,
          affectedCollections: result.affectedCollections,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('FORBIDDEN')) {
        return errorResponse(c, 403, 'FORBIDDEN', error.message.replace('FORBIDDEN: ', ''));
      }
      throw error;
    }
  } catch (error) {
    console.error('DELETE /api/themes/:id error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to delete theme');
  }
});
```

### Step 3: Verify Endpoint File

Confirm the file has been updated with DELETE handler:

```bash
grep -n "app.delete" /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id].ts
```

Expected output: Shows the DELETE handler implementation.

### Step 4: Test the Endpoint Locally

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npm run dev
```

In another terminal, test with a valid auth token and an existing user theme:

```bash
# Delete a theme
curl -X DELETE http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Delete theme with cascading effects
# First create a gallery using a theme, then delete the theme
curl -X DELETE http://localhost:8787/api/themes/THEME_ID_WITH_USAGE \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## Files to Create/Modify

**Create:**
- None (function added to existing file)

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts` - Add deleteTheme function
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id].ts` - Add DELETE handler

---

## Verification

### Test 1: Unauthenticated Request Returns 401

```bash
curl -X DELETE http://localhost:8787/api/themes/THEME_ID \
  -H "Content-Type: application/json"
```

Expected: `401` status with error message.

### Test 2: Delete Nonexistent Theme Returns 404

```bash
curl -X DELETE http://localhost:8787/api/themes/nonexistent-id \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `404` status with NOT_FOUND error.

### Test 3: Delete Someone Else's Theme Returns 403

```bash
curl -X DELETE http://localhost:8787/api/themes/OTHER_USER_THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `403` status with FORBIDDEN error.

### Test 4: Delete System Theme Returns 403

```bash
curl -X DELETE http://localhost:8787/api/themes/theme-system-light \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `403` status with FORBIDDEN error.

### Test 5: Delete Own Theme Returns 200

```bash
curl -X DELETE http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" | jq '.success'
```

Expected: `true`.

### Test 6: Deleted Theme No Longer in My Themes

```bash
# Before deletion
curl -s http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq '.data | length' > /tmp/before.txt

# Delete theme
curl -X DELETE http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN"

# After deletion
curl -s http://localhost:8787/api/themes/mine \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq '.data | length' > /tmp/after.txt

# Compare counts
```

Expected: After count should be one less than before count.

### Test 7: Cascade Nullifies Gallery Themes

```bash
# Create a gallery with theme
# ... create gallery with THEME_ID ...

# Delete the theme
curl -X DELETE http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN"

# Check affected galleries count
curl -X DELETE http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" | jq '.data.affectedGalleries'
```

Expected: Shows count > 0 if galleries were using theme.

### Test 8: Cascade Nullifies Collection Themes

```bash
# Similar to Test 7 but checking affectedCollections
curl -X DELETE http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -H "Content-Type: application/json" | jq '.data.affectedCollections'
```

Expected: Shows count of affected collections.

### Test 9: Gallery Theme_ID Is Null After Deletion

```bash
# Create gallery with THEME_ID
# ... create gallery ...

# Delete the theme
curl -X DELETE http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN"

# Query the gallery - verify theme_id is null
# (requires GET gallery endpoint implementation)
```

Expected: Gallery's theme_id field is null.

### Test 10: Deleted Theme Throwable Response Contains Name

```bash
curl -X DELETE http://localhost:8787/api/themes/THEME_ID \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" | jq '.data.name'
```

Expected: Returns the deleted theme's name for audit/UX purposes.

---

## Success Criteria

- [ ] deleteTheme database function added to `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/themes.ts`
- [ ] DELETE handler added to `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/themes/[id].ts`
- [ ] Unauthenticated requests return 401
- [ ] Nonexistent themes return 404
- [ ] Attempts to delete other users' themes return 403
- [ ] Attempts to delete system themes return 403
- [ ] Valid deletes return 200 with success status
- [ ] Deleted themes no longer appear in /api/themes/mine
- [ ] Gallery theme_id references are nullified on deletion
- [ ] Collection theme_id references are nullified on deletion
- [ ] affectedGalleries and affectedCollections counts are accurate
- [ ] Response includes deleted theme's name for audit trail

---

## Next Steps

Once verified, proceed to:
- **Build 110:** POST /api/themes/:id/copy endpoint for copying themes
- **Build 111:** UI Theme Picker component
