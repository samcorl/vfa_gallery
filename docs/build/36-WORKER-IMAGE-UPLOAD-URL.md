# 36-WORKER-IMAGE-UPLOAD-URL.md

## Goal
Generate presigned R2 upload URLs that allow clients to upload images directly to Cloudflare R2 storage without passing files through the application server.

## Spec Extract
- **API Endpoint**: POST /api/artworks/upload-url
- **Accepted Content Types**: image/jpeg, image/png, image/gif, image/webp
- **Upload Limit**: 5MB per image
- **URL Validity**: 15 minutes
- **Storage Path Pattern**: originals/{userId}/{uuid}.jpg
- **R2 Bucket**: env.BUCKET

## Prerequisites
- Build 15: Database schema for artworks table (userId, S3/R2 keys)
- Build 05: Environment configuration (BUCKET, R2 credentials)

## Steps

### 1. Create API Route Handler

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/upload.ts`

```typescript
import { json, type RequestHandler } from '@sveltejs/kit';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '$lib/server/auth';
import { validateContentType, generatePresignedUrl } from '$lib/server/r2-utils';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Authenticate user
    const session = await auth.getSession(request);
    if (!session?.user?.id) {
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { filename, contentType } = body;

    // Validate inputs
    if (!filename || !contentType) {
      return json(
        { error: 'Missing filename or contentType' },
        { status: 400 }
      );
    }

    if (!validateContentType(contentType)) {
      return json(
        { error: 'Invalid content type. Allowed: image/jpeg, image/png, image/gif, image/webp' },
        { status: 400 }
      );
    }

    // Generate unique key for R2
    const uuid = uuidv4();
    const fileExtension = getFileExtension(contentType);
    const key = `originals/${userId}/${uuid}${fileExtension}`;

    // Generate presigned upload URL (valid for 15 minutes)
    const uploadUrl = await generatePresignedUrl({
      key,
      contentType,
      expirationSeconds: 15 * 60, // 15 minutes
      method: 'PUT'
    });

    if (!uploadUrl) {
      return json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      );
    }

    // Return upload URL and key for client
    return json({
      uploadUrl,
      key,
      expiresIn: 15 * 60,
      contentType
    });

  } catch (error) {
    console.error('Upload URL generation error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};

function getFileExtension(contentType: string): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp'
  };
  return typeMap[contentType] || '.jpg';
}
```

### 2. Create R2 Utilities Module

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/server/r2-utils.ts`

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client configured for R2
const s3Client = new S3Client({
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
  },
  endpoint: process.env.R2_ENDPOINT || ''
});

const BUCKET = process.env.BUCKET || 'site-prod';

// Allowed MIME types for uploads
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

export function validateContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.includes(contentType);
}

export async function generatePresignedUrl({
  key,
  contentType,
  expirationSeconds = 900,
  method = 'PUT'
}: {
  key: string;
  contentType: string;
  expirationSeconds?: number;
  method?: 'PUT' | 'GET';
}): Promise<string | null> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      // Optional: Set metadata
      Metadata: {
        'generated-at': new Date().toISOString()
      }
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: expirationSeconds
    });

    return url;
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    return null;
  }
}

export function getS3Client(): S3Client {
  return s3Client;
}

export const R2_CONFIG = {
  bucket: BUCKET,
  endpoint: process.env.R2_ENDPOINT,
  allowedContentTypes: ALLOWED_CONTENT_TYPES
};
```

### 3. Add Route to SvelteKit Server Configuration

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/upload-url/+server.ts`

```typescript
import { POST } from '$lib/api/routes/upload';

export { POST };
```

### 4. Update Environment Configuration

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/.env.example`

Add these variables:
```
# Cloudflare R2 Configuration
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key_here
R2_SECRET_ACCESS_KEY=your_secret_key_here
BUCKET=site-prod
```

### 5. Update package.json Dependencies

Verify these are installed:
```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.x.x",
    "@aws-sdk/s3-request-presigner": "^3.x.x",
    "uuid": "^9.x.x"
  }
}
```

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/upload.ts` | Create | POST endpoint handler |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/server/r2-utils.ts` | Create | R2 presigned URL generation |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/upload-url/+server.ts` | Create | SvelteKit route bridge |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/.env.example` | Modify | Add R2 environment variables |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/package.json` | Verify | Ensure AWS SDK dependencies exist |

## Verification

### Test 1: Get Upload URL
```bash
curl -X POST http://localhost:5173/api/artworks/upload-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "filename": "my-artwork.jpg",
    "contentType": "image/jpeg"
  }'

# Expected Response:
# {
#   "uploadUrl": "https://<bucket>.r2.cloudflarestorage.com/...",
#   "key": "originals/<userId>/<uuid>.jpg",
#   "expiresIn": 900,
#   "contentType": "image/jpeg"
# }
```

### Test 2: Upload to R2
```bash
# Use the uploadUrl from Test 1
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: image/jpeg" \
  --data-binary @test-image.jpg

# Expected: 200 OK response from R2
```

### Test 3: Verify URL Expiration
- Request upload URL
- Wait 16 minutes
- Attempt to use expired URL
- Should receive 403 Forbidden from R2

### Test 4: Invalid Content Type
```bash
curl -X POST http://localhost:5173/api/artworks/upload-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "filename": "my-file.txt",
    "contentType": "text/plain"
  }'

# Expected: 400 error with message about invalid content type
```

### Test 5: Missing Authentication
```bash
curl -X POST http://localhost:5173/api/artworks/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "my-artwork.jpg",
    "contentType": "image/jpeg"
  }'

# Expected: 401 Unauthorized
```

## Notes
- Presigned URLs are valid for exactly 15 minutes (900 seconds)
- Client must use PUT method with the exact Content-Type specified in request
- Unique UUIDs prevent filename collisions between users
- User ID in path enables easy per-user storage organization
- R2 bucket credentials should be restricted to allow only PUT/GET on image paths
