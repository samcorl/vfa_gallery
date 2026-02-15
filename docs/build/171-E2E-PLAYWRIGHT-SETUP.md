# Build 171: E2E Playwright Setup

## Goal

Install and configure Playwright for end-to-end testing with mobile-first device emulation, Google OAuth authentication bypass, and Playwright MCP server integration for interactive agent-controlled browser sessions.

---

## Spec Extract

From E2E Testing Requirements:

- **Framework:** Playwright (latest)
- **Primary Target:** Mobile devices (iPhone, Pixel) — this app is primarily used on mobile
- **Auth Strategy:** Test-only login endpoint + storageState reuse
- **Agent Integration:** Playwright MCP server for Claude Code agent-controlled browser
- **Browser Engines:** WebKit (Safari/iOS), Chromium (Android/Desktop)

---

## Prerequisites

**Must complete before starting:**
- All public pages implemented (Phases 14-17)
- Auth system working (Phase 4-5)
- Protected routes working (Phase 6+)

---

## Steps

### Step 1: Install Playwright

**Run:**

```bash
npm init playwright@latest
```

Select these options:
- TypeScript
- Tests directory: `e2e/`
- GitHub Actions workflow: No (we'll add later if needed)
- Install browsers: Yes

This installs `@playwright/test` and creates initial config.

---

### Step 2: Configure playwright.config.ts

Mobile-first configuration with auth bypass setup.

**File:** `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // === Auth Setup (runs once before all test projects) ===
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // === Mobile-First Projects (primary) ===
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 15'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'pixel',
      use: {
        ...devices['Pixel 7'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // === Desktop (secondary) ===
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // === Unauthenticated tests (no auth dependency) ===
    {
      name: 'iphone-anon',
      testMatch: /.*\.anon\.spec\.ts/,
      use: {
        ...devices['iPhone 15'],
      },
    },
    {
      name: 'pixel-anon',
      testMatch: /.*\.anon\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],

  // Start dev server before tests
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
```

**Key decisions:**
- **iPhone 15 + Pixel 7** as primary mobile targets (most common current devices)
- **Desktop Chrome** as secondary for responsive checks
- **Separate anon projects** for unauthenticated flows (no setup dependency = faster)
- **storageState** reuses auth session across all authenticated tests
- **webServer** auto-starts Vite dev server

---

### Step 3: Create Directory Structure

```
e2e/
├── .auth/                  # Auth state files (gitignored)
│   └── user.json
├── fixtures/               # Custom test fixtures
│   └── auth.ts
├── auth.setup.ts           # One-time auth setup
├── public-browsing.anon.spec.ts
├── artwork-viewing.anon.spec.ts
├── artist-management.spec.ts
├── gallery-management.spec.ts
├── social-messaging.spec.ts
└── specs/                  # Playwright Agent test plans (markdown)
    └── README.md
```

Add to `.gitignore`:

```
# Playwright
e2e/.auth/
e2e/test-results/
e2e/playwright-report/
e2e/blob-report/
```

---

### Step 4: Auth Bypass — Test Login Endpoint

Since the app uses Google OAuth (server-side redirect flow), we cannot intercept the OAuth exchange with `page.route()` — that only intercepts client-side requests. The best practice for this setup is a **test-only login endpoint** that issues a real JWT, enabled only in development.

**File:** `src/lib/api/routes/auth.ts`

Add a test login endpoint **after** the existing auth routes:

```typescript
// Test-only login endpoint — bypasses Google OAuth for E2E testing
// Only available when ENVIRONMENT !== 'production'
if (process.env.ENVIRONMENT !== 'production') {
  auth.post('/test-login', async (c) => {
    const { email, role } = await c.req.json<{ email: string; role?: string }>()

    if (!email) {
      return c.json({ error: 'Email required' }, 400)
    }

    // Find or create test user
    const db = c.env.DB
    let user = await db.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first()

    if (!user) {
      const id = crypto.randomUUID()
      const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
      const now = new Date().toISOString()

      await db.prepare(`
        INSERT INTO users (id, email, username, display_name, role, status, created_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
      `).bind(id, email, username, `Test ${username}`, role || 'user', now, now).run()

      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
    }

    // Generate JWT (same as real auth callback)
    const token = await generateAccessToken({
      userId: user.id as string,
      email: user.email as string,
      role: (role || user.role || 'user') as string,
    }, c.env.JWT_SECRET)

    // Set auth cookie (same as real auth callback)
    setCookie(c, 'auth_token', token, getAuthCookieOptions(c.env.ENVIRONMENT))

    return c.json({ success: true, user })
  })
}
```

**Why this approach:**
- Uses real JWT generation and cookie setting — tests exercise the actual auth middleware
- Creates real users in D1 — tests exercise real database queries
- Guard `ENVIRONMENT !== 'production'` ensures this never ships to prod
- Same cookie options as real auth — storageState capture works identically

**Note on Cloudflare/Hono environment:** In the Hono handlers, environment variables come from `c.env`. The guard should match however the ENVIRONMENT variable is accessed in the existing codebase. If using Vite's dev server proxy, the functions run with wrangler which provides `c.env.ENVIRONMENT`.

---

### Step 5: Auth Setup Test

**File:** `e2e/auth.setup.ts`

```typescript
import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth', 'user.json')

setup('authenticate as test user', async ({ request }) => {
  // Call the test-only login endpoint to get an auth cookie
  const response = await request.post('/api/auth/test-login', {
    data: {
      email: 'e2e-test@vfa.gallery',
      role: 'user',
    },
  })

  expect(response.ok()).toBeTruthy()

  // Save the authenticated state (cookies) for reuse
  await request.storageState({ path: authFile })
})
```

**How it works:**
1. The setup project runs once before all test projects
2. Calls `POST /api/auth/test-login` which sets the `auth_token` cookie
3. Saves cookie state to `e2e/.auth/user.json`
4. All test projects load this state via `storageState` config — every test starts authenticated

---

### Step 6: Admin Auth Fixture

For tests that need admin access, create a fixture.

**File:** `e2e/fixtures/auth.ts`

```typescript
import { test as base, expect } from '@playwright/test'

// Fixture that provides an admin-authenticated page
export const test = base.extend<{ adminPage: typeof base }>({
  // Override the default page with admin auth when needed
})

// Helper to login as admin via API
export async function loginAsAdmin(request: any) {
  const response = await request.post('/api/auth/test-login', {
    data: {
      email: 'e2e-admin@vfa.gallery',
      role: 'admin',
    },
  })
  expect(response.ok()).toBeTruthy()
}

// Helper to login as specific user
export async function loginAsUser(request: any, email: string) {
  const response = await request.post('/api/auth/test-login', {
    data: { email, role: 'user' },
  })
  expect(response.ok()).toBeTruthy()
}
```

---

### Step 7: Playwright MCP Server — Interactive Agent Sessions

This is the key integration for agent-controlled browser sessions where Claude Code drives the browser while you watch and give feedback.

**Install the Playwright MCP server:**

```bash
npm install -D @playwright/mcp
```

**Configure in `.claude/settings.json` (project-level):**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--viewport-size=390,844"]
    }
  }
}
```

**Key flags:**
- `--viewport-size=390,844` — iPhone 15 viewport by default (mobile-first)
- The MCP server opens a visible browser window that you can watch in real-time
- Claude Code gets 25+ tools for browser control: navigate, click, fill, screenshot, etc.
- Uses the accessibility tree (not screenshots) for fast, deterministic element targeting

**How the interactive workflow works:**

1. Start a Claude Code session
2. Ask Claude to "open the browser to localhost:5173"
3. Claude uses Playwright MCP tools to navigate, interact, and verify
4. You watch the browser window and give real-time feedback
5. Claude can run existing Playwright tests OR explore the app ad-hoc
6. Claude reads the accessibility tree to understand page structure

**Example agent interaction:**
```
You: "Log in as a test user and create a new gallery called 'My Landscapes'"
Claude: [uses playwright_navigate to go to localhost:5173]
        [uses playwright_click to trigger test-login]
        [uses playwright_navigate to /profile/galleries/new]
        [uses playwright_fill to enter gallery name]
        [uses playwright_click to submit]
        [uses playwright_snapshot to verify the gallery was created]
```

---

### Step 8: Package.json Scripts

Add test scripts.

**File:** `package.json` (scripts section)

```json
{
  "scripts": {
    "test:e2e": "npx playwright test",
    "test:e2e:mobile": "npx playwright test --project=iphone --project=pixel",
    "test:e2e:desktop": "npx playwright test --project=desktop-chrome",
    "test:e2e:anon": "npx playwright test --project=iphone-anon --project=pixel-anon",
    "test:e2e:ui": "npx playwright test --ui",
    "test:e2e:headed": "npx playwright test --headed",
    "test:e2e:debug": "npx playwright test --debug"
  }
}
```

**Script purposes:**
- `test:e2e` — Run all tests across all projects
- `test:e2e:mobile` — Run only mobile device tests (most common)
- `test:e2e:desktop` — Run only desktop tests
- `test:e2e:anon` — Run only unauthenticated flow tests
- `test:e2e:ui` — Open Playwright's visual test runner UI
- `test:e2e:headed` — Run tests in visible browser (for debugging)
- `test:e2e:debug` — Step-through debugger mode

---

### Step 9: Playwright Agent Initialization (Optional)

If using Playwright's built-in test agents (Planner/Generator/Healer — available since Playwright 1.56):

```bash
npx playwright init-agents --loop=vscode
```

This creates agent definitions that can:
- **Planner:** Explore the app and generate markdown test plans in `e2e/specs/`
- **Generator:** Convert markdown plans into executable test code
- **Healer:** Auto-fix broken tests when UI changes

These agents complement the Playwright MCP workflow — MCP is for interactive ad-hoc exploration, while the built-in agents are for systematic test generation.

---

## Verification

- [ ] `npx playwright --version` returns installed version
- [ ] `npm run test:e2e` starts dev server and runs (even if no tests yet)
- [ ] `e2e/.auth/` directory is gitignored
- [ ] `POST /api/auth/test-login` returns 200 with JWT cookie in development
- [ ] `POST /api/auth/test-login` is NOT available when `ENVIRONMENT=production`
- [ ] Playwright MCP server connects in Claude Code session
- [ ] MCP browser opens with mobile viewport (390x844)
- [ ] `npx playwright test --ui` opens the visual test runner

---

## Notes

- **Mobile-first:** All test projects default to mobile viewports. Desktop is secondary.
- **Auth bypass is dev-only:** The test-login endpoint is guarded by environment check. It will never exist in production builds.
- **storageState reuse:** Auth happens once per test run, not once per test. This makes the test suite fast.
- **Accessibility tree:** The Playwright MCP server uses the accessibility tree for element targeting, which is more stable than CSS selectors and naturally validates a11y.
- **No test data seeding yet:** Tests create their own data via the UI or API calls. A seed script can be added later if needed.
