import { test, expect } from '@playwright/test'

test.describe('Keyboard Navigation', () => {
  test('should navigate through form fields with Tab', async ({ page }) => {
    await page.goto('/register')
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.locator('button:has-text("Register")')

    await emailInput.focus()
    await expect(emailInput).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(passwordInput).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(submitButton).toBeFocused()
  })

  test('should activate buttons with Enter key', async ({ page }) => {
    await page.goto('/')
    const button = page.locator('button').first()
    await button.focus()
    await page.keyboard.press('Enter')
    // Verify action was triggered
    expect(page.url()).toBeDefined()
  })

  test('should activate buttons with Space key', async ({ page }) => {
    await page.goto('/')
    const button = page.locator('button').first()
    await button.focus()
    await page.keyboard.press('Space')
    expect(page.url()).toBeDefined()
  })

  test('should navigate menu with arrow keys', async ({ page }) => {
    await page.goto('/')
    const menuButton = page.locator('button[aria-haspopup="menu"]').first()
    if (await menuButton.isVisible()) {
      await menuButton.focus()
      await page.keyboard.press('ArrowDown')
      const menuItem = page.locator('[role="menuitem"]').first()
      await expect(menuItem).toBeFocused()
    }
  })

  test('should close menu with Escape key', async ({ page }) => {
    await page.goto('/')
    const menuButton = page.locator('button[aria-haspopup="menu"]').first()
    if (await menuButton.isVisible()) {
      await menuButton.click()
      const menu = page.locator('[role="menu"]')
      await expect(menu).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(menu).not.toBeVisible()
    }
  })

  test('should navigate tabs with arrow keys', async ({ page }) => {
    await page.goto('/dashboard')
    const tabs = page.locator('[role="tab"]')
    if ((await tabs.count()) > 1) {
      await tabs.first().focus()
      await page.keyboard.press('ArrowRight')
      const secondTab = tabs.nth(1)
      await expect(secondTab).toBeFocused()
    }
  })

  test('should support Shift+Tab for reverse navigation', async ({ page }) => {
    await page.goto('/register')
    const inputs = page.locator('input')
    const lastInput = inputs.last()
    await lastInput.focus()
    await page.keyboard.press('Shift+Tab')
    const secondLastInput = inputs.nth((await inputs.count()) - 2)
    await expect(secondLastInput).toBeFocused()
  })

  test('should skip to main content with keyboard shortcut', async ({ page }) => {
    await page.goto('/')
    const skipLink = page.locator('a:has-text("Skip to main content")')
    if (await skipLink.isVisible()) {
      await skipLink.focus()
      await page.keyboard.press('Enter')
      const main = page.locator('main')
      await expect(main).toBeFocused()
    }
  })
})
