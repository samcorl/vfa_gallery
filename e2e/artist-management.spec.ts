import { test, expect } from '@playwright/test'

test.describe('Profile', () => {
  test('authenticated user can view profile', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('shows galleries and artworks links', async ({ page }) => {
    await page.goto('/profile')

    const galleriesLink = page.getByRole('link', { name: /galleri/i })
    const artworksLink = page.getByRole('link', { name: /artwork/i })

    await expect(galleriesLink).toBeVisible()
    await expect(artworksLink).toBeVisible()
  })

  test('can navigate to profile edit', async ({ page }) => {
    await page.goto('/profile')
    await page.getByRole('link', { name: /edit/i }).click()
    await expect(page).toHaveURL(/\/profile\/edit/)
  })
})

test.describe('Profile Edit', () => {
  test('edit form loads with fields', async ({ page }) => {
    await page.goto('/profile/edit')

    const displayNameInput = page.getByLabel(/display name/i).or(
      page.getByPlaceholder(/display name/i)
    )
    await expect(displayNameInput).toBeVisible()
  })

  test('can update display name', async ({ page }) => {
    await page.goto('/profile/edit')

    const displayNameInput = page.getByLabel(/display name/i).or(
      page.getByPlaceholder(/display name/i)
    )
    await displayNameInput.clear()
    await displayNameInput.fill('E2E Test Artist')

    const saveButton = page.getByRole('button', { name: /save/i })
    await saveButton.click()

    const toast = page.getByText(/saved|updated|success/i)
    const profilePage = page.locator('text=E2E Test Artist')
    await expect(toast.or(profilePage)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Gallery Management', () => {
  test('gallery list shows galleries', async ({ page }) => {
    await page.goto('/profile/galleries')

    const galleryCards = page.getByRole('link').filter({ hasText: /gallery/i })
    await expect(galleryCards.first()).toBeVisible({ timeout: 5000 })
  })

  test('can create a new gallery', async ({ page }) => {
    await page.goto('/profile/galleries/new')

    const nameInput = page.getByLabel(/name/i).or(
      page.getByPlaceholder(/gallery name/i)
    )
    await nameInput.fill(`E2E Gallery ${Date.now()}`)

    const descInput = page.getByLabel(/description/i).or(
      page.getByPlaceholder(/description/i)
    )
    if (await descInput.isVisible()) {
      await descInput.fill('A test gallery created by E2E tests')
    }

    const createButton = page.getByRole('button', { name: /create/i })
    await createButton.click()

    await expect(page).toHaveURL(/\/profile\/galleries\//, { timeout: 5000 })
  })
})

test.describe('Artwork Upload', () => {
  test('upload page has file input', async ({ page }) => {
    await page.goto('/artworks/upload')

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()

    const titleInput = page.getByLabel(/title/i).or(
      page.getByPlaceholder(/title/i)
    )
    await expect(titleInput).toBeVisible()
  })

  test('can upload artwork with image', async ({ page }) => {
    await page.goto('/artworks/upload')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test-artwork.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      ),
    })

    const titleInput = page.getByLabel(/title/i).or(
      page.getByPlaceholder(/title/i)
    )
    await titleInput.fill(`E2E Artwork ${Date.now()}`)

    const uploadButton = page.getByRole('button', { name: /upload|submit|save/i })
    await uploadButton.click()

    const success = page.getByText(/uploaded|success|created/i)
    await expect(success).toBeVisible({ timeout: 10000 })
  })

  test('validates required fields', async ({ page }) => {
    await page.goto('/artworks/upload')

    const uploadButton = page.getByRole('button', { name: /upload|submit|save/i })

    if (await uploadButton.isVisible()) {
      await uploadButton.click()

      const error = page.getByText(/required|please|select/i)
      await expect(error).toBeVisible({ timeout: 3000 })
    }
  })
})

test.describe('Artwork Edit', () => {
  test('artworks list page loads', async ({ page }) => {
    await page.goto('/profile/artworks')

    const artworks = page.getByRole('link').filter({ hasText: /artwork|e2e/i })
    const emptyState = page.getByText(/no artworks/i)

    await expect(artworks.first().or(emptyState)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Auth Protection', () => {
  test('unauthenticated user redirected from profile', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/profile')
    await expect(page).toHaveURL('/')

    await context.close()
  })

  test('unauthenticated user redirected from admin', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/admin')
    await expect(page).toHaveURL('/')

    await context.close()
  })
})
