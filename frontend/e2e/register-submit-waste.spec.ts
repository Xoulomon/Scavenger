//! E2E test: register and submit waste flow — Issue #1748.
//!
//! Tests the complete user journey for registering as a recycler and submitting waste
//! using Playwright with deterministic fixtures and mocks.
//!
//! Test coverage:
//! - Register new user as recycler role
//! - Complete registration form with valid data
//! - Submit waste with deterministic test data
//! - Verify success notifications and state updates
//! - Handle form validation errors
//!
//! Run with: npm run test:e2e -- register-submit-waste.spec.ts

import { test, expect, type Page } from '@playwright/test'
import {
  seedWalletConnection,
  seedApiRoutes,
  fillRegistrationForm,
  fillWasteForm,
  submitForm,
  waitForLoadingComplete,
  assertVisible,
  assertTextContains,
  verifyNotification,
  TEST_WALLET_ADDRESS,
  TEST_CONTRACT_ID,
  defaultParticipant,
  defaultWaste
} from './test-utils'

test.describe('E2E: Register and Submit Waste Flow — Issue #1748', () => {
  test.beforeEach(async ({ context }) => {
    // Seed wallet connection mock before navigation
    const page = await context.newPage()
    await seedWalletConnection(page)
    await page.close()
  })

  // =========================================================================
  // Registration Flow Tests
  // =========================================================================

  test('should register as recycler with valid data', async ({ page, context }) => {
    // Seed API mock routes for registration flow
    await seedApiRoutes(page, {
      participant: { ...defaultParticipant, role: 'Recycler', name: 'Test Recycler User' }
    })

    // Navigate to registration page
    await page.goto('/register')
    await waitForLoadingComplete(page)

    // Verify registration form is visible
    assertVisible(page, 'form[data-testid="registration-form"]')

    // Fill registration form
    await fillRegistrationForm(page, {
      name: 'Test Recycler User',
      email: 'recycler@test.example.com',
      role: 'Recycler',
      latitude: 40.7128,
      longitude: -74.006
    })

    // Submit registration
    await submitForm(page)

    // Verify registration success
    assertTextContains(page, 'text=Registration successful')
    verifyNotification(page, 'success')

    // Verify navigation to dashboard/profile
    await expect(page).toHaveURL(/\/(dashboard|profile)/)
  })

  test('should handle registration form validation errors', async ({ page }) => {
    // Seed API routes without registration success mock
    await seedApiRoutes(page, {})

    // Navigate to registration page
    await page.goto('/register')
    await waitForLoadingComplete(page)

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // Wait for validation errors to appear
    await page.waitForTimeout(500)

    // Verify validation error messages
    const errorMessages = page.locator('[role="alert"]')
    expect(await errorMessages.count()).toBeGreaterThan(0)

    // Verify error for name field
    assertTextContains(page, 'text=Name is required')
  })

  test('should reject registration with invalid email', async ({ page }) => {
    await seedApiRoutes(page, {})

    await page.goto('/register')
    await waitForLoadingComplete(page)

    // Fill form with invalid email
    await fillRegistrationForm(page, {
      name: 'Test User',
      email: 'invalid-email-format',
      role: 'Recycler',
      latitude: 40.7128,
      longitude: -74.006
    })

    // Submit form
    await submitForm(page)

    // Verify email validation error
    assertTextContains(page, 'text=Invalid email format')
  })

  test('should reject registration with invalid coordinates', async ({ page }) => {
    await seedApiRoutes(page, {})

    await page.goto('/register')
    await waitForLoadingComplete(page)

    // Fill form with out-of-range coordinates
    await fillRegistrationForm(page, {
      name: 'Test User',
      email: 'user@test.example.com',
      role: 'Recycler',
      latitude: 91.0, // Invalid: > 90
      longitude: -74.006
    })

    // Submit form
    await submitForm(page)

    // Verify coordinate validation error
    assertTextContains(page, 'text=Latitude must be between -90 and 90')
  })

  test('should pre-fill registration form fields from URL params', async ({ page }) => {
    await seedApiRoutes(page, {})

    // Navigate with pre-fill params
    await page.goto('/register?name=PrefilledName&email=test@example.com')
    await waitForLoadingComplete(page)

    // Verify form fields are pre-filled
    const nameInput = page.locator('input[name="name"]')
    const emailInput = page.locator('input[name="email"]')

    expect(await nameInput.inputValue()).toBe('PrefilledName')
    expect(await emailInput.inputValue()).toBe('test@example.com')
  })

  // =========================================================================
  // Waste Submission Flow Tests
  // =========================================================================

  test('should submit waste with valid data after registration', async ({ page }) => {
    // Seed authentication (skip registration, go straight to waste form)
    await seedApiRoutes(page, {
      participant: { ...defaultParticipant, role: 'Recycler' },
      waste: defaultWaste
    })

    // Navigate to waste submission page
    // (In real app, user would be logged in)
    await page.goto('/waste/submit')
    await waitForLoadingComplete(page)

    // Verify waste form is visible
    assertVisible(page, 'form[data-testid="waste-form"]')

    // Fill waste form with deterministic test data
    await fillWasteForm(page, {
      type: 'Plastic',
      weight: 500,
      latitude: 40.7128,
      longitude: -74.006,
      description: 'Test plastic waste',
      photo: null // Skip photo upload for E2E test
    })

    // Submit waste
    await submitForm(page)

    // Verify waste submission success
    assertTextContains(page, 'text=Waste submitted successfully')
    verifyNotification(page, 'success')

    // Verify navigation to waste detail or confirmation page
    await expect(page).toHaveURL(/\/(waste|submission)/)
  })

  test('should handle waste form validation errors', async ({ page }) => {
    await seedApiRoutes(page, {
      participant: { ...defaultParticipant, role: 'Recycler' }
    })

    await page.goto('/waste/submit')
    await waitForLoadingComplete(page)

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // Wait for validation errors
    await page.waitForTimeout(500)

    // Verify validation error messages
    const errorMessages = page.locator('[role="alert"]')
    expect(await errorMessages.count()).toBeGreaterThan(0)

    assertTextContains(page, 'text=Waste type is required')
  })

  test('should reject waste with negative weight', async ({ page }) => {
    await seedApiRoutes(page, {
      participant: { ...defaultParticipant, role: 'Recycler' }
    })

    await page.goto('/waste/submit')
    await waitForLoadingComplete(page)

    // Fill form with negative weight
    await fillWasteForm(page, {
      type: 'Glass',
      weight: -100, // Invalid
      latitude: 40.7128,
      longitude: -74.006
    })

    await submitForm(page)

    // Verify weight validation error
    assertTextContains(page, 'text=Weight must be greater than 0')
  })

  test('should reject waste with invalid coordinates', async ({ page }) => {
    await seedApiRoutes(page, {
      participant: { ...defaultParticipant, role: 'Recycler' }
    })

    await page.goto('/waste/submit')
    await waitForLoadingComplete(page)

    // Fill form with invalid longitude
    await fillWasteForm(page, {
      type: 'Metal',
      weight: 200,
      latitude: 40.7128,
      longitude: 200.0 // Invalid: > 180
    })

    await submitForm(page)

    // Verify longitude validation error
    assertTextContains(page, 'text=Longitude must be between -180 and 180')
  })

  // =========================================================================
  // Complete Registration + Waste Submission Flow
  // =========================================================================

  test('should complete full register → submit waste flow end-to-end', async ({ page }) => {
    // Step 1: Register
    await seedApiRoutes(page, {
      participant: { ...defaultParticipant, role: 'Recycler', name: 'Complete Flow Recycler' },
      waste: defaultWaste
    })

    await page.goto('/register')
    await waitForLoadingComplete(page)

    await fillRegistrationForm(page, {
      name: 'Complete Flow Recycler',
      email: 'completeflow@test.example.com',
      role: 'Recycler',
      latitude: 40.7128,
      longitude: -74.006
    })

    await submitForm(page)

    // Verify registration success
    assertTextContains(page, 'text=Registration successful')
    verifyNotification(page, 'success')

    // Step 2: Navigate to waste submission
    await page.goto('/waste/submit')
    await waitForLoadingComplete(page)

    // Verify waste form is visible (user is now authenticated)
    assertVisible(page, 'form[data-testid="waste-form"]')

    // Step 3: Submit waste
    await fillWasteForm(page, {
      type: 'Plastic',
      weight: 750,
      latitude: 40.7128,
      longitude: -74.006,
      description: 'Complete flow test waste',
      photo: null
    })

    await submitForm(page)

    // Verify waste submission success
    assertTextContains(page, 'text=Waste submitted successfully')
    verifyNotification(page, 'success')

    // Verify final navigation
    await expect(page).toHaveURL(/\/(waste|submission|dashboard)/)
  })

  test('should persist registration data across page navigation', async ({ page, context }) => {
    // Seed wallet connection for all pages in context
    const contextPage = await context.newPage()
    await seedWalletConnection(contextPage)
    await contextPage.close()

    // Seed API routes
    await seedApiRoutes(page, {
      participant: { ...defaultParticipant, role: 'Recycler' }
    })

    // Register user
    await page.goto('/register')
    await waitForLoadingComplete(page)

    await fillRegistrationForm(page, {
      name: 'Persistent Data User',
      email: 'persistent@test.example.com',
      role: 'Recycler',
      latitude: 35.6762,
      longitude: 139.6503
    })

    await submitForm(page)
    assertTextContains(page, 'text=Registration successful')

    // Navigate to different page and back
    await page.goto('/dashboard')
    await waitForLoadingComplete(page)

    await page.goto('/profile')
    await waitForLoadingComplete(page)

    // Verify registration data persisted
    assertTextContains(page, 'text=Persistent Data User')
    assertTextContains(page, 'text=persistent@test.example.com')
  })

  test('should show loading state during registration submission', async ({ page }) => {
    await seedApiRoutes(page, {
      participant: { ...defaultParticipant, role: 'Recycler' }
    })

    await page.goto('/register')
    await waitForLoadingComplete(page)

    await fillRegistrationForm(page, {
      name: 'Loading Test User',
      email: 'loading@test.example.com',
      role: 'Recycler',
      latitude: 40.7128,
      longitude: -74.006
    })

    // Get submit button and click
    const submitButton = page.locator('button[type="submit"]')

    // Click submit
    await submitButton.click()

    // Verify loading state appears
    assertVisible(page, '[data-testid="loading-spinner"]')

    // Wait for loading to complete
    await waitForLoadingComplete(page)

    // Verify success state
    assertTextContains(page, 'text=Registration successful')
  })

  test('should disable form during submission', async ({ page }) => {
    await seedApiRoutes(page, {
      participant: { ...defaultParticipant, role: 'Recycler' }
    })

    await page.goto('/register')
    await waitForLoadingComplete(page)

    await fillRegistrationForm(page, {
      name: 'Disable Form Test',
      email: 'disable@test.example.com',
      role: 'Recycler',
      latitude: 40.7128,
      longitude: -74.006
    })

    // Get form inputs
    const nameInput = page.locator('input[name="name"]')
    const submitButton = page.locator('button[type="submit"]')

    // Click submit
    await submitButton.click()

    // Verify form is disabled during submission
    expect(await nameInput.isDisabled()).toBe(true)
    expect(await submitButton.isDisabled()).toBe(true)

    // Wait for completion
    await waitForLoadingComplete(page)

    // Form may remain disabled or be cleared depending on implementation
  })

  test('should show error notification on network failure', async ({ page }) => {
    // Mock network error by not seeding API routes properly
    await page.route('**/api/**', (route) => route.abort('failed'))

    await page.goto('/register')
    await waitForLoadingComplete(page)

    await fillRegistrationForm(page, {
      name: 'Network Error Test',
      email: 'networkerror@test.example.com',
      role: 'Recycler',
      latitude: 40.7128,
      longitude: -74.006
    })

    await submitForm(page)

    // Verify error notification
    verifyNotification(page, 'error')
    assertTextContains(page, 'text=(Network error|Failed to register|Connection failed)')
  })

  test('should auto-complete geolocation if user grants permission', async ({ page }) => {
    // Mock geolocation
    await page.goto('/register')
    await waitForLoadingComplete(page)

    // Simulate geolocation permission (if implemented in app)
    await page.evaluate(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition = (success: any) => {
          success({ coords: { latitude: 40.7128, longitude: -74.006, accuracy: 10 } })
        }
      }
    })

    // Look for "Use my location" button
    const useLocationButton = page.locator('button:has-text("Use my location")')

    if (await useLocationButton.isVisible()) {
      await useLocationButton.click()
      await page.waitForTimeout(500)

      // Verify coordinates were filled
      const latInput = page.locator('input[name="latitude"]')
      const lonInput = page.locator('input[name="longitude"]')

      expect(await latInput.inputValue()).toBe('40.7128')
      expect(await lonInput.inputValue()).toBe('-74.006')
    }
  })
})
