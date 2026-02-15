import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

/**
 * Login as admin via test-login endpoint
 */
export async function loginAsAdmin(request: APIRequestContext) {
  const response = await request.post('/api/auth/test-login', {
    data: {
      email: 'e2e-admin@vfa.gallery',
      role: 'admin',
    },
  })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

/**
 * Login as a specific user via test-login endpoint
 */
export async function loginAsUser(request: APIRequestContext, email: string) {
  const response = await request.post('/api/auth/test-login', {
    data: {
      email,
      role: 'user',
    },
  })
  expect(response.ok()).toBeTruthy()
  return response.json()
}
