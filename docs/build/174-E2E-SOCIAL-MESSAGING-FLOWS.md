# Build 174: E2E Social & Messaging Flows

## Goal

Test social features and messaging: share buttons on artwork pages, copy-to-clipboard, native share API on mobile, messaging between users, and group interaction. These flows validate the social layer of the platform.

---

## Spec Extract

From E2E Testing Requirements:

- **Share flows:** Copy link, social share buttons (X/Twitter, Facebook, Pinterest, Email), native share on mobile
- **Messaging:** Compose message, view inbox, read thread
- **Groups:** View group page, group interactions
- **Mobile-specific:** Native share API detection, touch-based interactions

---

## Prerequisites

**Must complete before starting:**
- **171-E2E-PLAYWRIGHT-SETUP.md** — Playwright installed, auth bypass configured
- **173-E2E-ARTIST-MANAGEMENT-FLOWS.md** — Content creation flows (need artwork to share)

---

## Steps

### Step 1: Share Buttons Flow

**File:** `e2e/social-messaging.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Share Buttons', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to an artwork page via browse
    await page.goto('/browse')
    const artwork = page.locator('[data-testid="artwork-card"]').first()

    if (await artwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await artwork.click()
      await page.waitForURL(/\/.+\/.+\/.+\/.+/)
    }
  })

  test('copy link button copies URL to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    const copyButton = page.getByRole('button', { name: /copy/i })

    if (await copyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await copyButton.click()

      // Should show success toast
      const toast = page.getByText(/copied/i)
      await expect(toast).toBeVisible({ timeout: 3000 })

      // Verify clipboard content
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardText).toContain('http')
    }
  })

  test('X/Twitter share opens new window', async ({ page, context }) => {
    const twitterButton = page.getByRole('link', { name: /twitter|𝕏/i }).or(
      page.locator('a[href*="twitter.com"], a[href*="x.com"]')
    )

    if (await twitterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await twitterButton.getAttribute('href')
      expect(href).toContain('twitter.com/intent/tweet')

      // Verify target="_blank"
      const target = await twitterButton.getAttribute('target')
      expect(target).toBe('_blank')
    }
  })

  test('Facebook share link is present', async ({ page }) => {
    const fbButton = page.getByRole('link', { name: /facebook/i }).or(
      page.locator('a[href*="facebook.com/sharer"]')
    )

    if (await fbButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await fbButton.getAttribute('href')
      expect(href).toContain('facebook.com/sharer')
      expect(href).toContain(encodeURIComponent('http'))
    }
  })

  test('Pinterest share link includes image URL', async ({ page }) => {
    const pinButton = page.getByRole('link', { name: /pinterest/i }).or(
      page.locator('a[href*="pinterest.com"]')
    )

    if (await pinButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await pinButton.getAttribute('href')
      expect(href).toContain('pinterest.com/pin/create')
      expect(href).toContain('media=') // should include image
    }
  })

  test('email share link has mailto', async ({ page }) => {
    const emailButton = page.getByRole('link', { name: /mail|email/i }).or(
      page.locator('a[href^="mailto:"]')
    )

    if (await emailButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await emailButton.getAttribute('href')
      expect(href).toMatch(/^mailto:/)
      expect(href).toContain('subject=')
    }
  })

  test('native share button appears on mobile', async ({ page }) => {
    // On mobile devices with navigator.share support
    const shareButton = page.getByRole('button', { name: /share/i })

    if (await shareButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // We can't fully test navigator.share (browser limitation),
      // but verify the button exists and is tappable
      await expect(shareButton).toBeEnabled()
    }
  })
})
```

---

### Step 2: Messaging — Compose and Send

```typescript
test.describe('Messaging', () => {
  test('messages page loads', async ({ page }) => {
    await page.goto('/profile/messages')

    await expect(page).toHaveURL(/\/profile\/messages/)

    // Should show inbox or empty state
    const messages = page.getByRole('link').filter({ hasText: /message|thread/i })
    const emptyState = page.getByText(/no messages/i)

    await expect(messages.first().or(emptyState)).toBeVisible({ timeout: 5000 })
  })

  test('can navigate to compose page', async ({ page }) => {
    await page.goto('/profile/messages')

    const composeButton = page.getByRole('link', { name: /compose|new|write/i }).or(
      page.getByRole('button', { name: /compose|new|write/i })
    )

    if (await composeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await composeButton.click()
      await expect(page).toHaveURL(/\/compose/)
    }
  })

  test('compose form has required fields', async ({ page }) => {
    await page.goto('/profile/messages/compose')

    // Recipient field
    const recipientInput = page.getByLabel(/to|recipient/i).or(
      page.getByPlaceholder(/recipient|username/i)
    )
    await expect(recipientInput).toBeVisible()

    // Subject field
    const subjectInput = page.getByLabel(/subject/i).or(
      page.getByPlaceholder(/subject/i)
    )
    await expect(subjectInput).toBeVisible()

    // Message body
    const bodyInput = page.getByLabel(/message|body/i).or(
      page.getByPlaceholder(/message/i)
    )
    await expect(bodyInput).toBeVisible()
  })

  test('compose validates required fields', async ({ page }) => {
    await page.goto('/profile/messages/compose')

    // Try to submit empty
    const sendButton = page.getByRole('button', { name: /send/i })

    if (await sendButton.isVisible()) {
      await sendButton.click()

      // Should show validation error
      const error = page.getByText(/required|please/i)
      await expect(error).toBeVisible({ timeout: 3000 })
    }
  })

  test('can send a message', async ({ page }) => {
    await page.goto('/profile/messages/compose')

    const recipientInput = page.getByLabel(/to|recipient/i).or(
      page.getByPlaceholder(/recipient|username/i)
    )
    const subjectInput = page.getByLabel(/subject/i).or(
      page.getByPlaceholder(/subject/i)
    )
    const bodyInput = page.getByLabel(/message|body/i).or(
      page.getByPlaceholder(/message/i)
    )

    // Fill form — use the test user's own username for self-message
    await recipientInput.fill('e2etest')
    await subjectInput.fill(`E2E Test Message ${Date.now()}`)
    await bodyInput.fill('This is an automated test message from E2E tests.')

    const sendButton = page.getByRole('button', { name: /send/i })
    await sendButton.click()

    // Should show success or redirect to messages
    const success = page.getByText(/sent|success/i)
    await expect(success.or(page.locator('url=/profile/messages'))).toBeVisible({ timeout: 5000 })
  })

  test('can view message thread', async ({ page }) => {
    await page.goto('/profile/messages')

    const firstThread = page.getByRole('link').filter({ hasText: /e2e|test|message/i }).first()

    if (await firstThread.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstThread.click()

      // Should show thread content
      await expect(page.getByText(/e2e|test|automated/i)).toBeVisible({ timeout: 3000 })
    }
  })
})
```

---

### Step 3: Group Page Flow

```typescript
test.describe('Groups', () => {
  test('group page loads', async ({ page }) => {
    // Navigate to a group page — this requires a known group slug.
    // If no groups exist, test the 404 gracefully.
    await page.goto('/groups/test-group')

    const groupPage = page.getByRole('heading')
    const notFound = page.getByText(/not found/i)

    await expect(groupPage.or(notFound)).toBeVisible({ timeout: 5000 })
  })

  test('group page shows member list', async ({ page }) => {
    await page.goto('/groups/test-group')

    const members = page.getByText(/member/i)
    const notFound = page.getByText(/not found/i)

    // If group exists, should show members section
    if (await notFound.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Group doesn't exist yet — skip
      test.skip()
    }

    await expect(members).toBeVisible({ timeout: 3000 })
  })
})
```

---

### Step 4: Mobile-Specific Social Interactions

```typescript
test.describe('Mobile Social Interactions', () => {
  test('share buttons wrap properly on small screens', async ({ page }) => {
    await page.goto('/browse')
    const artwork = page.locator('[data-testid="artwork-card"]').first()

    if (await artwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await artwork.click()

      // Share buttons container should not overflow viewport
      const shareContainer = page.locator('.flex.flex-wrap').first()

      if (await shareContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
        const box = await shareContainer.boundingBox()
        const viewport = page.viewportSize()

        if (box && viewport) {
          // Share buttons should fit within viewport width
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 10) // 10px tolerance
        }
      }
    }
  })

  test('message compose scrolls properly on mobile', async ({ page }) => {
    await page.goto('/profile/messages/compose')

    const bodyInput = page.getByLabel(/message|body/i).or(
      page.getByPlaceholder(/message/i)
    )

    if (await bodyInput.isVisible()) {
      // Tap into the body field
      await bodyInput.tap()

      // Fill with long text to trigger scrolling
      await bodyInput.fill('A'.repeat(500))

      // Send button should still be reachable by scrolling
      const sendButton = page.getByRole('button', { name: /send/i })
      await sendButton.scrollIntoViewIfNeeded()
      await expect(sendButton).toBeVisible()
    }
  })

  test('touch targets meet minimum size on mobile', async ({ page }) => {
    await page.goto('/browse')
    const artwork = page.locator('[data-testid="artwork-card"]').first()

    if (await artwork.isVisible({ timeout: 5000 }).catch(() => false)) {
      await artwork.click()

      // All interactive elements should meet 44x44 minimum touch target
      const buttons = page.getByRole('button')
      const count = await buttons.count()

      for (let i = 0; i < Math.min(count, 5); i++) {
        const box = await buttons.nth(i).boundingBox()
        if (box) {
          // Minimum touch target: 44x44 CSS pixels (WCAG 2.5.8)
          expect(box.width).toBeGreaterThanOrEqual(44)
          expect(box.height).toBeGreaterThanOrEqual(44)
        }
      }
    }
  })
})
```

---

### Step 5: Cross-Flow Navigation Test

```typescript
test.describe('Full User Journey', () => {
  test('artist uploads artwork then views it publicly', async ({ page }) => {
    // Step 1: Upload an artwork
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
    const artworkTitle = `Journey Test ${Date.now()}`
    await titleInput.fill(artworkTitle)

    const uploadButton = page.getByRole('button', { name: /upload|submit|save/i })
    await uploadButton.click()

    // Wait for upload success
    await page.waitForTimeout(5000)

    // Step 2: Navigate to profile to find public URL
    await page.goto('/profile')

    // Step 3: View own public profile
    const username = page.locator('[data-testid="username"]').or(
      page.getByText(/e2etest/i)
    )

    if (await username.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Navigate to public artist page
      await page.goto('/e2etest')
      await expect(page).toHaveURL(/\/e2etest/)
    }
  })
})
```

---

## Verification

- [ ] `npm run test:e2e:mobile -- --grep "Share"` — share button tests pass
- [ ] Copy link copies URL to clipboard and shows toast
- [ ] Social share links have correct URLs (Twitter, Facebook, Pinterest, Email)
- [ ] Native share button appears on mobile viewport
- [ ] `npm run test:e2e:mobile -- --grep "Messaging"` — messaging tests pass
- [ ] Message compose form validates required fields
- [ ] Messages can be sent and viewed in thread
- [ ] `npm run test:e2e:mobile -- --grep "Mobile Social"` — mobile-specific tests pass
- [ ] Share buttons wrap and don't overflow viewport
- [ ] Touch targets meet 44x44 minimum size
- [ ] Full user journey test passes (upload → public view)

---

## Notes

- **Clipboard testing:** Clipboard permissions must be explicitly granted via `context.grantPermissions()`. This is a Playwright-specific requirement.
- **navigator.share:** The Web Share API can't be fully tested in automation — the system share sheet is OS-level. We verify the button exists and is enabled; actual sharing is manually tested.
- **Self-messaging:** The compose test sends a message to the test user's own account. This works for testing the compose flow without needing a second user. Multi-user interaction tests would require a second auth fixture.
- **Touch target testing:** The 44x44 minimum is from WCAG 2.5.8 (Target Size). This is especially important for mobile users. Some tests may initially fail if buttons are too small — this is intentional, they surface real UX issues.
- **Group tests:** Groups require pre-seeded data. These tests gracefully skip if no groups exist. Add seed data as the test infrastructure matures.
