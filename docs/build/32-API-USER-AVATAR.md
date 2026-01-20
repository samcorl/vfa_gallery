# Build 32: POST /api/users/me/avatar Endpoint

## Goal
Create the `POST /api/users/me/avatar` endpoint that accepts image uploads, stores them in R2 bucket, updates the user's avatar_url, and cleans up old avatars.

---

## Spec Extract

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `file`
- Accepted types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Max size: 2MB

**Response (200 OK):**
```json
{
  "id": "uuid",
  "username": "sam-corl",
  "displayName": "Sam Corl",
  "avatarUrl": "https://vfa-gallery.r2.dev/avatars/user-uuid/file-uuid.jpeg",
  "email": "sam@example.com",
  "bio": "Artist and designer",
  "website": "https://samcorl.com",
  "socials": { ... },
  "role": "user",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T14:30:00Z"
}
```

**Behavior:**
- Upload creates unique filename: `avatars/{userId}/{uuid}.{ext}`
- Old avatar automatically deleted from R2 if exists
- Returns updated user profile with new avatar URL
- Rejects unsupported file types with 400 error
- Rejects files larger than 2MB with 400 error

---

## Prerequisites

**Must complete before starting:**
- **31-API-USER-UPDATE.md** - User update endpoint and user database functions
- **05-R2-BUCKET-INIT.md** - R2 bucket binding configured
- **16-API-MIDDLEWARE-AUTH.md** - Authentication middleware

**Reason:** This endpoint modifies user profile and uploads to R2 storage.

---

## Steps

### Step 1: Create R2 Upload Utilities

Create utility functions for R2 bucket operations:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/storage/r2.ts`

```typescript
import type { R2Bucket } from '@cloudflare/workers-types';
import { randomUUID } from 'crypto';

/**
 * Allowed image MIME types and file extensions
 */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Maximum file size in bytes (2MB)
 */
export const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Upload file to R2 bucket
 * Returns public URL or null if upload fails
 */
export async function uploadToR2(
  bucket: R2Bucket,
  fileBuffer: ArrayBuffer,
  mimeType: string,
  userId: string,
  baseUrl: string
): Promise<string | null> {
  try {
    // Validate file type
    if (!ALLOWED_IMAGE_TYPES[mimeType]) {
      return null;
    }

    const ext = ALLOWED_IMAGE_TYPES[mimeType];
    const filename = `avatars/${userId}/${randomUUID()}.${ext}`;

    // Upload to R2
    await bucket.put(filename, fileBuffer, {
      httpMetadata: {
        contentType: mimeType,
      },
    });

    // Construct public URL
    return `${baseUrl}/${filename}`;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    return null;
  }
}

/**
 * Delete file from R2 bucket
 * Returns true if successful
 */
export async function deleteFromR2(bucket: R2Bucket, fileUrl: string): Promise<boolean> {
  try {
    // Extract filename from URL
    // Example: https://vfa-gallery.r2.dev/avatars/user-id/file-uuid.jpeg
    const urlParts = fileUrl.split('/');
    const filename = urlParts.slice(-3).join('/'); // Get avatars/user-id/file-uuid.jpeg

    if (!filename || !filename.startsWith('avatars/')) {
      return false;
    }

    await bucket.delete(filename);
    return true;
  } catch (error) {
    console.error('Error deleting from R2:', error);
    return false;
  }
}

/**
 * Extract old avatar filename from user's current avatar URL
 * Returns null if no valid old avatar exists
 */
export function extractOldAvatarPath(avatarUrl: string | null): string | null {
  if (!avatarUrl) {
    return null;
  }

  try {
    // Extract path from URL
    const urlParts = avatarUrl.split('/');
    const filename = urlParts.slice(-3).join('/'); // Get avatars/user-id/file-uuid.jpeg

    if (filename && filename.startsWith('avatars/')) {
      return filename;
    }
  } catch (error) {
    console.error('Error extracting old avatar path:', error);
  }

  return null;
}
```

### Step 2: Create File Processing Utilities

Create utilities to handle multipart form data and file validation:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/file-upload/parse.ts`

```typescript
/**
 * Parse multipart form data for file uploads
 * Works with Hono's built-in FormData support
 */
export interface ParsedFile {
  buffer: ArrayBuffer;
  mimeType: string;
  size: number;
  filename: string;
}

/**
 * Extract and validate file from FormData
 */
export async function parseUploadFile(formData: FormData): Promise<ParsedFile | null> {
  try {
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return null;
    }

    const buffer = await file.arrayBuffer();
    const mimeType = file.type;
    const size = buffer.byteLength;
    const filename = file.name;

    return {
      buffer,
      mimeType,
      size,
      filename,
    };
  } catch (error) {
    console.error('Error parsing upload file:', error);
    return null;
  }
}

/**
 * Validate uploaded file
 * Returns validation errors (empty array if valid)
 */
export function validateUploadFile(
  file: ParsedFile,
  maxSize: number,
  allowedTypes: Record<string, string>
): string[] {
  const errors: string[] = [];

  // Check file type
  if (!allowedTypes[file.mimeType]) {
    errors.push(`File type ${file.mimeType} not allowed. Allowed types: ${Object.keys(allowedTypes).join(', ')}`);
  }

  // Check file size
  if (file.size > maxSize) {
    errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum of ${(maxSize / 1024 / 1024).toFixed(2)}MB`);
  }

  // Check file size not empty
  if (file.size === 0) {
    errors.push('File is empty');
  }

  return errors;
}
```

### Step 3: Update User Database Module

Add function to update avatar URL:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts` (modify existing)

Add this function:

```typescript
/**
 * Update user's avatar URL
 */
export async function updateUserAvatarUrl(
  db: D1Database,
  userId: string,
  avatarUrl: string | null
): Promise<UserProfileResponse | null> {
  try {
    const query = 'UPDATE users SET avatar_url = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2';
    await db.prepare(query).bind(avatarUrl, userId).run();

    return getUserById(db, userId);
  } catch (error) {
    console.error('Error updating avatar URL:', error);
    return null;
  }
}
```

### Step 4: Create API Endpoint Handler

Create the POST /api/users/me/avatar endpoint:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/users/me/avatar.ts`

```typescript
import { Hono } from 'hono';
import type { HonoEnv } from '../../../../src/types/env';
import { withAuth } from '../../../../src/lib/api/middleware/auth';
import { getUserById, updateUserAvatarUrl } from '../../../../src/lib/db/users';
import {
  uploadToR2,
  deleteFromR2,
  extractOldAvatarPath,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from '../../../../src/lib/storage/r2';
import { parseUploadFile, validateUploadFile } from '../../../../src/lib/file-upload/parse';
import { errorResponse } from '../../../../src/lib/api/errors';

const app = new Hono<HonoEnv>();

/**
 * POST /api/users/me/avatar
 * Upload and set user's avatar image
 * Requires multipart/form-data with file field
 */
app.post('/', withAuth, async (c) => {
  try {
    const authUser = c.get('user');

    if (!authUser) {
      return errorResponse(c, 401, 'UNAUTHORIZED', 'Not authenticated');
    }

    // Parse multipart form data
    const formData = await c.req.formData();
    const parsedFile = await parseUploadFile(formData);

    if (!parsedFile) {
      return errorResponse(c, 400, 'INVALID_FILE', 'No file provided or file parsing failed');
    }

    // Validate file
    const validationErrors = validateUploadFile(parsedFile, MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES);
    if (validationErrors.length > 0) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'File validation failed',
          details: validationErrors,
        },
        400
      );
    }

    const db = c.env.DB;
    const bucket = c.env.BUCKET;
    const baseUrl = c.env.R2_PUBLIC_URL || 'https://vfa-gallery.r2.dev';

    // Get current user to retrieve old avatar
    const currentUser = await getUserById(db, authUser.userId);
    if (!currentUser) {
      return errorResponse(c, 404, 'USER_NOT_FOUND', 'User profile not found');
    }

    // Upload new avatar to R2
    const newAvatarUrl = await uploadToR2(
      bucket,
      parsedFile.buffer,
      parsedFile.mimeType,
      authUser.userId,
      baseUrl
    );

    if (!newAvatarUrl) {
      return errorResponse(c, 500, 'UPLOAD_FAILED', 'Failed to upload file to storage');
    }

    // Update user's avatar URL in database
    const updatedUser = await updateUserAvatarUrl(db, authUser.userId, newAvatarUrl);

    if (!updatedUser) {
      return errorResponse(c, 500, 'UPDATE_FAILED', 'Failed to update user avatar');
    }

    // Delete old avatar from R2 if it exists (non-blocking)
    if (currentUser.avatarUrl) {
      const oldPath = extractOldAvatarPath(currentUser.avatarUrl);
      if (oldPath) {
        // Fire and forget - don't wait for deletion
        deleteFromR2(bucket, currentUser.avatarUrl).catch((error) => {
          console.warn('Failed to delete old avatar:', error);
        });
      }
    }

    return c.json(updatedUser);
  } catch (error) {
    console.error('POST /api/users/me/avatar error:', error);
    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Failed to upload avatar');
  }
});

export const onRequest = app.fetch;
```

### Step 5: Configure Environment Variables

Ensure R2 public URL is configured in wrangler.toml:

```bash
grep -n "R2_PUBLIC_URL" /Volumes/DataSSD/gitsrc/vfa_gallery/site/wrangler.toml
```

If not present, add to wrangler.toml:

```toml
[env.production]
vars = { R2_PUBLIC_URL = "https://vfa-gallery.r2.dev" }

[env.development]
vars = { R2_PUBLIC_URL = "http://localhost:8788" }
```

### Step 6: Verify File Structure

Confirm all files are created:

```bash
ls -la /Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/users/me/
```

Expected output: Should show `avatar.ts` file.

### Step 7: Test Locally

Start the development server:

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery/site
npm run dev
```

Test avatar upload:

```bash
curl -X POST http://localhost:8787/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/image.jpeg"
```

Expected: `200` status with updated user profile including new avatarUrl.

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/storage/r2.ts` - R2 upload/delete utilities
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/file-upload/parse.ts` - File parsing utilities
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/users/me/avatar.ts` - Avatar upload endpoint

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/db/users.ts` - Add updateUserAvatarUrl function
- `/Volumes/DataSSD/gitsrc/vfa_gallery/site/wrangler.toml` - Add R2_PUBLIC_URL variable

---

## Verification

### Test 1: Unauthenticated Request Returns 401

```bash
curl -X POST http://localhost:8787/api/users/me/avatar \
  -F "file=@/path/to/image.jpeg"
```

Expected: `401` status.

### Test 2: No File Returns 400

```bash
curl -X POST http://localhost:8787/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: `400` status with error message.

### Test 3: Invalid File Type Rejected

```bash
# Create a text file
echo "not an image" > test.txt

curl -X POST http://localhost:8787/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.txt"
```

Expected: `400` status with validation error about file type.

### Test 4: File Too Large Rejected

Create a file larger than 2MB and test:

```bash
dd if=/dev/zero of=/tmp/large.jpg bs=1M count=3
curl -X POST http://localhost:8787/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/tmp/large.jpg"
```

Expected: `400` status with validation error about file size.

### Test 5: Valid JPEG Upload

```bash
curl -X POST http://localhost:8787/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/valid.jpeg"
```

Expected: `200` status with updated user profile, avatarUrl contains unique path.

### Test 6: Valid PNG Upload

```bash
curl -X POST http://localhost:8787/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/valid.png"
```

Expected: `200` status, avatarUrl updated.

### Test 7: Valid WebP Upload

```bash
curl -X POST http://localhost:8787/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/valid.webp"
```

Expected: `200` status, avatarUrl updated.

### Test 8: Avatar URL Follows Correct Format

```bash
curl -X POST http://localhost:8787/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpeg" | jq '.avatarUrl'
```

Expected: URL matching pattern `https://vfa-gallery.r2.dev/avatars/{userId}/{uuid}.jpeg`

### Test 9: Each Upload Creates Unique Filename

Upload the same image twice and verify different URLs:

```bash
URL1=$(curl -s -X POST http://localhost:8787/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpeg" | jq '.avatarUrl' -r)

URL2=$(curl -s -X POST http://localhost:8787/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpeg" | jq '.avatarUrl' -r)

echo "URL1: $URL1"
echo "URL2: $URL2"
```

Expected: URLs are different (different UUIDs).

### Test 10: Old Avatar Deleted After Upload

(Requires R2 admin credentials to verify in bucket)

Upload avatar, note filename. Upload new avatar. Verify old file no longer exists in R2 bucket.

---

## Success Criteria

- [ ] R2 storage utilities created at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/storage/r2.ts`
- [ ] File upload parsing utilities created at `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/file-upload/parse.ts`
- [ ] Avatar upload endpoint created at `/Volumes/DataSSD/gitsrc/vfa_gallery/site/functions/api/users/me/avatar.ts`
- [ ] Database function updated to set avatar URL
- [ ] Unauthenticated requests return 401
- [ ] Invalid file types rejected with 400
- [ ] Files over 2MB rejected with 400
- [ ] Valid image uploads (JPEG, PNG, GIF, WebP) succeed
- [ ] New avatar URL stored in database
- [ ] Avatar URL format is correct: `avatars/{userId}/{uuid}.{ext}`
- [ ] Each upload creates unique filename
- [ ] Old avatars are deleted from R2
- [ ] Updated user profile returned with new avatarUrl

---

## Next Steps

Once verified, proceed to:
- **Build 33:** Profile view page in React UI
- **Build 34:** Profile edit form with avatar upload UI
