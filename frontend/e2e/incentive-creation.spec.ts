import { test, expect } from '@playwright/test'

test.describe('Incentive Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'test_token')
      localStorage.setItem('user_role', 'manufacturer')
    })
  })

  test('should display incentive creation form', async ({ page }) => {
    await page.goto('/create-incentive')
    await expect(page.locator('text=Create Incentive')).toBeVisible()
    await expect(page.locator('select[name="wasteType"]')).toBeVisible()
    await expect(page.locator('input[name="rewardPoints"]')).toBeVisible()
    await expect(page.locator('input[name="budget"]')).toBeVisible()
  })

  test('should create incentive successfully', async ({ page }) => {
    await page.goto('/create-incentive')
    await page.selectOption('select[name="wasteType"]', 'plastic')
    await page.fill('input[name="rewardPoints"]', '100')
    await page.fill('input[name="budget"]', '1000')
    await page.click('button:has-text("Create")')
    await expect(page.locator('text=Incentive created successfully')).toBeVisible()
  })

  test('should validate reward points', async ({ page }) => {
    await page.goto('/create-incentive')
    await page.selectOption('select[name="wasteType"]', 'plastic')
    await page.fill('input[name="rewardPoints"]', '0')
    await page.click('button:has-text("Create")')
    await expect(page.locator('text=Reward points must be greater than 0')).toBeVisible()
  })

  test('should validate budget', async ({ page }) => {
    await page.goto('/create-incentive')
    await page.selectOption('select[name="wasteType"]', 'plastic')
    await page.fill('input[name="rewardPoints"]', '100')
    await page.fill('input[name="budget"]', '0')
    await page.click('button:has-text("Create")')
    await expect(page.locator('text=Budget must be greater than 0')).toBeVisible()
  })

  test('should list active incentives', async ({ page }) => {
    await page.goto('/incentives')
    await expect(page.locator('text=Active Incentives')).toBeVisible()
    await expect(page.locator('table')).toBeVisible()
  })

  test('should update incentive', async ({ page }) => {
    await page.goto('/incentives')
    await page.click('button:has-text("Edit").first()')
    await page.fill('input[name="rewardPoints"]', '150')
    await page.click('button:has-text("Update")')
    await expect(page.locator('text=Incentive updated successfully')).toBeVisible()
  })

  test('should deactivate incentive', async ({ page }) => {
    await page.goto('/incentives')
    await page.click('button:has-text("Deactivate").first()')
    await page.click('button:has-text("Confirm")')
    await expect(page.locator('text=Incentive deactivated successfully')).toBeVisible()
  })
})
