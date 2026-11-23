//! E2E test: reward claim and payout flow — Issue #1749.
//!
//! Tests the complete user journey for claiming rewards and initiating payouts
//! using Playwright with deterministic fixtures and mocks.
//!
//! Test coverage:
//! - Verify waste and earn rewards
//! - View reward balance and history
//! - Claim rewards with confirmation
//! - Initiate payout transaction
//! - Handle payment errors and retries
//! - Verify transaction status updates
//!
//! Run with: npm run test:e2e -- reward-claim-payout.spec.ts

import { test, expect, type Page } from '@playwright/test'
import {
  seedWalletConnection,
  seedApiRoutes,
  seedLocalStorageAuth,
  submitForm,
  waitForLoadingComplete,
  assertVisible,
  assertTextContains,
  verifyNotification,
  waitForTransaction,
  TEST_WALLET_ADDRESS,
  TEST_CONTRACT_ID,
  defaultParticipant
} from './test-utils'

test.describe('E2E: Reward Claim and Payout Flow — Issue #1749', () => {
  test.beforeEach(async ({ page, context }) => {
    // Seed wallet connection for all tests
    await seedWalletConnection(page)

    // Seed authentication to skip login
    await seedLocalStorageAuth(context, {
      address: TEST_WALLET_ADDRESS,
      role: 'Recycler',
      token: 'mock-auth-token-' + Date.now()
    })

    // Seed API routes with participant and wallet data
    await seedApiRoutes(page, {
      participant: {
        ...defaultParticipant,
        address: TEST_WALLET_ADDRESS,
        role: 'Recycler',
        balance: 5000 // Starting reward balance
      }
    })
  })

  // =========================================================================
  // Reward Balance & History Tests
  // =========================================================================

  test('should display current reward balance on dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForLoadingComplete(page)

    // Verify reward balance is visible
    assertVisible(page, '[data-testid="reward-balance"]')

    // Verify balance value
    assertTextContains(page, 'text=5000') // or XLM units

    // Verify balance is clickable to show details
    const balanceElement = page.locator('[data-testid="reward-balance"]')
    expect(await balanceElement.isVisible()).toBe(true)
  })

  test('should display reward transaction history', async ({ page }) => {
    await page.goto('/rewards/history')
    await waitForLoadingComplete(page)

    // Verify history table/list is visible
    assertVisible(page, '[data-testid="reward-history"]')

    // Verify column headers
    assertTextContains(page, 'text=Date')
    assertTextContains(page, 'text=Amount')
    assertTextContains(page, 'text=Type')
    assertTextContains(page, 'text=Status')

    // Verify at least one transaction row
    const rows = page.locator('[data-testid="reward-history"] tbody tr')
    expect(await rows.count()).toBeGreaterThan(0)
  })

  test('should filter reward history by type (earned/spent/refunded)', async ({ page }) => {
    await page.goto('/rewards/history')
    await waitForLoadingComplete(page)

    // Find filter dropdown
    const typeFilter = page.locator('select[name="type"]')
    await typeFilter.selectOption('earned')

    // Wait for filtered results
    await page.waitForTimeout(500)

    // Verify filtered results only show "earned" type
    const rows = page.locator('[data-testid="reward-history"] tbody tr')
    const rowCount = await rows.count()

    if (rowCount > 0) {
      const firstRow = rows.first()
      const typeCell = firstRow.locator('td:nth-child(3)')
      assertTextContains(typeCell, 'text=earned')
    }
  })

  test('should display reward earned from verified waste', async ({ page }) => {
    // Create scenario: waste submitted, verified, reward earned
    await seedApiRoutes(page, {
      participant: {
        ...defaultParticipant,
        address: TEST_WALLET_ADDRESS,
        role: 'Recycler',
        balance: 5500 // Increased by 500 from verification
      }
    })

    await page.goto('/rewards/history')
    await waitForLoadingComplete(page)

    // Look for latest earning transaction
    const rows = page.locator('[data-testid="reward-history"] tbody tr')
    const firstRow = rows.first()

    // Verify it shows earned amount
    const amountCell = firstRow.locator('td:nth-child(2)')
    assertTextContains(amountCell, 'text=500')

    // Verify type is "earned"
    const typeCell = firstRow.locator('td:nth-child(3)')
    assertTextContains(typeCell, 'text=earned')
  })

  // =========================================================================
  // Reward Claim Tests
  // =========================================================================

  test('should display claim button when balance > 0', async ({ page }) => {
    await page.goto('/rewards')
    await waitForLoadingComplete(page)

    // Verify claim button is visible
    const claimButton = page.locator('button:has-text("Claim Rewards")')
    expect(await claimButton.isVisible()).toBe(true)
    expect(await claimButton.isDisabled()).toBe(false)
  })

  test('should disable claim button when balance = 0', async ({ page, context }) => {
    // Re-seed with zero balance
    const newPage = await context.newPage()
    await seedApiRoutes(newPage, {
      participant: {
        ...defaultParticipant,
        address: TEST_WALLET_ADDRESS,
        balance: 0
      }
    })
    await newPage.close()

    // Refresh current page to get new mock data
    await page.reload()
    await waitForLoadingComplete(page)

    await page.goto('/rewards')
    await waitForLoadingComplete(page)

    // Verify claim button is disabled
    const claimButton = page.locator('button:has-text("Claim Rewards")')
    if (await claimButton.isVisible()) {
      expect(await claimButton.isDisabled()).toBe(true)
    }
  })

  test('should show reward amount in claim dialog', async ({ page }) => {
    await page.goto('/rewards')
    await waitForLoadingComplete(page)

    // Click claim button
    const claimButton = page.locator('button:has-text("Claim Rewards")')
    await claimButton.click()

    // Wait for dialog to open
    await page.waitForTimeout(500)

    // Verify dialog is visible
    assertVisible(page, '[role="dialog"], [data-testid="claim-dialog"]')

    // Verify amount is displayed
    assertTextContains(page, 'text=5000')

    // Verify confirmation message
    assertTextContains(page, 'text=(Claim|Confirm)')
  })

  test('should confirm reward claim with proper amount', async ({ page }) => {
    await page.goto('/rewards')
    await waitForLoadingComplete(page)

    // Click claim button
    const claimButton = page.locator('button:has-text("Claim Rewards")')
    await claimButton.click()

    await page.waitForTimeout(500)

    // Verify dialog shows correct amount
    assertTextContains(page, 'text=5000')

    // Click confirm button
    const confirmButton = page.locator('button:has-text("Confirm")')
    await confirmButton.click()

    // Verify loading state
    assertVisible(page, '[data-testid="loading-spinner"]')

    // Wait for transaction to complete
    await waitForLoadingComplete(page)

    // Verify success notification
    verifyNotification(page, 'success')
    assertTextContains(page, 'text=Reward claimed successfully')
  })

  test('should cancel claim dialog without submitting', async ({ page }) => {
    await page.goto('/rewards')
    await waitForLoadingComplete(page)

    // Click claim button
    const claimButton = page.locator('button:has-text("Claim Rewards")')
    await claimButton.click()

    await page.waitForTimeout(500)

    // Click cancel button
    const cancelButton = page.locator('button:has-text("Cancel")')
    await cancelButton.click()

    // Wait for dialog to close
    await page.waitForTimeout(300)

    // Verify dialog is closed
    const dialog = page.locator('[role="dialog"], [data-testid="claim-dialog"]')
    expect(await dialog.isVisible()).toBe(false)

    // Verify no notification appeared
    const notification = page.locator('[role="alert"]')
    expect(await notification.count()).toBe(0)
  })

  // =========================================================================
  // Payout Transaction Tests
  // =========================================================================

  test('should display payout form with reward details', async ({ page }) => {
    // Navigate to payout page
    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    // Verify payout form is visible
    assertVisible(page, 'form[data-testid="payout-form"]')

    // Verify form shows:
    // - Reward amount (read-only)
    // - Destination address (wallet address)
    // - Confirmation checkbox
    assertTextContains(page, 'text=5000')
    assertTextContains(page, TEST_WALLET_ADDRESS)
    assertVisible(page, 'input[type="checkbox"]')
  })

  test('should submit payout transaction with valid data', async ({ page }) => {
    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    // Accept terms checkbox
    const termsCheckbox = page.locator('input[type="checkbox"]')
    await termsCheckbox.check()

    // Submit form
    await submitForm(page)

    // Verify loading state
    assertVisible(page, '[data-testid="loading-spinner"]')

    // Wait for transaction to complete
    await waitForTransaction(page)

    // Verify success state
    assertTextContains(page, 'text=Payout initiated')
    verifyNotification(page, 'success')
  })

  test('should reject payout without accepting terms', async ({ page }) => {
    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    // Try to submit without checking terms
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // Wait for validation
    await page.waitForTimeout(500)

    // Verify error message
    assertTextContains(page, 'text=You must accept')
  })

  // =========================================================================
  // Payout Status & History Tests
  // =========================================================================

  test('should display payout status as "pending" after submission', async ({ page }) => {
    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    // Submit payout
    const termsCheckbox = page.locator('input[type="checkbox"]')
    await termsCheckbox.check()
    await submitForm(page)

    await waitForLoadingComplete(page)

    // Verify pending status
    assertTextContains(page, 'text=Pending')
    assertVisible(page, '[data-testid="status-badge-pending"]')
  })

  test('should display payout transaction hash on success', async ({ page }) => {
    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    // Submit payout
    const termsCheckbox = page.locator('input[type="checkbox"]')
    await termsCheckbox.check()
    await submitForm(page)

    await waitForLoadingComplete(page)

    // Verify transaction hash is displayed
    assertVisible(page, '[data-testid="tx-hash"]')

    // Verify hash is clickable (links to explorer)
    const hashLink = page.locator('[data-testid="tx-hash-link"]')
    const href = await hashLink.getAttribute('href')
    expect(href).toMatch(/explorer|stellar/i)
  })

  test('should allow user to view payout history after claim', async ({ page }) => {
    // First, submit a payout
    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    const termsCheckbox = page.locator('input[type="checkbox"]')
    await termsCheckbox.check()
    await submitForm(page)

    await waitForLoadingComplete(page)

    // Navigate to payout history
    await page.goto('/payouts/history')
    await waitForLoadingComplete(page)

    // Verify history is displayed
    assertVisible(page, '[data-testid="payout-history"]')

    // Verify latest payout shows in history
    const rows = page.locator('[data-testid="payout-history"] tbody tr')
    expect(await rows.count()).toBeGreaterThan(0)

    // Verify first row shows pending status
    const firstRow = rows.first()
    assertTextContains(firstRow, 'text=Pending')
  })

  // =========================================================================
  // Error Handling & Retry Tests
  // =========================================================================

  test('should handle network error during payout submission', async ({ page }) => {
    // Mock network error
    await page.route('**/api/**/payouts', (route) => route.abort('failed'))

    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    // Submit payout
    const termsCheckbox = page.locator('input[type="checkbox"]')
    await termsCheckbox.check()
    await submitForm(page)

    // Wait for error to appear
    await page.waitForTimeout(1000)

    // Verify error notification
    verifyNotification(page, 'error')
    assertTextContains(page, 'text=(Network error|Failed|Connection)')
  })

  test('should allow retry on payout failure', async ({ page }) => {
    // Mock first failure, then success
    let callCount = 0
    await page.route('**/api/**/payouts', (route) => {
      callCount++
      if (callCount === 1) {
        route.abort('failed')
      } else {
        route.continue()
      }
    })

    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    // First submission attempt
    const termsCheckbox = page.locator('input[type="checkbox"]')
    await termsCheckbox.check()
    await submitForm(page)

    await page.waitForTimeout(1000)

    // Verify error appeared
    verifyNotification(page, 'error')

    // Look for retry button
    const retryButton = page.locator('button:has-text("Retry")')
    if (await retryButton.isVisible()) {
      // Clear mock network error
      await page.unroute('**/api/**/payouts')
      await seedApiRoutes(page, {})

      // Click retry
      await retryButton.click()

      // Wait for success
      await waitForLoadingComplete(page)

      // Verify success
      verifyNotification(page, 'success')
    }
  })

  test('should handle insufficient balance gracefully', async ({ page, context }) => {
    // Re-seed with zero balance
    const newPage = await context.newPage()
    await seedApiRoutes(newPage, {
      participant: {
        ...defaultParticipant,
        address: TEST_WALLET_ADDRESS,
        balance: 0
      }
    })
    await newPage.close()

    await page.reload()
    await waitForLoadingComplete(page)

    // Try to navigate to claim page
    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    // Verify error message or redirect
    const errorMsg = page.locator('text=(No rewards|Insufficient|insufficient)')
    const hasError = await errorMsg.isVisible().catch(() => false)

    if (hasError) {
      assertTextContains(page, 'text=No rewards')
    } else {
      // Should redirect to rewards page
      await expect(page).toHaveURL(/\/rewards/)
    }
  })

  // =========================================================================
  // Complete Reward Claim Flow Tests
  // =========================================================================

  test('should complete full workflow: verify waste → earn → claim → payout', async ({
    page,
    context
  }) => {
    // Step 1: Verify waste (earn reward)
    await seedApiRoutes(page, {
      participant: {
        ...defaultParticipant,
        address: TEST_WALLET_ADDRESS,
        balance: 500
      }
    })

    await page.goto('/dashboard')
    await waitForLoadingComplete(page)

    // Verify balance shows earned reward
    assertTextContains(page, 'text=500')

    // Step 2: Navigate to rewards
    await page.goto('/rewards')
    await waitForLoadingComplete(page)

    // Verify balance displays
    assertVisible(page, '[data-testid="reward-balance"]')

    // Step 3: Claim rewards
    const claimButton = page.locator('button:has-text("Claim Rewards")')
    await claimButton.click()

    await page.waitForTimeout(500)

    const confirmButton = page.locator('button:has-text("Confirm")')
    await confirmButton.click()

    await waitForLoadingComplete(page)

    // Verify claim success
    verifyNotification(page, 'success')

    // Step 4: Initiate payout
    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    const termsCheckbox = page.locator('input[type="checkbox"]')
    await termsCheckbox.check()

    await submitForm(page)

    await waitForLoadingComplete(page)

    // Verify payout initiated
    assertTextContains(page, 'text=Payout initiated')
    verifyNotification(page, 'success')

    // Verify transaction hash displayed
    assertVisible(page, '[data-testid="tx-hash"]')
  })

  test('should show payout confirmation before transaction', async ({ page }) => {
    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    // Accept terms
    const termsCheckbox = page.locator('input[type="checkbox"]')
    await termsCheckbox.check()

    // Verify confirmation message visible
    assertTextContains(page, 'text=(confirm|agreement)')

    // Verify amount is clear
    assertTextContains(page, 'text=5000')

    // Verify destination address shown
    assertTextContains(page, TEST_WALLET_ADDRESS)
  })

  test('should disable form during payout submission', async ({ page }) => {
    await page.goto('/rewards/claim')
    await waitForLoadingComplete(page)

    const termsCheckbox = page.locator('input[type="checkbox"]')
    await termsCheckbox.check()

    const submitButton = page.locator('button[type="submit"]')

    // Click submit
    await submitButton.click()

    // Verify form elements are disabled
    expect(await termsCheckbox.isDisabled()).toBe(true)
    expect(await submitButton.isDisabled()).toBe(true)

    // Wait for completion
    await waitForLoadingComplete(page)
  })
})
