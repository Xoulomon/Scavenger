import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/')
    // Mock authentication if needed
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'test_token')
    })
    await use(page)
  }
})

export { expect }
