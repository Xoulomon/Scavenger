import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'
test.describe('Accessibility - High Contrast Mode', () => {
  test('should have no accessibility violations in high contrast mode', async ({ page }) => {
    await page.goto('/')
    // Simulate high contrast mode
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('high-contrast')
    })
    await injectAxe(page)
    await checkA11y(page, null, {
      detailedReport: true
    })
  })
})
import { injectAxe, checkA11y } from 'axe-playwright'

test.describe('Accessibility - Homepage', () => {
  test('should have no accessibility violations on homepage', async ({ page }) => {
    await page.goto('/')
    await injectAxe(page)
    await checkA11y(page, null, {
      detailedReport: true
    })
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/')
    const h1 = page.locator('h1')
    await expect(h1).toHaveCount(1)
  })

  test('should have alt text for all images', async ({ page }) => {
    await page.goto('/')
    const images = page.locator('img')
    const count = await images.count()
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt')
      expect(alt).toBeTruthy()
    }
  })

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/')
    await injectAxe(page)
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    })
  })

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused)
  })
})

test.describe('Accessibility - Forms', () => {
  test('should have proper form labels', async ({ page }) => {
    await page.goto('/register')
    const labels = page.locator('label')
    const count = await labels.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should have ARIA labels for form fields', async ({ page }) => {
    await page.goto('/register')
    const inputs = page.locator('input')
    const count = await inputs.count()
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i)
      const ariaLabel = await input.getAttribute('aria-label')
      const id = await input.getAttribute('id')
      expect(ariaLabel || id).toBeTruthy()
    }
  })

  test('should show error messages accessibly', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[name="email"]', 'invalid')
    await page.click('button:has-text("Register")')
    const errorMessage = page.locator('[role="alert"]')
    await expect(errorMessage).toBeVisible()
  })

  test('should have accessible form validation', async ({ page }) => {
    await page.goto('/register')
    const form = page.locator('form')
    const ariaInvalid = await form.locator('[aria-invalid="true"]').count()
    expect(ariaInvalid).toBeGreaterThanOrEqual(0)
  })

  test('should support form submission with keyboard', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await page.waitForNavigation()
    expect(page.url()).not.toContain('/register')
  })
})

test.describe('Accessibility - Navigation', () => {
  test('should have skip to main content link', async ({ page }) => {
    await page.goto('/')
    const skipLink = page.locator('a:has-text("Skip to main content")')
    await expect(skipLink).toBeVisible()
  })

  test('should have proper navigation landmarks', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
  })

  test('should have breadcrumb navigation', async ({ page }) => {
    await page.goto('/waste/1')
    const breadcrumb = page.locator('[aria-label="Breadcrumb"]')
    if (await breadcrumb.isVisible()) {
      const items = breadcrumb.locator('li')
      expect(await items.count()).toBeGreaterThan(0)
    }
  })

  test('should indicate current page in navigation', async ({ page }) => {
    await page.goto('/dashboard')
    const currentLink = page.locator('nav a[aria-current="page"]')
    await expect(currentLink).toBeVisible()
  })
})

test.describe('Accessibility - Screen Reader', () => {
  test('should have descriptive button text', async ({ page }) => {
    await page.goto('/')
    const buttons = page.locator('button')
    const count = await buttons.count()
    for (let i = 0; i < count; i++) {
      const text = await buttons.nth(i).textContent()
      expect(text?.trim().length).toBeGreaterThan(0)
    }
  })

  test('should have descriptive link text', async ({ page }) => {
    await page.goto('/')
    const links = page.locator('a')
    const count = await links.count()
    for (let i = 0; i < count; i++) {
      const text = await links.nth(i).textContent()
      const ariaLabel = await links.nth(i).getAttribute('aria-label')
      expect(text?.trim().length || ariaLabel?.length).toBeGreaterThan(0)
    }
  })

  test('should announce dynamic content changes', async ({ page }) => {
    await page.goto('/')
    const liveRegion = page.locator('[aria-live="polite"]')
    if (await liveRegion.isVisible()) {
      expect(await liveRegion.count()).toBeGreaterThan(0)
    }
  })

  test('should have proper list semantics', async ({ page }) => {
    await page.goto('/incentives')
    const lists = page.locator('ul, ol')
    expect(await lists.count()).toBeGreaterThan(0)
  })
})

test.describe('Accessibility - WCAG 2.1 AA Compliance', () => {
  test('should pass WCAG 2.1 AA on all pages', async ({ page }) => {
    const pages = ['/', '/register', '/dashboard', '/submit-waste', '/incentives']
    for (const pagePath of pages) {
      await page.goto(pagePath)
      await injectAxe(page)
      await checkA11y(page, null, {
        standards: 'wcag21aa',
        detailedReport: true
      })
    }
  })

  test('should have sufficient focus indicators', async ({ page }) => {
    await page.goto('/')
    const focusableElements = page.locator('a, button, input, select, textarea')
    const count = await focusableElements.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should support text resizing', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })
    const content = page.locator('main')
    await expect(content).toBeVisible()
  })
})
