# 38-WORKER-IMAGE-ICON.md

## Goal
Create a Cloudflare Worker that generates square icon images (100x100px) from original artworks, used for navigation menus, artist profiles, and preview galleries.

## Spec Extract
- **Input**: R2 key to original image (originals/{userId}/{uuid}.jpg)
- **Output**: Icon stored at R2 path icons/{userId}/{uuid}.jpg
- **Dimensions**: 100x100px square
- **Cropping**: Center-crop to square, then resize to 100x100px
- **Format**: JPEG, optimized for small file size
- **Processing**: Server-side, asynchronous
- **Purpose**: Navigation, artist profiles, UI elements

## Prerequisites
- Build 36: Upload URL generation working
- Build 37: Thumbnail generation working (to understand image pipeline)
- Build 05: Environment configuration with R2 credentials
- Original images successfully uploading to R2

## Steps

### 1. Create Icon Generation Worker

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/functions/workers/image-icon.ts`

```typescript
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
const ICON_SIZE = 100;

export interface IconProcessRequest {
  originalKey: string;
  userId: string;
  uuid: string;
}

export interface IconProcessResult {
  success: boolean;
  iconUrl?: string;
  iconKey?: string;
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
 * Resize image to icon dimensions with center cropping
 *
 * Strategy:
 * 1. If image is portrait: crop width to height, then resize to ICON_SIZE
 * 2. If image is landscape: crop height to width, then resize to ICON_SIZE
 * 3. If already square: just resize to ICON_SIZE
 */
async function resizeToIcon(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const image = await Jimp.read(imageBuffer);

    const width = image.bitmap.width;
    const height = image.bitmap.height;

    // Determine square crop size (use smaller dimension)
    const cropSize = Math.min(width, height);

    // Calculate crop offsets to center the crop
    const xOffset = Math.floor((width - cropSize) / 2);
    const yOffset = Math.floor((height - cropSize) / 2);

    // Crop to square from center
    if (width !== cropSize || height !== cropSize) {
      image.crop({
        x: xOffset,
        y: yOffset,
        w: cropSize,
        h: cropSize
      });
    }

    // Resize to icon dimensions
    image.resize({
      w: ICON_SIZE,
      h: ICON_SIZE,
      mode: 'stretch' // Already square, so no need for letterbox
    });

    // Convert to JPEG with 75% quality (more aggressive compression for icons)
    const iconBuffer = await image.quality(75).toBuffer('image/jpeg');

    return iconBuffer;
  } catch (error) {
    console.error('Failed to resize to icon:', error);
    throw error;
  }
}

/**
 * Upload icon to R2 storage
 */
async function uploadToR2(
  iconBuffer: Buffer,
  userId: string,
  uuid: string
): Promise<string> {
  try {
    const iconKey = `icons/${userId}/${uuid}.jpg`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: iconKey,
      Body: iconBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'original-type': 'icon',
        'icon-size': `${ICON_SIZE}x${ICON_SIZE}`,
        'generated-at': new Date().toISOString()
      }
    });

    await s3Client.send(command);

    // Generate public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/icons/${userId}/${uuid}.jpg`;

    return publicUrl;
  } catch (error) {
    console.error('Failed to upload icon to R2:', error);
    throw error;
  }
}

/**
 * Main worker function to process icon
 */
export async function processIcon(
  request: IconProcessRequest
): Promise<IconProcessResult> {
  const startTime = Date.now();

  try {
    console.log(`Processing icon for key: ${request.originalKey}`);

    // Download original image from R2
    const imageBuffer = await downloadFromR2(request.originalKey);
    console.log(`Downloaded image: ${imageBuffer.length} bytes`);

    // Resize and crop to icon dimensions
    const iconBuffer = await resizeToIcon(imageBuffer);
    console.log(`Resized to icon: ${iconBuffer.length} bytes`);

    // Upload icon to R2
    const iconUrl = await uploadToR2(
      iconBuffer,
      request.userId,
      request.uuid
    );

    const processingTime = Date.now() - startTime;

    console.log(`Icon generated successfully in ${processingTime}ms`);

    return {
      success: true,
      iconUrl,
      iconKey: `icons/${request.userId}/${request.uuid}.jpg`,
      processingTime
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`Icon processing failed: ${errorMessage}`);

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
export async function handleIconRequest(
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
    const body = await request.json() as IconProcessRequest;

    if (!body.originalKey || !body.userId || !body.uuid) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: originalKey, userId, uuid' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const result = await processIcon(body);

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

### 2. Create API Endpoint for Icon Generation

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/icon/+server.ts`

```typescript
import { json, type RequestHandler } from '@sveltejs/kit';
import { processIcon } from '$lib/server/workers/image-icon';

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
        { error: 'Missing required fields: originalKey, userId, uuid' },
        { status: 400 }
      );
    }

    // Process icon
    const result = await processIcon({
      originalKey,
      userId,
      uuid
    });

    if (!result.success) {
      return json(
        { error: result.error || 'Icon processing failed' },
        { status: 500 }
      );
    }

    return json({
      success: true,
      iconUrl: result.iconUrl,
      iconKey: result.iconKey,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('Icon endpoint error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
```

### 3. Create Icon Worker Utilities Module

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/server/workers/image-icon.ts`

```typescript
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import Jimp from 'jimp';

export interface IconRequest {
  originalKey: string;
  userId: string;
  uuid: string;
}

export interface IconResult {
  success: boolean;
  iconUrl?: string;
  iconKey?: string;
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
const ICON_SIZE = 100;

/**
 * Center-crop image to square, then resize to icon dimensions
 */
async function cropAndResizeToIcon(imageBuffer: Buffer): Promise<Buffer> {
  const image = await Jimp.read(Buffer.from(imageBuffer));

  const width = image.bitmap.width;
  const height = image.bitmap.height;

  // Crop to square from center
  const cropSize = Math.min(width, height);
  const xOffset = Math.floor((width - cropSize) / 2);
  const yOffset = Math.floor((height - cropSize) / 2);

  if (width !== cropSize || height !== cropSize) {
    image.crop({
      x: xOffset,
      y: yOffset,
      w: cropSize,
      h: cropSize
    });
  }

  // Resize to 100x100
  image.resize({
    w: ICON_SIZE,
    h: ICON_SIZE
  });

  return await image.quality(75).toBuffer('image/jpeg');
}

export async function processIcon(
  request: IconRequest
): Promise<IconResult> {
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

    // Crop and resize
    const iconBuffer = await cropAndResizeToIcon(Buffer.from(imageBuffer));

    // Upload icon
    const iconKey = `icons/${request.userId}/${request.uuid}.jpg`;

    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: iconKey,
      Body: iconBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'generated-at': new Date().toISOString(),
        'icon-size': '100x100'
      }
    });

    await s3Client.send(uploadCommand);

    const iconUrl = `${process.env.R2_PUBLIC_URL}/icons/${request.userId}/${request.uuid}.jpg`;

    return {
      success: true,
      iconUrl,
      iconKey,
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('Icon processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}
```

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/functions/workers/image-icon.ts` | Create | Cloudflare Worker for icon generation |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/icon/+server.ts` | Create | API endpoint for icon generation |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/server/workers/image-icon.ts` | Create | Worker utilities module |

## Verification

### Test 1: Process Icon via API
```bash
curl -X POST http://localhost:5173/api/artworks/icon \
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
#   "iconUrl": "https://images.yourdomain.com/icons/<userId>/<uuid>.jpg",
#   "iconKey": "icons/<userId>/<uuid>.jpg",
#   "processingTime": 1200
# }
```

### Test 2: Verify Icon Dimensions
```bash
curl -o icon.jpg "https://images.yourdomain.com/icons/<userId>/<uuid>.jpg"

# Verify exactly 100x100
identify icon.jpg
# Expected output: 100x100
```

### Test 3: Test Center Cropping with Various Aspect Ratios
Create test images with different dimensions:
- 400x600 (portrait) → should crop to 400x400 → 100x100
- 600x400 (landscape) → should crop to 400x400 → 100x100
- 500x500 (square) → should resize to 100x100 directly

```bash
# Verify cropping worked correctly
for uuid in test-portrait test-landscape test-square; do
  curl -o "icon-$uuid.jpg" "https://images.yourdomain.com/icons/<userId>/$uuid.jpg"
  identify "icon-$uuid.jpg"
  # All should show: 100x100 JPEG
done
```

### Test 4: Verify File Size Optimization
```bash
# Icons should be very small (typically 2-5KB)
ls -lh icon.jpg
# Expected: ~3-4 KB
```

### Test 5: Test with Different Image Formats
Upload original in various formats:
- JPEG: 800x1000px
- PNG: 1000x800px
- GIF: 600x500px
- WebP: 450x450px

All should generate 100x100 JPEG icons with proper center cropping.

### Test 6: Error Handling
```bash
curl -X POST http://localhost:5173/api/artworks/icon \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "originals/<userId>/missing.jpg",
    "userId": "<userId>",
    "uuid": "missing"
  }'

# Expected: 500 error with error message
```

### Test 7: Verify Icon in UI
Navigate to a page displaying icons (artist profile, gallery grid, etc.)
- Icons should display correctly at 100x100
- File should load quickly (small file size)
- No distortion (center cropping should preserve important content)

## Notes
- All icons are exactly 100x100px square (no variation)
- Center cropping ensures important content (usually face/subject) is preserved
- JPEG quality at 75% provides good visual quality with minimal file size
- Icons typically 2-5KB each, suitable for UI elements
- Use HTML attribute `width="100" height="100"` to ensure consistent sizing
- Can be cached aggressively due to fixed dimensions and quality
- Consider pre-cropping strategy: show users which area will become the icon
