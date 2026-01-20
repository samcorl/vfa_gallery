# 97-UI-BROWSE-PAGE.md

## Goal
Build the browse page (`/browse`) with tabs for Featured, Recent, and Categories. Users can switch between browse modes and view artwork in a filterable grid.

---

## Spec Extract

From Phase 18 requirements:
- **Layout**: Tab-based filtering (Featured | Recent | Categories)
- **Grid**: Artwork grid with responsive columns
- **Navigation**: Easy switching between browse modes
- **Categories**: Side panel or dropdown showing category filters
- **Responsive**: Mobile-first, works across all devices
- **Deep-Linkable**: URL reflects current browse mode

---

## Prerequisites

**Must complete before starting:**
- **93-API-BROWSE-FEATURED.md** - Featured endpoint
- **94-API-BROWSE-RECENT.md** - Recent endpoint
- **95-API-BROWSE-CATEGORIES.md** - Categories endpoint
- **96-UI-HOMEPAGE.md** - Artwork Grid and Card components
- **98-UI-BROWSE-INFINITE-SCROLL.md** - Infinite scroll capability

---

## Steps

### Step 1: Create Browse Page Route

Create the main browse page component with tab navigation.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/Browse.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArtworkGrid } from '../components/ArtworkGrid'
import { BrowseInfiniteScroll } from '../components/BrowseInfiniteScroll'
import { CategoryFilter } from '../components/CategoryFilter'
import { useApi } from '../hooks/useApi'
import styles from './Browse.module.css'

type BrowseMode = 'featured' | 'recent' | 'categories'

export const Browse: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<BrowseMode>(
    (searchParams.get('mode') as BrowseMode) || 'featured'
  )
  const [category, setCategory] = useState<string | null>(
    searchParams.get('category')
  )
  const [artworks, setArtworks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch data based on current mode
  const { data: featuredData, loading: featuredLoading } = useApi(
    mode === 'featured' ? '/api/browse/featured' : null
  )

  const { data: categoriesData } = useApi(
    mode === 'categories' && category
      ? `/api/browse/categories/${category}?page=1&limit=20`
      : null
  )

  // Update URL when mode changes
  const handleModeChange = (newMode: BrowseMode) => {
    setMode(newMode)
    setCategory(null)
    setArtworks([])

    const params = new URLSearchParams()
    params.set('mode', newMode)
    setSearchParams(params)
  }

  // Update URL and data when category changes
  const handleCategoryChange = (selectedCategory: string | null) => {
    setCategory(selectedCategory)
    setArtworks([])

    const params = new URLSearchParams()
    params.set('mode', 'categories')
    if (selectedCategory) {
      params.set('category', selectedCategory)
    }
    setSearchParams(params)
  }

  // Update artworks based on data
  useEffect(() => {
    if (mode === 'featured' && featuredData?.data?.artworks) {
      setArtworks(featuredData.data.artworks)
      setLoading(featuredLoading)
    } else if (mode === 'categories' && categoriesData?.data) {
      setArtworks(categoriesData.data)
      setLoading(false)
    }
  }, [featuredData, categoriesData, mode, featuredLoading])

  return (
    <div className={styles.browse}>
      {/* Browse Mode Tabs */}
      <nav className={styles.tabs}>
        <button
          className={`${styles.tab} ${mode === 'featured' ? styles.active : ''}`}
          onClick={() => handleModeChange('featured')}
        >
          Featured
        </button>
        <button
          className={`${styles.tab} ${mode === 'recent' ? styles.active : ''}`}
          onClick={() => handleModeChange('recent')}
        >
          Recent
        </button>
        <button
          className={`${styles.tab} ${mode === 'categories' ? styles.active : ''}`}
          onClick={() => handleModeChange('categories')}
        >
          Categories
        </button>
      </nav>

      <div className={styles.content}>
        {/* Category Filter (Categories mode only) */}
        {mode === 'categories' && (
          <aside className={styles.filterSidebar}>
            <CategoryFilter
              selected={category}
              onChange={handleCategoryChange}
            />
          </aside>
        )}

        {/* Main Content */}
        <main className={styles.main}>
          {mode === 'featured' && (
            <ArtworkGrid
              artworks={artworks}
              loading={loading}
              columns={{ mobile: 2, tablet: 3, desktop: 4 }}
            />
          )}

          {mode === 'recent' && (
            <BrowseInfiniteScroll endpoint="/api/browse/recent" />
          )}

          {mode === 'categories' && category && (
            <BrowseInfiniteScroll
              endpoint={`/api/browse/categories/${category}`}
            />
          )}

          {mode === 'categories' && !category && (
            <div className={styles.selectCategory}>
              <p>Select a category to browse</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
```

---

### Step 2: Create Browse Page Styles

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/Browse.module.css`

```css
.browse {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

/* Tab Navigation */
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid #e0e0e0;
  padding: 0 1rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  flex: 1;
  min-width: 100px;
  padding: 1rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  color: #666;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.tab:hover {
  color: #1a1a1a;
  background: #f5f5f5;
}

.tab.active {
  color: #0066cc;
  border-bottom-color: #0066cc;
  background: transparent;
}

/* Content Area */
.content {
  display: flex;
  flex: 1;
  gap: 0;
}

.filterSidebar {
  display: none;
  width: 250px;
  border-right: 1px solid #e0e0e0;
  padding: 1.5rem;
  background: #f9f9f9;
  overflow-y: auto;
}

.main {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

.selectCategory {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #999;
  font-size: 1.1rem;
}

/* Tablet Breakpoint */
@media (min-width: 640px) {
  .tabs {
    padding: 0 2rem;
  }

  .tab {
    min-width: 120px;
    padding: 1.25rem;
  }

  .main {
    padding: 2rem;
  }
}

/* Desktop Breakpoint */
@media (min-width: 1024px) {
  .tabs {
    padding: 0 3rem;
  }

  .tab {
    min-width: 140px;
    padding: 1.5rem;
    flex: 0 1 auto;
  }

  .filterSidebar {
    display: block;
  }

  .main {
    padding: 2rem 3rem;
  }
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .browse {
    background: #1a1a1a;
  }

  .tabs {
    border-bottom-color: #333;
  }

  .tab {
    color: #aaa;
  }

  .tab:hover {
    color: #ffffff;
    background: #2d2d2d;
  }

  .tab.active {
    color: #66b3ff;
    border-bottom-color: #66b3ff;
  }

  .filterSidebar {
    background: #2d2d2d;
    border-right-color: #333;
  }

  .selectCategory {
    color: #666;
  }
}
```

---

### Step 3: Create Category Filter Component

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/CategoryFilter.tsx`

```typescript
import React, { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import styles from './CategoryFilter.module.css'

interface CategoryInfo {
  name: string
  label: string
  count: number
}

interface Props {
  selected: string | null
  onChange: (category: string | null) => void
}

export const CategoryFilter: React.FC<Props> = ({ selected, onChange }) => {
  const { data } = useApi('/api/browse/categories')
  const [categories, setCategories] = useState<CategoryInfo[]>([])

  useEffect(() => {
    if (data?.categories) {
      setCategories(data.categories)
    }
  }, [data])

  return (
    <div className={styles.filter}>
      <h3 className={styles.title}>Categories</h3>

      <button
        className={`${styles.option} ${!selected ? styles.active : ''}`}
        onClick={() => onChange(null)}
      >
        <span className={styles.label}>All Categories</span>
      </button>

      {categories.map((category) => (
        <button
          key={category.name}
          className={`${styles.option} ${
            selected === category.name ? styles.active : ''
          }`}
          onClick={() => onChange(category.name)}
        >
          <span className={styles.label}>{category.label}</span>
          <span className={styles.count}>{category.count}</span>
        </button>
      ))}
    </div>
  )
}
```

---

### Step 4: Create Category Filter Styles

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/CategoryFilter.module.css`

```css
.filter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  color: #1a1a1a;
}

.option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: transparent;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  text-align: left;
  color: #666;
}

.option:hover {
  background: #f5f5f5;
  border-color: #bbb;
  color: #1a1a1a;
}

.option.active {
  background: #e6f2ff;
  border-color: #0066cc;
  color: #0066cc;
  font-weight: 600;
}

.label {
  flex: 1;
}

.count {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  background: #f0f0f0;
  border-radius: 4px;
  color: #999;
  margin-left: 0.5rem;
}

.option.active .count {
  background: #cce5ff;
  color: #0066cc;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .title {
    color: #ffffff;
  }

  .option {
    border-color: #333;
    color: #aaa;
  }

  .option:hover {
    background: #2d2d2d;
    border-color: #555;
    color: #ffffff;
  }

  .option.active {
    background: #003d7a;
    border-color: #66b3ff;
    color: #66b3ff;
  }

  .count {
    background: #333;
    color: #666;
  }

  .option.active .count {
    background: #004080;
    color: #99d1ff;
  }
}
```

---

### Step 5: Register Browse Route

Update the main routing file to include the browse page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/App.tsx`

```typescript
import { Browse } from './pages/Browse'

// Add to router configuration:
{
  path: '/browse',
  element: <Browse />
}
```

---

## Files to Create/Modify

**Created files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/Browse.tsx` - Browse route
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/pages/Browse.module.css` - Browse styles
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/CategoryFilter.tsx` - Category filter component
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/components/CategoryFilter.module.css` - Filter styles

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/site/src/App.tsx` - Register browse route

---

## Verification

### Test 1: Browse Page Loads

Navigate to `http://localhost:5173/browse`

Expected: Page loads with three tabs (Featured, Recent, Categories)

---

### Test 2: Featured Tab Active

Expected: Featured tab is selected by default, shows featured artworks

---

### Test 3: Switch to Recent Tab

Click "Recent" tab

Expected: Page updates to show recent artworks with infinite scroll

---

### Test 4: Switch to Categories Tab

Click "Categories" tab

Expected: Shows category filter sidebar on desktop

---

### Test 5: Select Category Filter

Click on a category (e.g., "Manga")

Expected: URL includes `?mode=categories&category=manga`, loads category artworks

---

### Test 6: Clear Category Selection

Click "All Categories"

Expected: URL clears category parameter, shows prompt to select category

---

### Test 7: URL Deep-Linking

Manually navigate to `/browse?mode=recent`

Expected: Page loads with Recent tab active

---

### Test 8: Tab Persistence

Switch tabs and refresh page

Expected: Returns to default featured tab (not previously selected unless URL parameter set)

---

### Test 9: Mobile View

Resize to mobile width

Expected: Tabs remain accessible, filter sidebar hidden, artwork grid shows 2 columns

---

### Test 10: Tablet View

Resize to tablet width (640px-1024px)

Expected: Artwork grid shows 3 columns, tabs still scrollable horizontally if needed

---

### Test 11: Desktop View

Resize to desktop width (1024px+)

Expected: Artwork grid shows 4 columns, filter sidebar visible on categories tab

---

### Test 12: Artwork Click

Click on artwork card

Expected: Navigates to artwork detail page

---

### Test 13: Loading State

Check loading feedback when switching between tabs

Expected: Shows loading indicator appropriately

---

### Test 14: Empty Category

Select a category with no artworks

Expected: Shows "No results" message gracefully

---

### Test 15: Category Counts

Verify counts shown in filter match actual number of artworks

Expected: Counts are accurate

---

## Summary

This build creates the browse page with:

- Tab-based mode switching (Featured, Recent, Categories)
- Category filtering with sidebar (desktop) or selector
- Responsive artwork grid
- Infinite scroll for Recent and Categories modes
- Deep-linkable URLs with query parameters
- Proper loading and empty states
- Mobile-first responsive design

The browse page is the primary content discovery interface on the platform.

---

**Next step:** Proceed to **98-UI-BROWSE-INFINITE-SCROLL.md** to implement infinite scroll functionality.
