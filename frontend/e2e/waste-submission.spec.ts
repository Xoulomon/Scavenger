import { test, expect } from '@playwright/test'

test.describe('Waste Submission Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'test_token')
      localStorage.setItem('user_role', 'recycler')
    })
  })

  test('should display waste submission form', async ({ page }) => {
    await page.goto('/submit-waste')
    await expect(page.locator('text=Submit Waste')).toBeVisible()
    await expect(page.locator('select[name="wasteType"]')).toBeVisible()
    await expect(page.locator('input[name="weight"]')).toBeVisible()
  })

  test('should submit waste successfully', async ({ page }) => {
    await page.goto('/submit-waste')
    await page.selectOption('select[name="wasteType"]', 'plastic')
    await page.fill('input[name="weight"]', '10')
    await page.fill('input[name="latitude"]', '40.7128')
    await page.fill('input[name="longitude"]', '-74.0060')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('text=Waste submitted successfully')).toBeVisible()
  })

  test('should validate waste weight', async ({ page }) => {
    await page.goto('/submit-waste')
    await page.selectOption('select[name="wasteType"]', 'plastic')
    await page.fill('input[name="weight"]', '0')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('text=Weight must be greater than 0')).toBeVisible()
  })

  test('should validate coordinates', async ({ page }) => {
    await page.goto('/submit-waste')
    await page.selectOption('select[name="wasteType"]', 'plastic')
    await page.fill('input[name="weight"]', '10')
    await page.fill('input[name="latitude"]', '91')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('text=Invalid latitude')).toBeVisible()
  })

  test('should support batch waste submission', async ({ page }) => {
    await page.goto('/submit-waste-batch')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'waste.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('wasteType,weight,latitude,longitude\nplastic,10,40.7128,-74.0060')
    })
    await page.click('button:has-text("Upload")')
    await expect(page.locator('text=Batch submitted successfully')).toBeVisible()
  })
})
