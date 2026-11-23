import { test, expect } from '@playwright/test'

test.describe('Admin Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'test_token')
      localStorage.setItem('user_role', 'admin')
    })
  })

  test('should display admin dashboard', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.locator('text=Admin Dashboard')).toBeVisible()
    await expect(page.locator('text=Participants')).toBeVisible()
    await expect(page.locator('text=Waste Management')).toBeVisible()
  })

  test('should manage participants', async ({ page }) => {
    await page.goto('/admin/participants')
    await expect(page.locator('text=Participants')).toBeVisible()
    await expect(page.locator('table')).toBeVisible()
  })

  test('should deactivate waste', async ({ page }) => {
    await page.goto('/admin/waste')
    await page.click('button:has-text("Deactivate").first()')
    await page.click('button:has-text("Confirm")')
    await expect(page.locator('text=Waste deactivated successfully')).toBeVisible()
  })

  test('should set token address', async ({ page }) => {
    await page.goto('/admin/settings')
    await page.fill(
      'input[name="tokenAddress"]',
      'GBRPYHIL2CI3WHZDTOOQFC6EB4RRJC3XVCDTUJ76ZAV2HA72KYHN4A6'
    )
    await page.click('button:has-text("Save")')
    await expect(page.locator('text=Token address updated successfully')).toBeVisible()
  })

  test('should set charity contract', async ({ page }) => {
    await page.goto('/admin/settings')
    await page.fill(
      'input[name="charityAddress"]',
      'GBRPYHIL2CI3WHZDTOOQFC6EB4RRJC3XVCDTUJ76ZAV2HA72KYHN4A6'
    )
    await page.click('button:has-text("Save")')
    await expect(page.locator('text=Charity address updated successfully')).toBeVisible()
  })

  test('should set reward percentages', async ({ page }) => {
    await page.goto('/admin/settings')
    await page.fill('input[name="collectorPercentage"]', '30')
    await page.fill('input[name="ownerPercentage"]', '70')
    await page.click('button:has-text("Save")')
    await expect(page.locator('text=Percentages updated successfully')).toBeVisible()
  })

  test('should validate percentage sum', async ({ page }) => {
    await page.goto('/admin/settings')
    await page.fill('input[name="collectorPercentage"]', '60')
    await page.fill('input[name="ownerPercentage"]', '60')
    await page.click('button:has-text("Save")')
    await expect(page.locator('text=Percentages must sum to 100')).toBeVisible()
  })
})
