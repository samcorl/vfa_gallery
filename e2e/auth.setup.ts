import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth', 'user.json')

setup('authenticate as test user', async ({ request }) => {
  // Call test-only login endpoint to get auth cookie
  const response = await request.post('/api/auth/test-login', {
    data: {
      email: 'e2e-test@vfa.gallery',
      role: 'user',
    },
  })

  expect(response.ok()).toBeTruthy()

  const body = await response.json()
  expect(body.success).toBe(true)

  // Save authenticated state (cookies) for reuse across tests
  await request.storageState({ path: authFile })
})
