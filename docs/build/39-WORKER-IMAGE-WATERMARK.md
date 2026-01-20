# 39-WORKER-IMAGE-WATERMARK.md

## Goal
Create a Cloudflare Worker that adds artist username watermarks to artwork images for public display, protecting artist attribution while presenting high-quality viewable versions.

## Spec Extract
- **Input**: R2 key to original image (originals/{userId}/{uuid}.jpg)
- **Additional Input**: Artist username for watermark text
- **Output**: Watermarked display version stored at R2 path display/{userId}/{uuid}.jpg
- **Watermark Position**: Bottom-right corner
- **Watermark Style**: Semi-transparent text, clean sans-serif font
- **Watermark Size**: Scaled relative to image dimensions
- **Processing**: Server-side, asynchronous
- **Purpose**: Public display with artist attribution

## Prerequisites
- Build 36: Upload URL generation working
- Build 37: Thumbnail generation working
- Build 38: Icon generation working
- Build 05: Environment configuration with R2 credentials
- Original images successfully uploading to R2
- User database with username/artist name fields

## Steps

### 1. Create Watermark Worker

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/functions/workers/image-watermark.ts`

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

const BUCKET = process.env.BUCKET || 'vfa-gallery-prod';

export interface WatermarkProcessRequest {
  originalKey: string;
  userId: string;
  uuid: string;
  artistUsername: string;
}

export interface WatermarkProcessResult {
  success: boolean;
  displayUrl?: string;
  displayKey?: string;
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
 * Calculate appropriate font size based on image dimensions
 * Rule: font size = image width / 20 (20 characters per line at typical width)
 */
function calculateFontSize(imageWidth: number): number {
  const calculatedSize = Math.max(24, Math.floor(imageWidth / 20));
  return Math.min(calculatedSize, 96); // Cap at 96px
}

/**
 * Add watermark text to image
 */
async function addWatermark(
  imageBuffer: Buffer,
  artistUsername: string
): Promise<Buffer> {
  try {
    const image = await Jimp.read(imageBuffer);

    const width = image.bitmap.width;
    const height = image.bitmap.height;

    // Calculate font size based on image width
    const fontSize = calculateFontSize(width);

    // Load default font or use built-in
    // Note: Jimp comes with a default font
    const font = Jimp.FONT_SANS_32_BLACK; // Will be overridden if custom size needed

    // Create watermark text
    const watermarkText = `© ${artistUsername}`;

    // Estimate text dimensions (rough calculation)
    // Each character is approximately fontSize * 0.5 wide
    const estimatedTextWidth = watermarkText.length * fontSize * 0.5;
    const estimatedTextHeight = fontSize * 1.2;

    // Position in bottom-right corner with padding
    const padding = Math.floor(width * 0.02); // 2% of image width as padding
    const textX = Math.max(0, width - estimatedTextWidth - padding);
    const textY = Math.max(0, height - estimatedTextHeight - padding);

    // Create semi-transparent overlay for text background
    // This improves readability over any background
    const overlayHeight = Math.floor(estimatedTextHeight * 1.3);
    const overlayWidth = Math.floor(estimatedTextWidth * 1.2);

    // Add semi-transparent black background box behind text
    const bgX = textX - padding / 2;
    const bgY = textY - padding / 2;

    // Create a temporary image for the overlay
    const overlay = new Jimp({
      width: overlayWidth,
      height: overlayHeight,
      color: 0x00000080 // Black with 50% opacity (0x80 = 128 = 50%)
    });

    // Composite overlay onto main image
    image.composite(overlay, bgX, bgY);

    // Print white text on the background
    // Using Jimp's print method (requires font)
    image.print({
      font: Jimp.FONT_SANS_32_WHITE,
      x: textX,
      y: textY,
      text: watermarkText,
      maxWidth: width - (2 * padding),
      maxHeight: estimatedTextHeight
    });

    // Compress with 85% quality for web display
    const watermarkedBuffer = await image.quality(85).toBuffer('image/jpeg');

    return watermarkedBuffer;
  } catch (error) {
    console.error('Failed to add watermark:', error);
    throw error;
  }
}

/**
 * Upload watermarked image to R2 storage
 */
async function uploadToR2(
  watermarkedBuffer: Buffer,
  userId: string,
  uuid: string
): Promise<string> {
  try {
    const displayKey = `display/${userId}/${uuid}.jpg`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: displayKey,
      Body: watermarkedBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'original-type': 'display',
        'watermarked': 'true',
        'generated-at': new Date().toISOString()
      }
    });

    await s3Client.send(command);

    // Generate public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/display/${userId}/${uuid}.jpg`;

    return publicUrl;
  } catch (error) {
    console.error('Failed to upload watermarked image to R2:', error);
    throw error;
  }
}

/**
 * Main worker function to process watermark
 */
export async function processWatermark(
  request: WatermarkProcessRequest
): Promise<WatermarkProcessResult> {
  const startTime = Date.now();

  try {
    console.log(`Processing watermark for key: ${request.originalKey}`);

    // Validate artist username
    if (!request.artistUsername || request.artistUsername.length === 0) {
      throw new Error('Artist username is required for watermark');
    }

    if (request.artistUsername.length > 50) {
      throw new Error('Artist username is too long (max 50 characters)');
    }

    // Download original image from R2
    const imageBuffer = await downloadFromR2(request.originalKey);
    console.log(`Downloaded image: ${imageBuffer.length} bytes`);

    // Add watermark
    const watermarkedBuffer = await addWatermark(imageBuffer, request.artistUsername);
    console.log(`Added watermark: ${watermarkedBuffer.length} bytes`);

    // Upload to R2
    const displayUrl = await uploadToR2(
      watermarkedBuffer,
      request.userId,
      request.uuid
    );

    const processingTime = Date.now() - startTime;

    console.log(`Watermark processed successfully in ${processingTime}ms`);

    return {
      success: true,
      displayUrl,
      displayKey: `display/${request.userId}/${request.uuid}.jpg`,
      processingTime
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`Watermark processing failed: ${errorMessage}`);

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
export async function handleWatermarkRequest(
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
    const body = await request.json() as WatermarkProcessRequest;

    if (!body.originalKey || !body.userId || !body.uuid || !body.artistUsername) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: originalKey, userId, uuid, artistUsername'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const result = await processWatermark(body);

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

### 2. Create API Endpoint for Watermark Generation

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/watermark/+server.ts`

```typescript
import { json, type RequestHandler } from '@sveltejs/kit';
import { processWatermark } from '$lib/server/workers/image-watermark';
import { getUserById } from '$lib/server/db/users';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Verify authentication
    const session = await locals.auth.getSession(request);
    if (!session?.user?.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    const body = await request.json().catch(() => ({}));
    const { originalKey, userId, uuid, artistUsername } = body;

    // Validate input
    if (!originalKey || !userId || !uuid) {
      return json(
        { error: 'Missing required fields: originalKey, userId, uuid' },
        { status: 400 }
      );
    }

    let watermarkUsername = artistUsername;

    // If not provided, fetch from user database
    if (!watermarkUsername) {
      const user = await getUserById(userId);
      if (!user?.username && !user?.displayName) {
        return json(
          { error: 'Could not determine artist username' },
          { status: 400 }
        );
      }
      watermarkUsername = user.username || user.displayName;
    }

    // Validate username
    if (!watermarkUsername || watermarkUsername.length === 0) {
      return json(
        { error: 'Invalid artist username' },
        { status: 400 }
      );
    }

    // Process watermark
    const result = await processWatermark({
      originalKey,
      userId,
      uuid,
      artistUsername: watermarkUsername
    });

    if (!result.success) {
      return json(
        { error: result.error || 'Watermark processing failed' },
        { status: 500 }
      );
    }

    return json({
      success: true,
      displayUrl: result.displayUrl,
      displayKey: result.displayKey,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('Watermark endpoint error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
```

### 3. Create Watermark Worker Utilities Module

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/server/workers/image-watermark.ts`

```typescript
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import Jimp from 'jimp';

export interface WatermarkRequest {
  originalKey: string;
  userId: string;
  uuid: string;
  artistUsername: string;
}

export interface WatermarkResult {
  success: boolean;
  displayUrl?: string;
  displayKey?: string;
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

const BUCKET = process.env.BUCKET || 'vfa-gallery-prod';

function calculateFontSize(imageWidth: number): number {
  const calculatedSize = Math.max(24, Math.floor(imageWidth / 20));
  return Math.min(calculatedSize, 96);
}

async function addWatermarkText(
  imageBuffer: Buffer,
  artistUsername: string
): Promise<Buffer> {
  const image = await Jimp.read(Buffer.from(imageBuffer));

  const width = image.bitmap.width;
  const height = image.bitmap.height;

  const fontSize = calculateFontSize(width);
  const watermarkText = `© ${artistUsername}`;

  const estimatedTextWidth = watermarkText.length * fontSize * 0.5;
  const estimatedTextHeight = fontSize * 1.2;
  const padding = Math.floor(width * 0.02);

  const textX = Math.max(0, width - estimatedTextWidth - padding);
  const textY = Math.max(0, height - estimatedTextHeight - padding);

  // Add semi-transparent background
  const overlayHeight = Math.floor(estimatedTextHeight * 1.3);
  const overlayWidth = Math.floor(estimatedTextWidth * 1.2);

  const bgX = textX - padding / 2;
  const bgY = textY - padding / 2;

  const overlay = new Jimp({
    width: overlayWidth,
    height: overlayHeight,
    color: 0x00000080
  });

  image.composite(overlay, bgX, bgY);

  // Add text
  image.print({
    font: Jimp.FONT_SANS_32_WHITE,
    x: textX,
    y: textY,
    text: watermarkText,
    maxWidth: width - (2 * padding),
    maxHeight: estimatedTextHeight
  });

  return await image.quality(85).toBuffer('image/jpeg');
}

export async function processWatermark(
  request: WatermarkRequest
): Promise<WatermarkResult> {
  const startTime = Date.now();

  try {
    // Validate username
    if (!request.artistUsername || request.artistUsername.length === 0) {
      throw new Error('Artist username required');
    }

    if (request.artistUsername.length > 50) {
      throw new Error('Artist username too long');
    }

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

    // Add watermark
    const watermarkedBuffer = await addWatermarkText(
      Buffer.from(imageBuffer),
      request.artistUsername
    );

    // Upload display version
    const displayKey = `display/${request.userId}/${request.uuid}.jpg`;

    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: displayKey,
      Body: watermarkedBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'generated-at': new Date().toISOString(),
        'watermarked': 'true'
      }
    });

    await s3Client.send(uploadCommand);

    const displayUrl = `${process.env.R2_PUBLIC_URL}/display/${request.userId}/${request.uuid}.jpg`;

    return {
      success: true,
      displayUrl,
      displayKey,
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('Watermark processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}
```

### 4. Add User Database Utility (if not exists)

**File**: `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/server/db/users.ts`

```typescript
import { db } from '$lib/server/db';

export async function getUserById(userId: string) {
  try {
    const user = await db.query(
      'SELECT id, username, "displayName" FROM users WHERE id = $1',
      [userId]
    );
    return user.rows[0] || null;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}
```

## Files to Create/Modify

| Path | Type | Purpose |
|------|------|---------|
| `/Volumes/DataSSD/gitsrc/vfa_gallery/functions/workers/image-watermark.ts` | Create | Cloudflare Worker for watermark generation |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/api/artworks/watermark/+server.ts` | Create | API endpoint for watermark generation |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/server/workers/image-watermark.ts` | Create | Worker utilities module |
| `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/server/db/users.ts` | Create/Verify | User database access function |

## Verification

### Test 1: Generate Watermarked Image
```bash
curl -X POST http://localhost:5173/api/artworks/watermark \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "originals/<userId>/<uuid>.jpg",
    "userId": "<userId>",
    "uuid": "<uuid>",
    "artistUsername": "jane_doe"
  }'

# Expected Response:
# {
#   "success": true,
#   "displayUrl": "https://images.yourdomain.com/display/<userId>/<uuid>.jpg",
#   "displayKey": "display/<userId>/<uuid>.jpg",
#   "processingTime": 3200
# }
```

### Test 2: Verify Watermark Visibility
```bash
curl -o watermarked.jpg "https://images.yourdomain.com/display/<userId>/<uuid>.jpg"

# Display the image and visually verify:
# - Watermark appears in bottom-right corner
# - Text readable (white text with semi-transparent background)
# - Artist username displayed correctly with © symbol
# - No distortion of underlying image
```

### Test 3: Test Various Image Sizes
Upload images of different dimensions and verify watermark scales appropriately:
- 800x600 (small)
- 2000x1500 (medium)
- 4000x3000 (large)

Watermark should be readable and appropriately sized at each scale.

### Test 4: Test Special Characters in Username
```bash
curl -X POST http://localhost:5173/api/artworks/watermark \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "originals/<userId>/<uuid>.jpg",
    "userId": "<userId>",
    "uuid": "<uuid>",
    "artistUsername": "josé_garcía"
  }'

# Verify watermark renders with special characters
```

### Test 5: Test Long Usernames
```bash
# Test with 50 character username (max)
# Test with 51 character username (should error)

curl -X POST http://localhost:5173/api/artworks/watermark \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "originals/<userId>/<uuid>.jpg",
    "userId": "<userId>",
    "uuid": "<uuid>",
    "artistUsername": "this_is_a_very_long_artist_name_that_exceeds_the_fifty_character_limit"
  }'

# Expected: 400 error
```

### Test 6: Auto-fetch Username from Database
```bash
# Send request without artistUsername
curl -X POST http://localhost:5173/api/artworks/watermark \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "originalKey": "originals/<userId>/<uuid>.jpg",
    "userId": "<userId>",
    "uuid": "<uuid>"
  }'

# Should fetch username from database and apply watermark
```

### Test 7: Verify Watermark with Various Background Colors
- Upload image with light background
- Upload image with dark background
- Upload image with varied colors

Watermark should be readable on all backgrounds (semi-transparent bg ensures contrast).

### Test 8: Verify File in R2
```bash
aws s3 ls s3://$BUCKET/display/<userId>/ --endpoint-url $R2_ENDPOINT

# Should see: <uuid>.jpg
```

## Notes
- Watermark text always includes © symbol before username
- Font size scales with image: calculated as imageWidth / 20 (capped between 24-96px)
- Semi-transparent black background ensures readability on any image
- White text provides contrast against background
- Bottom-right corner position is standard for watermarks and doesn't interfere with content focus (usually center)
- Watermark adds minimal file size overhead
- 85% JPEG quality maintains visual quality while reducing file size
- Consider offering watermark customization options in future (position, opacity, format)
- Logo watermark option could be added as enhancement
