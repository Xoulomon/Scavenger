import { test, expect } from '@playwright/test'

test.describe('User Registration Flow', () => {
  test('should display registration form', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('text=Register')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
  })

  test('should register new user successfully', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!')
    await page.click('button:has-text("Register")')
    await expect(page).toHaveURL(/\/(dashboard|home)/)
  })

  test('should show error for invalid email', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[name="email"]', 'invalid-email')
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.click('button:has-text("Register")')
    await expect(page.locator('text=Invalid email')).toBeVisible()
  })

  test('should show error for weak password', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'weak')
    await page.click('button:has-text("Register")')
    await expect(page.locator('text=Password must be at least')).toBeVisible()
  })

  test('should show error for mismatched passwords', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!')
    await page.click('button:has-text("Register")')
    await expect(page.locator('text=Passwords do not match')).toBeVisible()
  })
})
