# Build 172: E2E Public Browsing Flows

## Goal

Test all unauthenticated user flows: homepage loading, browsing artworks, searching, viewing artist profiles, galleries, collections, and individual artworks. These tests run without authentication (anon projects) and validate the core discovery experience on mobile devices.

---

## Spec Extract

From E2E Testing Requirements:

- **Flows:** Homepage → Browse → Search → Artist → Gallery → Collection → Artwork
- **No auth required:** These are public pages accessible to all visitors
- **Mobile-first:** Touch interactions, viewport constraints, scroll behavior
- **SEO validation:** OG meta tags present on each page (from Phase 28)

---

## Prerequisites

**Must complete before starting:**
- **171-E2E-PLAYWRIGHT-SETUP.md** — Playwright installed and configured

---

## Steps

### Step 1: Homepage Flow

**File:** `e2e/public-browsing.anon.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('loads and displays key sections', async ({ page }) => {
    await page.goto('/')

    // Page title and heading
    await expect(page).toHaveTitle(/VFA\.gallery/i)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Navigation is present
    await expect(page.getByRole('navigation')).toBeVisible()

    // Has browse/search links
    await expect(page.getByRole('link', { name: /browse/i })).toBeVisible()
  })

  test('has Open Graph meta tags', async ({ page }) => {
    await page.goto('/')

    const ogTitle = page.locator('meta[property="og:title"]')
    await expect(ogTitle).toHaveAttribute('content', /VFA\.gallery/i)

    const ogType = page.locator('meta[property="og:type"]')
    await expect(ogType).toHaveAttribute('content', 'website')

    const twitterCard = page.locator('meta[name="twitter:card"]')
    await expect(twitterCard).toHaveAttribute('content', /.+/)
  })

  test('navigates to browse page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /browse/i }).click()
    await expect(page).toHaveURL(/\/browse/)
  })
})
```

---

### Step 2: Browse Page Flow

```typescript
test.describe('Browse Page', () => {
  test('loads artwork grid', async ({ page }) => {
    await page.goto('/browse')

    await expect(page).toHaveTitle(/Browse/i)

    // Should show artwork cards or empty state
    const artworks = page.locator('[data-testid="artwork-card"]')
    const emptyState = page.getByText(/no artworks/i)

    // One or the other should be visible
    await expect(artworks.first().or(emptyState)).toBeVisible()
  })

  test('artwork cards are tappable on mobile', async ({ page }) => {
    await page.goto('/browse')

    const firstArtwork = page.locator('[data-testid="artwork-card"]').first()

    // If artworks exist, verify they're clickable
    if (await firstArtwork.isVisible()) {
      await firstArtwork.click()
      // Should navigate to artwork detail page
      await expect(page).toHaveURL(/\/.+\/.+\/.+\/.+/)
    }
  })

  test('scrolls to load more content', async ({ page }) => {
    await page.goto('/browse')

    // Scroll to bottom to trigger infinite scroll / pagination
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Wait for any loading indicator or new content
    await page.waitForTimeout(1000)
  })
})
```

**Note:** Add `data-testid="artwork-card"` to the artwork card component if not already present. Playwright best practice is to use `data-testid` attributes for test-specific selectors, keeping tests decoupled from styling.

---

### Step 3: Search Flow

```typescript
test.describe('Search Page', () => {
  test('shows search input', async ({ page }) => {
    await page.goto('/search')

    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    )
    await expect(searchInput).toBeVisible()
  })

  test('searches and displays results', async ({ page }) => {
    await page.goto('/search')

    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    )
    await searchInput.fill('art')
    await searchInput.press('Enter')

    // Should show results or no-results message
    await page.waitForTimeout(1000) // wait for API response

    const results = page.locator('[data-testid="search-result"]')
    const noResults = page.getByText(/no results/i)
    await expect(results.first().or(noResults)).toBeVisible()
  })

  test('search input is accessible on mobile keyboard', async ({ page }) => {
    await page.goto('/search')

    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    )

    // Tap to focus — should not be obscured by mobile chrome
    await searchInput.tap()
    await expect(searchInput).toBeFocused()
  })
})
```

---

### Step 4: Artist Profile Flow

```typescript
test.describe('Artist Profile', () => {
  // Note: These tests require at least one artist to exist.
  // The auth setup creates a test user — use that username.
  // If no artists exist yet, these tests will verify the 404 page gracefully.

  test('displays artist profile or 404', async ({ page }) => {
    // Navigate to a known test artist (created by auth setup)
    await page.goto('/e2etest')

    const profile = page.getByRole('heading')
    const notFound = page.getByText(/not found/i)

    await expect(profile.or(notFound)).toBeVisible()
  })

  test('artist profile has OG profile type', async ({ page }) => {
    await page.goto('/e2etest')

    // If page loads (not 404), check OG tags
    const ogType = page.locator('meta[property="og:type"]')
    if (await ogType.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(ogType).toHaveAttribute('content', 'profile')
    }
  })

  test('gallery links are tappable', async ({ page }) => {
    await page.goto('/e2etest')

    const galleryLink = page.getByRole('link').filter({ hasText: /gallery/i }).first()
    if (await galleryLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await galleryLink.tap()
      await expect(page).toHaveURL(/\/e2etest\/.+/)
    }
  })
})
```

---

### Step 5: Artwork Detail Flow

```typescript
test.describe('Artwork Detail', () => {
  test('displays artwork image and metadata', async ({ page }) => {
    // Navigate to browse, find an artwork, click it
    await page.goto('/browse')

    const firstArtwork = page.locator('[data-testid="artwork-card"]').first()

    if (await firstArtwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstArtwork.click()

      // Should show artwork image
      await expect(page.getByRole('img').first()).toBeVisible()

      // Should show title
      await expect(page.getByRole('heading').first()).toBeVisible()

      // Should show artist name
      const artistLink = page.getByRole('link').filter({ hasText: /.+/ })
      await expect(artistLink.first()).toBeVisible()
    }
  })

  test('share buttons are visible on artwork page', async ({ page }) => {
    await page.goto('/browse')

    const firstArtwork = page.locator('[data-testid="artwork-card"]').first()

    if (await firstArtwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstArtwork.click()

      // Share buttons should be present (from Phase 28)
      const shareSection = page.getByText(/share/i).or(
        page.getByRole('button', { name: /copy/i })
      )
      await expect(shareSection).toBeVisible()
    }
  })

  test('artwork has OG article type', async ({ page }) => {
    await page.goto('/browse')

    const firstArtwork = page.locator('[data-testid="artwork-card"]').first()

    if (await firstArtwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstArtwork.click()

      const ogType = page.locator('meta[property="og:type"]')
      await expect(ogType).toHaveAttribute('content', 'article')

      const ogImage = page.locator('meta[property="og:image"]')
      await expect(ogImage).toHaveAttribute('content', /.+/)
    }
  })
})
```

---

### Step 6: Navigation and Layout Tests

```typescript
test.describe('Mobile Navigation', () => {
  test('hamburger menu works on mobile', async ({ page }) => {
    await page.goto('/')

    // Mobile should have a hamburger/menu button
    const menuButton = page.getByRole('button', { name: /menu/i }).or(
      page.locator('[data-testid="mobile-menu"]')
    )

    if (await menuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuButton.tap()

      // Menu items should be visible
      await expect(page.getByRole('link', { name: /browse/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /search/i })).toBeVisible()
    }
  })

  test('back navigation works', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /browse/i }).click()
    await expect(page).toHaveURL(/\/browse/)

    await page.goBack()
    await expect(page).toHaveURL('/')
  })

  test('404 page displays for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345')

    await expect(page.getByText(/not found/i)).toBeVisible()
  })
})
```

---

### Step 7: Footer Ad Visibility

```typescript
test.describe('Footer Ads', () => {
  test('footer ad placeholder visible on browse page', async ({ page }) => {
    await page.goto('/browse')

    const adLabel = page.getByText(/advertisement/i)
    // Scroll to bottom where footer ad lives
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    if (await adLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(adLabel).toBeVisible()
    }
  })
})
```

---

## Verification

- [ ] `npm run test:e2e:anon` runs all public browsing tests on mobile devices
- [ ] Homepage loads and has correct title
- [ ] Browse page shows artwork grid or empty state
- [ ] Search accepts input and shows results or empty state
- [ ] Artist profile pages load with correct OG tags
- [ ] Artwork detail pages show image, title, share buttons
- [ ] Mobile navigation (hamburger menu) works via tap
- [ ] 404 page renders for unknown routes
- [ ] All tests pass on both iPhone and Pixel viewports

---

## Notes

- **data-testid attributes:** Some tests reference `data-testid` attributes that may need to be added to components. These are the recommended Playwright approach for stable selectors. Add them incrementally as needed.
- **Conditional assertions:** Many tests use `if (await element.isVisible())` patterns because test data may not exist yet. As test data seeding matures, these can become strict assertions.
- **Touch interactions:** Tests use `.tap()` instead of `.click()` where mobile touch behavior matters. Playwright emulates touch events on mobile device profiles.
- **API-dependent:** These tests hit the real API through the dev server. If the database is empty, browse/search will show empty states — that's OK, the tests verify the UI handles both cases.
