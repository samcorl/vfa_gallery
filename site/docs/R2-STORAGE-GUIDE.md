# R2 Storage Configuration Guide

## Bucket Details

**Bucket Name:** vfa-gallery-images
**Binding Name:** IMAGE_BUCKET
**Access:** Internal (CloudFlare Workers only) + Public URLs via subdomain

## Folder Structure

Organize R2 objects with consistent naming:

```
/artworks/
  {artwork_id}/
    original.jpg          # Original uploaded image
    display.jpg           # Display version (watermarked)
    thumbnail.jpg         # Thumbnail (for grids)
    icon.jpg             # Icon (for navigation)

/users/
  {user_id}/
    avatar_original.jpg
    avatar_thumbnail.jpg
```

## Accessing Images

### In CloudFlare Workers

```typescript
const bucket = env.IMAGE_BUCKET;

// Upload
await bucket.put('artworks/123/original.jpg', imageData);

// Download
const file = await bucket.get('artworks/123/display.jpg');
const arrayBuffer = await file.arrayBuffer();
```

### Public URLs

CloudFlare R2 provides public URLs via custom subdomain:

```
https://cdn.vfa.gallery/artworks/123/display.jpg
```

(Configure custom domain in CloudFlare dashboard)

## Image Sizes and Quotas

- **Max upload:** 5MB per image
- **Storage quota:** Varies by CloudFlare plan
- **Bandwidth:** Included in CloudFlare plan

## Cleanup

To delete old/unused images:

```bash
wrangler r2 object delete {key} --bucket vfa-gallery-images
```

For bulk operations, use CloudFlare API or worker script.
