import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('loads and displays key sections', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/VFA\.gallery/i)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('navigation')).toBeVisible()
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

test.describe('Browse Page', () => {
  test('loads with title', async ({ page }) => {
    await page.goto('/browse')
    await expect(page).toHaveTitle(/Browse/i)
  })

  test('shows artwork grid or empty state', async ({ page }) => {
    await page.goto('/browse')

    const artworks = page.locator('[data-testid="artwork-card"]')
    const emptyState = page.getByText(/no artworks/i)

    await expect(artworks.first().or(emptyState)).toBeVisible({ timeout: 5000 })
  })

  test('artwork cards are tappable on mobile', async ({ page }) => {
    await page.goto('/browse')

    const firstArtwork = page.locator('[data-testid="artwork-card"]').first()

    if (await firstArtwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstArtwork.click()
      await expect(page).toHaveURL(/\/.+\/.+\/.+\/.+/)
    }
  })
})

test.describe('Search Page', () => {
  test('shows search input', async ({ page }) => {
    await page.goto('/search')

    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    )
    await expect(searchInput).toBeVisible()
  })

  test('search input is focusable on mobile', async ({ page }) => {
    await page.goto('/search')

    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    )
    await searchInput.tap()
    await expect(searchInput).toBeFocused()
  })

  test('accepts input and submits', async ({ page }) => {
    await page.goto('/search')

    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    )
    await searchInput.fill('art')
    await searchInput.press('Enter')

    // Wait for results or no-results
    await page.waitForTimeout(1000)

    const results = page.locator('[data-testid="search-result"]')
    const noResults = page.getByText(/no results/i)
    await expect(results.first().or(noResults)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Artwork Detail', () => {
  test('displays image and metadata from browse', async ({ page }) => {
    await page.goto('/browse')

    const firstArtwork = page.locator('[data-testid="artwork-card"]').first()

    if (await firstArtwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstArtwork.click()

      await expect(page.getByRole('img').first()).toBeVisible()
      await expect(page.getByRole('heading').first()).toBeVisible()
    }
  })

  test('has article OG type', async ({ page }) => {
    await page.goto('/browse')

    const firstArtwork = page.locator('[data-testid="artwork-card"]').first()

    if (await firstArtwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstArtwork.click()

      const ogType = page.locator('meta[property="og:type"]')
      await expect(ogType).toHaveAttribute('content', 'article')
    }
  })
})

test.describe('Navigation', () => {
  test('back navigation works', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /browse/i }).click()
    await expect(page).toHaveURL(/\/browse/)

    await page.goBack()
    await expect(page).toHaveURL('/')
  })

  test('404 page for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345')
    await expect(page.getByText(/not found/i)).toBeVisible()
  })

  test('mobile hamburger menu', async ({ page }) => {
    await page.goto('/')

    const menuButton = page.getByRole('button', { name: /menu/i }).or(
      page.locator('[data-testid="mobile-menu"]')
    )

    if (await menuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuButton.tap()
      await expect(page.getByRole('link', { name: /browse/i })).toBeVisible()
    }
  })
})
