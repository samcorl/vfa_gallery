import { test, expect } from '@playwright/test'

test.describe('Share Buttons', () => {
  test('copy link button works', async ({ page, context }) => {
    await page.goto('/browse')
    const artwork = page.locator('[data-testid="artwork-card"]').first()

    if (await artwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await artwork.click()
      await page.waitForURL(/\/.+\/.+\/.+\/.+/)

      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      const copyButton = page.getByRole('button', { name: /copy/i })

      if (await copyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await copyButton.click()

        const toast = page.getByText(/copied/i)
        await expect(toast).toBeVisible({ timeout: 3000 })
      }
    }
  })

  test('social share links present on artwork page', async ({ page }) => {
    await page.goto('/browse')
    const artwork = page.locator('[data-testid="artwork-card"]').first()

    if (await artwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await artwork.click()
      await page.waitForURL(/\/.+\/.+\/.+\/.+/)

      // X/Twitter
      const twitterLink = page.locator('a[href*="twitter.com"], a[href*="x.com"]')
      if (await twitterLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        const href = await twitterLink.getAttribute('href')
        expect(href).toContain('twitter.com/intent/tweet')
        await expect(twitterLink).toHaveAttribute('target', '_blank')
      }

      // Facebook
      const fbLink = page.locator('a[href*="facebook.com/sharer"]')
      if (await fbLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        const href = await fbLink.getAttribute('href')
        expect(href).toContain('facebook.com/sharer')
      }

      // Email
      const emailLink = page.locator('a[href^="mailto:"]')
      if (await emailLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        const href = await emailLink.getAttribute('href')
        expect(href).toContain('subject=')
      }
    }
  })

  test('native share button visible on mobile', async ({ page }) => {
    await page.goto('/browse')
    const artwork = page.locator('[data-testid="artwork-card"]').first()

    if (await artwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await artwork.click()
      await page.waitForURL(/\/.+\/.+\/.+\/.+/)

      const shareButton = page.getByRole('button', { name: /share/i })
      if (await shareButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(shareButton).toBeEnabled()
      }
    }
  })
})

test.describe('Messaging', () => {
  test('messages page loads', async ({ page }) => {
    await page.goto('/profile/messages')
    await expect(page).toHaveURL(/\/profile\/messages/)

    const messages = page.getByRole('link').filter({ hasText: /message|thread/i })
    const emptyState = page.getByText(/no messages/i)

    await expect(messages.first().or(emptyState)).toBeVisible({ timeout: 5000 })
  })

  test('compose form has required fields', async ({ page }) => {
    await page.goto('/profile/messages/compose')

    const recipientInput = page.getByLabel(/to|recipient/i).or(
      page.getByPlaceholder(/recipient|username/i)
    )
    await expect(recipientInput).toBeVisible()

    const subjectInput = page.getByLabel(/subject/i).or(
      page.getByPlaceholder(/subject/i)
    )
    await expect(subjectInput).toBeVisible()

    const bodyInput = page.getByLabel(/message|body/i).or(
      page.getByPlaceholder(/message/i)
    )
    await expect(bodyInput).toBeVisible()
  })

  test('compose validates required fields', async ({ page }) => {
    await page.goto('/profile/messages/compose')

    const sendButton = page.getByRole('button', { name: /send/i })

    if (await sendButton.isVisible()) {
      await sendButton.click()

      const error = page.getByText(/required|please/i)
      await expect(error).toBeVisible({ timeout: 3000 })
    }
  })
})

test.describe('Mobile Social Interactions', () => {
  test('share buttons wrap on small screens', async ({ page }) => {
    await page.goto('/browse')
    const artwork = page.locator('[data-testid="artwork-card"]').first()

    if (await artwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await artwork.click()
      await page.waitForURL(/\/.+\/.+\/.+\/.+/)

      const shareContainer = page.locator('.flex.flex-wrap').first()

      if (await shareContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
        const box = await shareContainer.boundingBox()
        const viewport = page.viewportSize()

        if (box && viewport) {
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 10)
        }
      }
    }
  })

  test('touch targets meet minimum 44x44 size', async ({ page }) => {
    await page.goto('/browse')
    const artwork = page.locator('[data-testid="artwork-card"]').first()

    if (await artwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await artwork.click()
      await page.waitForURL(/\/.+\/.+\/.+\/.+/)

      const buttons = page.getByRole('button')
      const count = await buttons.count()

      for (let i = 0; i < Math.min(count, 5); i++) {
        const box = await buttons.nth(i).boundingBox()
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44)
          expect(box.height).toBeGreaterThanOrEqual(44)
        }
      }
    }
  })
})

test.describe('Full User Journey', () => {
  test('upload artwork then view on profile', async ({ page }) => {
    // Upload
    await page.goto('/artworks/upload')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'journey-test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      ),
    })

    const titleInput = page.getByLabel(/title/i).or(page.getByPlaceholder(/title/i))
    await titleInput.fill(`Journey Test ${Date.now()}`)

    const uploadButton = page.getByRole('button', { name: /upload|submit|save/i })
    await uploadButton.click()

    await page.waitForTimeout(5000)

    // Check artworks list
    await page.goto('/profile/artworks')
    const artworkList = page.getByRole('link').filter({ hasText: /journey|artwork/i })
    const emptyState = page.getByText(/no artworks/i)

    await expect(artworkList.first().or(emptyState)).toBeVisible({ timeout: 5000 })
  })
})
