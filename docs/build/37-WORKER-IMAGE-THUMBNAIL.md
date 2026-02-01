# 37-WORKER-IMAGE-THUMBNAIL.md

## Goal
Create a Cloudflare Worker that generates thumbnail images (~400px width) from original artworks uploaded to R2, optimized for gallery grid display.

## Spec Extract
- **Input**: R2 key to original image (originals/{userId}/{uuid}.jpg)
- **Output**: Thumbnail stored at R2 path thumbnails/{userId}/{uuid}.jpg
- **Dimensions**: Maximum 400px width, maintain aspect ratio
- **Compression**: Optimized for web (balance quality/size)
- **Trigger**: Called after image upload via R2 Events or API request
- **Processing**: Server-side, asynchronous

## Prerequisites
- Build 36: Upload URL generation and presigned URLs working
- Build 05: Environment configuration with R2 credentials
- Original images successfully uploading to R2

## Steps

### 1. Create Cloudflare Worker Function

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/functions/workers/image-thumbnail.ts`

```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import Jimp from 'jimp';

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
  },
  endpoint: process.env.R2_ENDPOINT || ''
});

const BUCKET = process.env.BUCKET || 'site-prod';
const THUMBNAIL_WIDTH = 400;

export interface ThumbnailProcessRequest {
  originalKey: string;
  userId: string;
  uuid: string;
}

export interface ThumbnailProcessResult {
  success: boolean;
  thumbnailUrl?: string;
  thumbnailKey?: string;
  error?: string;
  processingTime?: number;
}

/**
 * Download image from R2 storage
 */
async function downloadFromR2(key: string): Promise<Buffer> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key
    });

    const response = await s3Client.send(command);

    // Convert stream to buffer
    if (response.Body instanceof Uint8Array) {
      return Buffer.from(response.Body);
    }

    const chunks: Uint8Array[] = [];
    const reader = response.Body?.getReader?.();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      return Buffer.concat(chunks.map(c => Buffer.from(c)));
    }

    throw new Error('Unable to read image stream');
  } catch (error) {
    console.error('Failed to download from R2:', error);
    throw error;
  }
}

/**
 * Resize image to thumbnail dimensions
 */
async function resizeImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const image = await Jimp.read(imageBuffer);

    // Calculate new dimensions maintaining aspect ratio
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    if (width <= THUMBNAIL_WIDTH) {
      // Image is already smaller than or equal to thumbnail width
      return imageBuffer;
    }

    const aspectRatio = height / width;
    const newHeight = Math.round(THUMBNAIL_WIDTH * aspectRatio);

    // Resize using high-quality algorithm
    image.resize({
      w: THUMBNAIL_WIDTH,
      h: newHeight,
      mode: 'letterbox' // Maintain aspect ratio without cropping
    });

    // Convert to JPEG with 80% quality for web optimization
    const resizedBuffer = await image.quality(80).toBuffer('image/jpeg');

    return resizedBuffer;
  } catch (error) {
    console.error('Failed to resize image:', error);
    throw error;
  }
}

/**
 * Upload thumbnail to R2 storage
 */
async function uploadToR2(
  thumbnailBuffer: Buffer,
  userId: string,
  uuid: string
): Promise<string> {
  try {
    const thumbnailKey = `thumbnails/${userId}/${uuid}.jpg`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'original-type': 'thumbnail',
        'generated-at': new Date().toISOString()
      }
    });

    await s3Client.send(command);

    // Generate public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/thumbnails/${userId}/${uuid}.jpg`;

    return publicUrl;
  } catch (error) {
    console.error('Failed to upload thumbnail to R2:', error);
    throw error;
  }
}

/**
 * Main worker function to process thumbnail
 */
export async function processThumbnail(
  request: ThumbnailProcessRequest
): Promise<ThumbnailProcessResult> {
  const startTime = Date.now();

  try {
    console.log(`Processing thumbnail for key: ${request.originalKey}`);

    // Download original image from R2
    const imageBuffer = await downloadFromR2(request.originalKey);
    console.log(`Downloaded image: ${imageBuffer.length} bytes`);

    // Resize image to thumbnail dimensions
    const thumbnailBuffer = await resizeImage(imageBuffer);
    console.log(`Resized image: ${thumbnailBuffer.length} bytes`);

    // Upload thumbnail to R2
    const thumbnailUrl = await uploadToR2(
      thumbnailBuffer,
      request.userId,
      request.uuid
    );

    const processingTime = Date.now() - startTime;

    console.log(`Thumbnail generated successfully in ${processingTime}ms`);

    return {
      success: true,
      thumbnailUrl,
      thumbnailKey: `thumbnails/${request.userId}/${request.uuid}.jpg`,
      processingTime
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`Thumbnail processing failed: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
      processingTime
    };
  }
}

/**
 * HTTP handler for the Cloudflare Worker
 */
export async function handleThumbnailRequest(
  event: FetchEvent
): Promise<Response> {
  const request = event.request;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json() as ThumbnailProcessRequest;

    if (!body.originalKey || !body.userId || !body.uuid) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: originalKey, userId, uuid' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const result = await processThumbnail(body);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
```

### 2. Create API Endpoint for Manual Thumbnail Triggering

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/thumbnail/+server.ts`

```typescript
import { json, type RequestHandler } from '@sveltejs/kit';
import { processThumbnail } from '$lib/server/workers/image-thumbnail';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Verify authentication
    const session = await locals.auth.getSession(request);
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    const body = await request.json().catch(() => ({}));
    const { originalKey, userId, uuid } = body;

    // Validate input
    if (!originalKey || !userId || !uuid) {
      return json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process thumbnail
    const result = await processThumbnail({
      originalKey,
      userId,
      uuid
    });

    if (!result.success) {
      return json(
        { error: result.error || 'Thumbnail processing failed' },
        { status: 500 }
      );
    }

    return json({
      success: true,
      thumbnailUrl: result.thumbnailUrl,
      thumbnailKey: result.thumbnailKey,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('Thumbnail endpoint error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
```

### 3. Create Thumbnail Worker Utilities Module

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/server/workers/image-thumbnail.ts`

```typescript
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import Jimp from 'jimp';

export interface ThumbnailRequest {
  originalKey: string;
  userId: string;
  uuid: string;
}

export interface ThumbnailResult {
  success: boolean;
  thumbnailUrl?: string;
  thumbnailKey?: string;
  error?: string;
  processingTime?: number;
}

const s3Client = new S3Client({
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
  },
  endpoint: process.env.R2_ENDPOINT || ''
});

const BUCKET = process.env.BUCKET || 'site-prod';
const THUMBNAIL_WIDTH = 400;

export async function processThumbnail(
  request: ThumbnailRequest
): Promise<ThumbnailResult> {
  const startTime = Date.now();

  try {
    // Download original
    const downloadCommand = new GetObjectCommand({
      Bucket: BUCKET,
      Key: request.originalKey
    });

    const response = await s3Client.send(downloadCommand);
    const imageBuffer = await response.Body?.transformToByteArray();

    if (!imageBuffer) {
      throw new Error('Failed to read image buffer');
    }

    // Resize
    const image = await Jimp.read(Buffer.from(imageBuffer));

    const width = image.bitmap.width;
    const height = image.bitmap.height;

    if (width > THUMBNAIL_WIDTH) {
      const aspectRatio = height / width;
      const newHeight = Math.round(THUMBNAIL_WIDTH * aspectRatio);

      image.resize({
        w: THUMBNAIL_WIDTH,
        h: newHeight
      });
    }

    const thumbnailBuffer = await image.quality(80).toBuffer('image/jpeg');

    // Upload thumbnail
    const thumbnailKey = `thumbnails/${request.userId}/${request.uuid}.jpg`;

    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'generated-at': new Date().toISOString()
      }
    });

    await s3Client.send(uploadCommand);

    const thumbnailUrl = `${process.env.R2_PUBLIC_URL}/thumbnails/${request.userId}/${request.uuid}.jpg`;

    return {
      success: true,
      thumbnailUrl,
      thumbnailKey,
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('Thumbnail processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}
```

### 4. Update package.json Dependencies

Add these if not present:
```json
{
  "devDependencies": {
    "jimp": "^0.22.x"
  }
}
```

Alternatively, for Cloudflare Workers, use:
```json
{
  "devDependencies": {
    "@cloudflare/imageoptimizer": "^1.x.x"
  }
}
```

### 5. Update Environment Configuration

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/.env.example`

Add:
```
R2_PUBLIC_URL=https://images.yourdomain.com
```

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/functions/workers/image-thumbnail.ts` | Create | Cloudflare Worker for thumbnail generation |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/thumbnail/+server.ts` | Create | API endpoint for manual thumbnail trigger |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/server/workers/image-thumbnail.ts` | Create | Worker utilities module |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/.env.example` | Modify | Add R2_PUBLIC_URL |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/package.json` | Verify | Ensure Jimp dependency |

## Verification

### Test 1: Process Thumbnail via API
```bash
curl -X POST http://localhost:5173/api/artworks/thumbnail \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "originals/<userId>/<uuid>.jpg",
    "userId": "<userId>",
    "uuid": "<uuid>"
  }'

# Expected Response:
# {
#   "success": true,
#   "thumbnailUrl": "https://images.yourdomain.com/thumbnails/<userId>/<uuid>.jpg",
#   "thumbnailKey": "thumbnails/<userId>/<uuid>.jpg",
#   "processingTime": 2340
# }
```

### Test 2: Verify Thumbnail Created in R2
```bash
# List objects in R2 bucket
aws s3 ls s3://$BUCKET/thumbnails/<userId>/ --endpoint-url $R2_ENDPOINT

# Should see: <uuid>.jpg
```

### Test 3: Download and Verify Dimensions
```bash
curl -o thumbnail.jpg "https://images.yourdomain.com/thumbnails/<userId>/<uuid>.jpg"

# Check dimensions
identify thumbnail.jpg
# Expected: width <= 400px, aspect ratio preserved
```

### Test 4: Verify Quality Optimization
```bash
ls -lh original.jpg thumbnail.jpg
# Thumbnail should be significantly smaller than original
```

### Test 5: Test with Various Image Formats
- Upload JPEG, PNG, GIF, WebP
- Verify all generate thumbnails correctly
- Verify aspect ratios maintained

### Test 6: Error Handling
```bash
curl -X POST http://localhost:5173/api/artworks/thumbnail \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "originals/<userId>/non-existent-uuid.jpg",
    "userId": "<userId>",
    "uuid": "non-existent-uuid"
  }'

# Expected: 500 error with error message
```

## Notes
- Thumbnail width fixed at 400px for consistency
- Aspect ratio always maintained (no cropping)
- JPEG compression at 80% quality balances file size and visual quality
- Processing time typically 2-4 seconds for typical artwork images
- Consider implementing R2 event notifications to auto-trigger thumbnails on upload
- Large images (>10MB) may fail; implement client-side validation of file size before upload
