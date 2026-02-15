import { defineConfig, devices } from '@playwright/test'
import path from 'path'

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
    // Auth setup — runs once before authenticated test projects
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Mobile-first projects (primary)
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 15'],
        storageState: path.join(__dirname, 'e2e', '.auth', 'user.json'),
      },
      dependencies: ['setup'],
    },
    {
      name: 'pixel',
      use: {
        ...devices['Pixel 7'],
        storageState: path.join(__dirname, 'e2e', '.auth', 'user.json'),
      },
      dependencies: ['setup'],
    },

    // Desktop (secondary)
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'e2e', '.auth', 'user.json'),
      },
      dependencies: ['setup'],
    },

    // Unauthenticated tests — no auth dependency, faster
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

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
