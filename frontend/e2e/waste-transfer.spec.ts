import { test, expect } from '@playwright/test'

test.describe('Waste Transfer Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'test_token')
      localStorage.setItem('user_role', 'collector')
    })
  })

  test('should display waste transfer form', async ({ page }) => {
    await page.goto('/transfer-waste')
    await expect(page.locator('text=Transfer Waste')).toBeVisible()
    await expect(page.locator('input[name="wasteId"]')).toBeVisible()
    await expect(page.locator('input[name="recipientAddress"]')).toBeVisible()
  })

  test('should transfer waste successfully', async ({ page }) => {
    await page.goto('/transfer-waste')
    await page.fill('input[name="wasteId"]', '1')
    await page.fill(
      'input[name="recipientAddress"]',
      'GBRPYHIL2CI3WHZDTOOQFC6EB4RRJC3XVCDTUJ76ZAV2HA72KYHN4A6'
    )
    await page.fill('input[name="latitude"]', '40.7128')
    await page.fill('input[name="longitude"]', '-74.0060')
    await page.click('button:has-text("Transfer")')
    await expect(page.locator('text=Waste transferred successfully')).toBeVisible()
  })

  test('should validate waste ID', async ({ page }) => {
    await page.goto('/transfer-waste')
    await page.fill('input[name="wasteId"]', 'invalid')
    await page.click('button:has-text("Transfer")')
    await expect(page.locator('text=Invalid waste ID')).toBeVisible()
  })

  test('should validate recipient address', async ({ page }) => {
    await page.goto('/transfer-waste')
    await page.fill('input[name="wasteId"]', '1')
    await page.fill('input[name="recipientAddress"]', 'invalid-address')
    await page.click('button:has-text("Transfer")')
    await expect(page.locator('text=Invalid recipient address')).toBeVisible()
  })

  test('should show transfer history', async ({ page }) => {
    await page.goto('/waste/1/history')
    await expect(page.locator('text=Transfer History')).toBeVisible()
    await expect(page.locator('table')).toBeVisible()
  })

  test('should display transfer details', async ({ page }) => {
    await page.goto('/waste/1/history')
    const firstRow = page.locator('table tbody tr').first()
    await expect(firstRow.locator('td')).toHaveCount(4)
  })
})
