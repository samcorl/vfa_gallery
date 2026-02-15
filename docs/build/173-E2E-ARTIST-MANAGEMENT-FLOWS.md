# Build 173: E2E Artist Management Flows

## Goal

Test authenticated artist workflows: profile viewing and editing, gallery creation and management, collection management, artwork upload and editing. These are the core content management flows that artists perform on mobile devices.

---

## Spec Extract

From E2E Testing Requirements:

- **Flows:** Profile → Edit Profile → Create Gallery → Manage Gallery → Create Collection → Upload Artwork → Edit Artwork
- **Auth required:** All flows use the authenticated storageState from setup
- **Mobile-first:** File upload via mobile, form interactions, touch-based management
- **Full CRUD:** Create, read, update for galleries, collections, and artworks

---

## Prerequisites

**Must complete before starting:**
- **171-E2E-PLAYWRIGHT-SETUP.md** — Playwright installed, auth bypass configured
- **172-E2E-PUBLIC-BROWSING-FLOWS.md** — Public flow patterns established

---

## Steps

### Step 1: Profile Flow

**File:** `e2e/artist-management.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Profile', () => {
  test('authenticated user can view profile', async ({ page }) => {
    await page.goto('/profile')

    // Should not redirect to home (auth is valid)
    await expect(page).toHaveURL(/\/profile/)

    // Should show user info
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('profile shows galleries and artworks links', async ({ page }) => {
    await page.goto('/profile')

    // Should have links to manage galleries and artworks
    const galleriesLink = page.getByRole('link', { name: /galleri/i })
    const artworksLink = page.getByRole('link', { name: /artwork/i })

    await expect(galleriesLink).toBeVisible()
    await expect(artworksLink).toBeVisible()
  })

  test('can navigate to profile edit', async ({ page }) => {
    await page.goto('/profile')

    const editLink = page.getByRole('link', { name: /edit/i })
    await editLink.click()

    await expect(page).toHaveURL(/\/profile\/edit/)
  })
})
```

---

### Step 2: Profile Edit Flow

```typescript
test.describe('Profile Edit', () => {
  test('edit form loads with current values', async ({ page }) => {
    await page.goto('/profile/edit')

    // Form fields should be present
    const displayNameInput = page.getByLabel(/display name/i).or(
      page.getByPlaceholder(/display name/i)
    )
    await expect(displayNameInput).toBeVisible()

    // Bio field
    const bioInput = page.getByLabel(/bio/i).or(
      page.getByPlaceholder(/bio/i)
    )
    await expect(bioInput).toBeVisible()
  })

  test('can update display name', async ({ page }) => {
    await page.goto('/profile/edit')

    const displayNameInput = page.getByLabel(/display name/i).or(
      page.getByPlaceholder(/display name/i)
    )

    // Clear and enter new name
    await displayNameInput.clear()
    await displayNameInput.fill('E2E Test Artist')

    // Submit
    const saveButton = page.getByRole('button', { name: /save/i })
    await saveButton.click()

    // Should show success (toast or redirect)
    const toast = page.getByText(/saved|updated|success/i)
    const profilePage = page.locator('text=E2E Test Artist')
    await expect(toast.or(profilePage)).toBeVisible({ timeout: 5000 })
  })

  test('bio field accepts multiline text on mobile', async ({ page }) => {
    await page.goto('/profile/edit')

    const bioInput = page.getByLabel(/bio/i).or(
      page.getByPlaceholder(/bio/i)
    )

    await bioInput.clear()
    await bioInput.fill('Line one.\nLine two.\nLine three.')

    // Verify the textarea expanded (mobile-friendly behavior)
    const box = await bioInput.boundingBox()
    expect(box?.height).toBeGreaterThan(50)
  })
})
```

---

### Step 3: Gallery Creation Flow

```typescript
test.describe('Gallery Management', () => {
  test('can create a new gallery', async ({ page }) => {
    await page.goto('/profile/galleries/new')

    // Fill gallery name
    const nameInput = page.getByLabel(/name/i).or(
      page.getByPlaceholder(/gallery name/i)
    )
    await nameInput.fill(`E2E Gallery ${Date.now()}`)

    // Fill description
    const descInput = page.getByLabel(/description/i).or(
      page.getByPlaceholder(/description/i)
    )
    if (await descInput.isVisible()) {
      await descInput.fill('A test gallery created by E2E tests')
    }

    // Submit
    const createButton = page.getByRole('button', { name: /create/i })
    await createButton.click()

    // Should redirect to gallery manager or show success
    await expect(page).toHaveURL(/\/profile\/galleries\//, { timeout: 5000 })
  })

  test('gallery list shows created galleries', async ({ page }) => {
    await page.goto('/profile/galleries')

    // Should show at least the default gallery (created during test-login)
    const galleryCards = page.locator('[data-testid="gallery-card"]').or(
      page.getByRole('link').filter({ hasText: /gallery/i })
    )
    await expect(galleryCards.first()).toBeVisible({ timeout: 5000 })
  })

  test('can edit gallery details', async ({ page }) => {
    await page.goto('/profile/galleries')

    // Click first gallery to manage it
    const firstGallery = page.getByRole('link').filter({ hasText: /gallery/i }).first()
    await firstGallery.click()

    // Find edit link/button
    const editButton = page.getByRole('link', { name: /edit/i }).or(
      page.getByRole('button', { name: /edit/i })
    )

    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click()
      await expect(page).toHaveURL(/\/edit/)

      // Verify edit form loads
      const nameInput = page.getByLabel(/name/i).or(
        page.getByPlaceholder(/name/i)
      )
      await expect(nameInput).toBeVisible()
    }
  })
})
```

---

### Step 4: Collection Management Flow

```typescript
test.describe('Collection Management', () => {
  test('can access collection manager from gallery', async ({ page }) => {
    await page.goto('/profile/galleries')

    // Navigate into a gallery
    const firstGallery = page.getByRole('link').filter({ hasText: /gallery/i }).first()

    if (await firstGallery.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstGallery.click()

      // Look for collection management UI
      const collectionsSection = page.getByText(/collection/i)
      await expect(collectionsSection).toBeVisible({ timeout: 5000 })
    }
  })

  test('can create a new collection', async ({ page }) => {
    await page.goto('/profile/galleries')

    const firstGallery = page.getByRole('link').filter({ hasText: /gallery/i }).first()

    if (await firstGallery.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstGallery.click()

      // Find "new collection" or "add collection" button
      const addButton = page.getByRole('button', { name: /new|add|create/i }).or(
        page.getByRole('link', { name: /new|add|create/i })
      )

      if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addButton.click()

        // Fill collection name
        const nameInput = page.getByLabel(/name/i).or(
          page.getByPlaceholder(/name/i)
        )
        await nameInput.fill(`E2E Collection ${Date.now()}`)

        const submitButton = page.getByRole('button', { name: /create|save/i })
        await submitButton.click()

        // Verify success
        const success = page.getByText(/created|success/i)
        await expect(success).toBeVisible({ timeout: 5000 })
      }
    }
  })
})
```

---

### Step 5: Artwork Upload Flow

```typescript
test.describe('Artwork Upload', () => {
  test('upload page loads with file input', async ({ page }) => {
    await page.goto('/artworks/upload')

    // Should have file input
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()

    // Should have title field
    const titleInput = page.getByLabel(/title/i).or(
      page.getByPlaceholder(/title/i)
    )
    await expect(titleInput).toBeVisible()
  })

  test('can upload artwork with image', async ({ page }) => {
    await page.goto('/artworks/upload')

    // Create a small test image (1x1 pixel PNG)
    // In a real test, use a fixture file: e2e/fixtures/test-artwork.jpg
    const fileInput = page.locator('input[type="file"]')

    // Use a test fixture image
    await fileInput.setInputFiles({
      name: 'test-artwork.png',
      mimeType: 'image/png',
      // 1x1 red pixel PNG (smallest valid PNG)
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      ),
    })

    // Fill title
    const titleInput = page.getByLabel(/title/i).or(
      page.getByPlaceholder(/title/i)
    )
    await titleInput.fill(`E2E Artwork ${Date.now()}`)

    // Select gallery/collection if dropdowns exist
    const gallerySelect = page.getByLabel(/gallery/i).or(
      page.locator('select').first()
    )
    if (await gallerySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select first available option
      const options = gallerySelect.locator('option')
      const count = await options.count()
      if (count > 1) {
        await gallerySelect.selectOption({ index: 1 })
      }
    }

    // Submit
    const uploadButton = page.getByRole('button', { name: /upload|submit|save/i })
    await uploadButton.click()

    // Should show success or redirect
    const success = page.getByText(/uploaded|success|created/i)
    await expect(success).toBeVisible({ timeout: 10000 }) // upload can be slow
  })

  test('upload form validates required fields', async ({ page }) => {
    await page.goto('/artworks/upload')

    // Try to submit without filling anything
    const uploadButton = page.getByRole('button', { name: /upload|submit|save/i })

    if (await uploadButton.isVisible()) {
      await uploadButton.click()

      // Should show validation error
      const error = page.getByText(/required|please|select/i)
      await expect(error).toBeVisible({ timeout: 3000 })
    }
  })

  test('file input accepts images on mobile', async ({ page }) => {
    await page.goto('/artworks/upload')

    // Verify the file input accepts image types
    const fileInput = page.locator('input[type="file"]')
    const accept = await fileInput.getAttribute('accept')

    // Should accept common image formats
    if (accept) {
      expect(accept).toMatch(/image/i)
    }
  })
})
```

---

### Step 6: Artwork Edit Flow

```typescript
test.describe('Artwork Edit', () => {
  test('artworks list shows uploaded artworks', async ({ page }) => {
    await page.goto('/profile/artworks')

    // Should show artwork list or empty state
    const artworks = page.locator('[data-testid="artwork-item"]').or(
      page.getByRole('link').filter({ hasText: /artwork|e2e/i })
    )
    const emptyState = page.getByText(/no artworks/i)

    await expect(artworks.first().or(emptyState)).toBeVisible({ timeout: 5000 })
  })

  test('can navigate to artwork edit page', async ({ page }) => {
    await page.goto('/profile/artworks')

    const editLink = page.getByRole('link', { name: /edit/i }).first()

    if (await editLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editLink.click()
      await expect(page).toHaveURL(/\/edit/)

      // Edit form should load
      const titleInput = page.getByLabel(/title/i).or(
        page.getByPlaceholder(/title/i)
      )
      await expect(titleInput).toBeVisible()
    }
  })

  test('can update artwork title', async ({ page }) => {
    await page.goto('/profile/artworks')

    const editLink = page.getByRole('link', { name: /edit/i }).first()

    if (await editLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editLink.click()

      const titleInput = page.getByLabel(/title/i).or(
        page.getByPlaceholder(/title/i)
      )
      await titleInput.clear()
      await titleInput.fill(`Updated E2E Artwork ${Date.now()}`)

      const saveButton = page.getByRole('button', { name: /save|update/i })
      await saveButton.click()

      const success = page.getByText(/saved|updated|success/i)
      await expect(success).toBeVisible({ timeout: 5000 })
    }
  })
})
```

---

### Step 7: Protected Route Redirect Test

```typescript
test.describe('Auth Protection', () => {
  // This test uses a fresh context WITHOUT storageState
  test('unauthenticated user redirected from protected pages', async ({ browser }) => {
    const context = await browser.newContext() // no storageState = unauthenticated
    const page = await context.newPage()

    // Try to access protected route
    await page.goto('/profile')

    // Should redirect to home
    await expect(page).toHaveURL('/')

    await context.close()
  })

  test('unauthenticated user redirected from admin pages', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/admin')
    await expect(page).toHaveURL('/')

    await context.close()
  })
})
```

---

## Verification

- [ ] `npm run test:e2e:mobile -- --grep "Profile"` — profile tests pass
- [ ] `npm run test:e2e:mobile -- --grep "Gallery"` — gallery creation works
- [ ] `npm run test:e2e:mobile -- --grep "Upload"` — artwork upload works with test image
- [ ] `npm run test:e2e:mobile -- --grep "Auth Protection"` — redirects work
- [ ] All tests pass on iPhone and Pixel viewports
- [ ] Protected routes redirect unauthenticated users
- [ ] Form submissions show success feedback (toast/redirect)
- [ ] File upload works with mobile file input

---

## Notes

- **Test isolation:** Each test creates its own data (gallery names include `Date.now()`). Tests don't depend on each other's side effects.
- **Mobile file upload:** `setInputFiles()` bypasses the native file picker, which can't be automated. This is the standard Playwright approach for file upload testing.
- **Flexible selectors:** Tests use `.or()` chains to handle variations in how labels/placeholders might be named. As the codebase stabilizes, tighten these to exact matches.
- **Timeout handling:** Upload tests use longer timeouts (10s) since image processing through R2 can be slow in dev.
- **data-testid cleanup:** Some selectors reference `data-testid` attributes. These should be added to components incrementally — they're optional but improve test stability.
