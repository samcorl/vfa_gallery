# 95-API-BROWSE-CATEGORIES.md

## Goal
Create two endpoints for browsing artworks by category:
1. `GET /api/browse/categories` - List all categories with artwork counts
2. `GET /api/browse/categories/:category` - Get paginated artworks for a specific category

---

## Spec Extract

From Phase 18 requirements:
- **Authentication**: Public (no auth required)
- **Categories**: manga, comic, illustration, concept-art, fan-art, other
- **List Endpoint**: Returns all categories with counts
- **Filter Endpoint**: Returns paginated artworks for a category
- **Pagination**: Supports page and limit parameters

---

## Prerequisites

**Must complete before starting:**
- **15-API-FOUNDATION.md** - Hono app and error handling
- **10-SCHEMA-ARTWORKS.md** - Artworks table with category field
- **06-SCHEMA-GALLERIES.md** - Galleries table
- **05-SCHEMA-USERS.md** - Users table

---

## Steps

### Step 1: Define Category Types

Update the browse service to include category definitions and queries.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/browse.service.ts`

Add these definitions and functions:

```typescript
export const VALID_CATEGORIES = [
  'manga',
  'comic',
  'illustration',
  'concept-art',
  'fan-art',
  'other',
] as const

export type ArtworkCategory = typeof VALID_CATEGORIES[number]

export interface CategoryInfo {
  name: ArtworkCategory
  label: string
  count: number
}

export interface CategoriesResponse {
  categories: CategoryInfo[]
}

/**
 * Get all categories with artwork counts
 */
export async function getCategories(
  db: Database
): Promise<CategoriesResponse> {
  const results = await db
    .prepare(
      `
      SELECT
        a.category,
        COUNT(*) as count
      FROM artworks a
      JOIN galleries g ON a.gallery_id = g.id
      JOIN users u ON g.user_id = u.id
      WHERE a.status = 'active'
      AND g.status = 'active'
      AND u.status = 'active'
      AND a.category IS NOT NULL
      AND a.category IN ('manga', 'comic', 'illustration', 'concept-art', 'fan-art', 'other')
      GROUP BY a.category
      ORDER BY count DESC, a.category ASC
      `
    )
    .all<{ category: ArtworkCategory; count: number }>()

  const categoryMap: Record<string, number> = {}
  ;(results?.results || []).forEach((row) => {
    categoryMap[row.category] = row.count
  })

  const categories: CategoryInfo[] = VALID_CATEGORIES.map((cat) => ({
    name: cat,
    label: formatCategoryLabel(cat),
    count: categoryMap[cat] || 0,
  }))

  return {
    categories,
  }
}

/**
 * Format category name for display
 */
function formatCategoryLabel(category: ArtworkCategory): string {
  const labels: Record<ArtworkCategory, string> = {
    manga: 'Manga',
    comic: 'Comics',
    illustration: 'Illustration',
    'concept-art': 'Concept Art',
    'fan-art': 'Fan Art',
    other: 'Other',
  }
  return labels[category]
}

/**
 * Get paginated artworks for a specific category
 */
export async function getArtworksByCategory(
  db: Database,
  category: string,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResponse<ArtworkPreview>> {
  // Validate category
  if (!VALID_CATEGORIES.includes(category as ArtworkCategory)) {
    throw Errors.badRequest(
      `Invalid category. Valid categories: ${VALID_CATEGORIES.join(', ')}`
    )
  }

  // Validate pagination parameters
  page = Math.max(1, Math.min(page, Number.MAX_SAFE_INTEGER))
  limit = Math.max(1, Math.min(limit, 100)) // Max 100 per request

  const offset = (page - 1) * limit

  // Get total count for this category
  const countResult = await db
    .prepare(
      `
      SELECT COUNT(*) as total
      FROM artworks a
      JOIN galleries g ON a.gallery_id = g.id
      JOIN users u ON g.user_id = u.id
      WHERE a.status = 'active'
      AND g.status = 'active'
      AND u.status = 'active'
      AND a.category = ?
      `
    )
    .bind(category)
    .first<{ total: number }>()

  const total = countResult?.total || 0
  const pages = Math.ceil(total / limit)

  // Get paginated artworks
  const artworks = await db
    .prepare(
      `
      SELECT
        a.id,
        a.slug,
        a.title,
        a.artist_name,
        u.username as artist_username,
        a.category,
        a.image_url,
        a.thumbnail_url,
        a.gallery_id,
        a.created_at
      FROM artworks a
      JOIN galleries g ON a.gallery_id = g.id
      JOIN users u ON g.user_id = u.id
      WHERE a.status = 'active'
      AND g.status = 'active'
      AND u.status = 'active'
      AND a.category = ?
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
      `
    )
    .bind(category, limit, offset)
    .all<ArtworkPreview>()

  return {
    data: artworks?.results || [],
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  }
}
```

---

### Step 2: Create Category Route Handlers

Add handlers to the browse routes file.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/browse.ts`

Add these functions:

```typescript
import {
  getCategories,
  getArtworksByCategory,
  CategoriesResponse,
} from '../services/browse.service'

/**
 * GET /api/browse/categories
 * Get list of all categories with artwork counts
 *
 * Authentication: Public (no auth required)
 * Response: CategoriesResponse
 */
export async function handleGetCategories(c: HonoContext) {
  try {
    const db = c.env.DB

    const result = await getCategories(db)

    return c.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=600', // Cache for 10 minutes
      },
    })
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw Errors.internal('Failed to retrieve categories')
  }
}

/**
 * GET /api/browse/categories/:category
 * Get paginated artworks for a specific category
 *
 * Path Parameters:
 * - category: string (must be one of: manga, comic, illustration, concept-art, fan-art, other)
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 *
 * Authentication: Public (no auth required)
 * Response: PaginatedResponse<ArtworkPreview>
 */
export async function handleGetArtworksByCategory(c: HonoContext) {
  try {
    const category = c.req.param('category')

    if (!category) {
      throw Errors.badRequest('Category is required')
    }

    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
    const limit = Math.max(
      1,
      Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
    )

    // Validate parameters
    if (isNaN(page) || isNaN(limit)) {
      throw Errors.badRequest('Page and limit must be valid numbers')
    }

    const db = c.env.DB

    const result = await getArtworksByCategory(db, category, page, limit)

    return c.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    })
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw Errors.internal('Failed to retrieve artworks for category')
  }
}
```

---

### Step 3: Register Category Routes

Add the routes to the main Hono app.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts`

Update the browse routes section:

```typescript
import {
  handleGetFeaturedContent,
  handleGetRecentArtworks,
  handleGetCategories,
  handleGetArtworksByCategory,
} from './routes/browse'

// ============================================
// Browse Routes (Phase 18)
// ============================================

app.get('/browse/featured', handleGetFeaturedContent)
app.get('/browse/recent', handleGetRecentArtworks)
app.get('/browse/categories', handleGetCategories)
app.get('/browse/categories/:category', handleGetArtworksByCategory)
```

**Important**: Register the categories list route BEFORE the parameterized category route.

---

### Step 4: Add Category Indexes

Optimize queries for category filtering.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/schema/migrations.sql`

```sql
-- Index for category queries
CREATE INDEX IF NOT EXISTS idx_artworks_category_status
  ON artworks(category, status, created_at DESC);
```

---

## Files to Create/Modify

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/services/browse.service.ts` - Add category queries
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/routes/browse.ts` - Add category handlers
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/index.ts` - Register category routes
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/lib/api/schema/migrations.sql` - Add category index

---

## Verification

### Test 1: Compile TypeScript

```bash
cd /Volumes/DataSSD/gitsrc/vfa_gallery
npx tsc --noEmit
```

Expected: No type errors

---

### Test 2: Get All Categories

```bash
curl http://localhost:8788/api/browse/categories
```

Expected response (200):
```json
{
  "categories": [
    {
      "name": "manga",
      "label": "Manga",
      "count": 25
    },
    {
      "name": "comic",
      "label": "Comics",
      "count": 18
    },
    {
      "name": "illustration",
      "label": "Illustration",
      "count": 42
    },
    {
      "name": "concept-art",
      "label": "Concept Art",
      "count": 15
    },
    {
      "name": "fan-art",
      "label": "Fan Art",
      "count": 22
    },
    {
      "name": "other",
      "label": "Other",
      "count": 8
    }
  ]
}
```

---

### Test 3: Get Manga Category

```bash
curl http://localhost:8788/api/browse/categories/manga
```

Expected response (200):
```json
{
  "data": [
    {
      "id": "art_001",
      "slug": "manga-artwork-1",
      "title": "Manga Artwork 1",
      "artist_name": "Sam Corl",
      "artist_username": "sam-corl",
      "category": "manga",
      "image_url": "https://r2.example.com/manga-1.jpg",
      "thumbnail_url": "https://r2.example.com/manga-1-thumb.jpg",
      "gallery_id": "gal_123",
      "created_at": "2026-01-19T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "pages": 2
  }
}
```

---

### Test 4: Invalid Category

```bash
curl http://localhost:8788/api/browse/categories/invalid
```

Expected response (400):
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid category. Valid categories: manga, comic, illustration, concept-art, fan-art, other"
  }
}
```

---

### Test 5: Category with No Artworks

If 'other' category has no artworks:

```bash
curl http://localhost:8788/api/browse/categories/other
```

Expected response (200):
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "pages": 0
  }
}
```

---

### Test 6: Pagination on Category

```bash
curl "http://localhost:8788/api/browse/categories/manga?page=1&limit=10"
curl "http://localhost:8788/api/browse/categories/manga?page=2&limit=10"
```

Expected: First page has 10 items, second page has remaining items

---

### Test 7: All Valid Categories

Test each valid category returns correct results:

```bash
for cat in manga comic illustration concept-art fan-art other; do
  curl "http://localhost:8788/api/browse/categories/$cat"
done
```

Expected: All return valid responses (empty or with data)

---

### Test 8: Category Count Accuracy

Create 5 manga artworks. Get categories:

```bash
curl http://localhost:8788/api/browse/categories | jq '.categories[] | select(.name == "manga")'
```

Expected: Manga category shows count: 5

---

### Test 9: Inactive Artworks Excluded from Count

Create 3 manga artworks (2 active, 1 inactive). Get categories:

```bash
curl http://localhost:8788/api/browse/categories | jq '.categories[] | select(.name == "manga").count'
```

Expected: Count is 2 (inactive not included)

---

### Test 10: Null Category Not Included

Create artworks with category=null:

```bash
curl http://localhost:8788/api/browse/categories
```

Expected: No null or undefined category in response

---

### Test 11: Case Sensitivity

Try uppercase category:

```bash
curl http://localhost:8788/api/browse/categories/Manga
```

Expected response (400): Invalid category error

---

### Test 12: Hyphenated Category

```bash
curl http://localhost:8788/api/browse/categories/concept-art
```

Expected response (200): Valid result for concept-art

---

### Test 13: Category Ordering by Count

Create artworks: manga (50), comic (30), illustration (40)

```bash
curl http://localhost:8788/api/browse/categories | jq '.categories[0:3] | .[] | .name'
```

Expected order: manga, illustration, comic (descending by count)

---

### Test 14: Cache Headers on Categories List

```bash
curl -i http://localhost:8788/api/browse/categories
```

Expected: `Cache-Control: public, max-age=600`

---

### Test 15: Cache Headers on Category Items

```bash
curl -i http://localhost:8788/api/browse/categories/manga
```

Expected: `Cache-Control: public, max-age=300`

---

### Test 16: Pagination Limit Enforcement

```bash
curl "http://localhost:8788/api/browse/categories/manga?limit=200"
```

Expected: Returns maximum 100 items (limit capped)

---

## Summary

This build creates two category browsing endpoints:

1. **GET /api/browse/categories** - Lists all 6 valid categories with artwork counts
2. **GET /api/browse/categories/:category** - Returns paginated artworks for a specific category

Key features:

- Public endpoints with no authentication required
- Valid categories: manga, comic, illustration, concept-art, fan-art, other
- Pagination support for category artworks
- Accurate count aggregation
- Filters by active status (artworks, galleries, users)
- Proper HTTP caching headers
- Database indexes for performance
- Full validation of category names

These endpoints enable category-based browsing on the browse page, allowing users to filter artwork by type.

---

**Next step:** Proceed to **96-UI-HOMEPAGE.md** to build the homepage UI.
