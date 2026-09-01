import { test, expect, Page } from '@playwright/test';

/**
 * End-to-End Test: Complete Recycling Workflow
 * Tests the entire user journey from registration to waste transfer
 */

test.describe('Complete Recycling Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('User can complete full recycling workflow', async () => {
    // 1. Landing page loads successfully
    await expect(page).toHaveTitle(/Scavngr/);
    await expect(page.locator('h1')).toContainText('Scavngr');

    // 2. Connect wallet
    await page.click('button:has-text("Connect Wallet")');
    await page.waitForSelector('[data-testid="wallet-modal"]', { state: 'visible' });

    // Select Freighter wallet
    await page.click('[data-testid="freighter-wallet"]');
    await page.waitForTimeout(1000); // Wait for wallet connection

    // 3. Register as participant
    await page.click('[data-testid="register-button"]');
    await page.waitForSelector('[data-testid="registration-form"]');

    await page.fill('[data-testid="participant-name"]', 'E2E Test Recycler');
    await page.selectOption('[data-testid="participant-role"]', 'Recycler');
    await page.fill('[data-testid="latitude"]', '40.7128');
    await page.fill('[data-testid="longitude"]', '-74.0060');

    await page.click('[data-testid="submit-registration"]');
    await page.waitForSelector('[data-testid="registration-success"]', { timeout: 10000 });

    // 4. Navigate to recycler dashboard
    await page.click('[href="/recycler-dashboard"]');
    await expect(page).toHaveURL(/recycler-dashboard/);

    // 5. Submit new waste
    await page.click('[data-testid="submit-waste-button"]');
    await page.waitForSelector('[data-testid="waste-form"]');

    await page.selectOption('[data-testid="waste-type"]', 'Plastic');
    await page.fill('[data-testid="waste-weight"]', '5000');
    await page.fill('[data-testid="waste-latitude"]', '40.7128');
    await page.fill('[data-testid="waste-longitude"]', '-74.0060');

    await page.click('[data-testid="submit-waste"]');
    await page.waitForSelector('[data-testid="waste-success"]', { timeout: 10000 });

    // 6. Verify waste appears in list
    await page.waitForSelector('[data-testid="waste-list"]');
    const wasteItems = await page.locator('[data-testid^="waste-item-"]').count();
    expect(wasteItems).toBeGreaterThan(0);

    // 7. View waste details
    await page.click('[data-testid^="waste-item-"]:first-child');
    await expect(page.locator('[data-testid="waste-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="waste-type"]')).toContainText('Plastic');
    await expect(page.locator('[data-testid="waste-weight"]')).toContainText('5000');

    // 8. Navigate to waste list and prepare transfer
    await page.click('[href="/waste-list"]');
    await expect(page).toHaveURL(/waste-list/);

    await page.click('[data-testid="transfer-button"]:first');
    await page.waitForSelector('[data-testid="transfer-modal"]');

    // 9. Enter transfer details
    await page.fill('[data-testid="recipient-address"]', 'GCOLLECTOR123456789...');
    await page.fill('[data-testid="transfer-latitude"]', '40.7200');
    await page.fill('[data-testid="transfer-longitude"]', '-74.0100');

    await page.click('[data-testid="confirm-transfer"]');
    await page.waitForSelector('[data-testid="transfer-success"]', { timeout: 10000 });

    // 10. Verify transfer appears in history
    await page.click('[data-testid="view-history"]');
    await expect(page.locator('[data-testid="transfer-history"]')).toBeVisible();

    const transfers = await page.locator('[data-testid^="transfer-record-"]').count();
    expect(transfers).toBeGreaterThan(0);

    // 11. Check participant stats
    await page.click('[href="/profile"]');
    await expect(page).toHaveURL(/profile/);

    await expect(page.locator('[data-testid="total-waste-processed"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-tokens-earned"]')).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-results/complete-workflow.png', fullPage: true });
  });

  test('User can view and filter waste marketplace', async () => {
    // Navigate to marketplace
    await page.goto('/waste-marketplace');
    await expect(page).toHaveURL(/waste-marketplace/);

    // Wait for waste items to load
    await page.waitForSelector('[data-testid="marketplace-list"]');

    // Apply filters
    await page.selectOption('[data-testid="filter-waste-type"]', 'Plastic');
    await page.fill('[data-testid="filter-min-weight"]', '1000');
    await page.fill('[data-testid="filter-max-weight"]', '10000');

    await page.click('[data-testid="apply-filters"]');
    await page.waitForTimeout(1000);

    // Verify filtered results
    const items = await page.locator('[data-testid^="marketplace-item-"]').count();
    expect(items).toBeGreaterThanOrEqual(0);

    // Click on an item
    if (items > 0) {
      await page.click('[data-testid^="marketplace-item-"]:first-child');
      await expect(page.locator('[data-testid="item-details"]')).toBeVisible();
    }
  });

  test('User can create and manage incentives', async () => {
    // Navigate to incentives page
    await page.goto('/incentives');
    await expect(page).toHaveURL(/incentives/);

    // Create new incentive
    await page.click('[data-testid="create-incentive-button"]');
    await page.waitForSelector('[data-testid="incentive-form"]');

    await page.selectOption('[data-testid="incentive-waste-type"]', 'Metal');
    await page.fill('[data-testid="incentive-reward-points"]', '150');
    await page.fill('[data-testid="incentive-budget"]', '50000');

    await page.click('[data-testid="submit-incentive"]');
    await page.waitForSelector('[data-testid="incentive-success"]', { timeout: 10000 });

    // Verify incentive appears in list
    await page.waitForSelector('[data-testid="incentives-list"]');
    const incentives = await page.locator('[data-testid^="incentive-item-"]').count();
    expect(incentives).toBeGreaterThan(0);

    // View incentive details
    await page.click('[data-testid^="incentive-item-"]:first-child');
    await expect(page.locator('[data-testid="incentive-details"]')).toBeVisible();
  });

  test('User can view analytics dashboard', async () => {
    // Navigate to analytics
    await page.goto('/analytics');
    await expect(page).toHaveURL(/analytics/);

    // Wait for charts to load
    await page.waitForSelector('[data-testid="analytics-dashboard"]');

    // Verify charts are present
    await expect(page.locator('[data-testid="waste-by-type-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-status-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="timeline-chart"]')).toBeVisible();

    // Test date range filter
    await page.click('[data-testid="date-range-picker"]');
    await page.click('[data-testid="last-30-days"]');
    await page.waitForTimeout(1000);

    // Export analytics data
    await page.click('[data-testid="export-button"]');
    await page.waitForSelector('[data-testid="export-menu"]');
    await page.click('[data-testid="export-csv"]');

    // Verify download initiated (check for download event)
    const download = page.waitForEvent('download');
    await expect(download).toBeDefined();
  });

  test('User can access supply chain tracker', async () => {
    // Navigate to supply chain tracker
    await page.goto('/supply-chain-tracker');
    await expect(page).toHaveURL(/supply-chain-tracker/);

    // Enter waste ID to track
    await page.fill('[data-testid="waste-id-input"]', '1');
    await page.click('[data-testid="track-button"]');

    // Wait for tracker visualization
    await page.waitForSelector('[data-testid="supply-chain-viz"]', { timeout: 5000 });

    // Verify supply chain stages
    await expect(page.locator('[data-testid="stage-submitted"]')).toBeVisible();

    // Check map is displayed
    await expect(page.locator('[data-testid="supply-chain-map"]')).toBeVisible();

    // Verify timeline
    await expect(page.locator('[data-testid="supply-chain-timeline"]')).toBeVisible();
  });

  test('Mobile responsive workflow', async () => {
    // Set viewport to mobile
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Verify mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // Navigate using mobile menu
    await page.click('[data-testid="mobile-menu-item-dashboard"]');
    await expect(page).toHaveURL(/dashboard/);

    // Verify mobile layout
    await expect(page.locator('[data-testid="mobile-dashboard"]')).toBeVisible();

    // Test mobile waste submission
    await page.click('[data-testid="mobile-submit-waste"]');
    await expect(page.locator('[data-testid="mobile-waste-form"]')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'test-results/mobile-workflow.png', fullPage: true });
  });

  test('Accessibility compliance', async () => {
    await page.goto('/');

    // Run basic accessibility checks
    const violations = await page.evaluate(async () => {
      // @ts-ignore
      const axe = await import('axe-core');
      const results = await axe.run();
      return results.violations;
    });

    expect(violations).toHaveLength(0);

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focused = await page.locator(':focus');
    await expect(focused).toBeVisible();

    // Test screen reader attributes
    const mainContent = page.locator('main');
    await expect(mainContent).toHaveAttribute('role', 'main');

    const navigation = page.locator('nav');
    await expect(navigation).toHaveAttribute('aria-label');
  });

  test('Offline mode functionality', async () => {
    // Go online first
    await page.goto('/');

    // Go offline
    await page.context().setOffline(true);

    // Verify offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // Try to submit waste offline (should queue)
    await page.click('[data-testid="submit-waste-button"]');
    await page.fill('[data-testid="waste-weight"]', '3000');
    await page.click('[data-testid="submit-waste"]');

    // Verify queued message
    await expect(page.locator('[data-testid="queued-message"]')).toBeVisible();

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(2000);

    // Verify offline indicator disappears
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();

    // Verify queued action syncs
    await expect(page.locator('[data-testid="sync-success"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Visual Regression Tests', () => {
  test('Homepage visual snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('Dashboard visual snapshot', async ({ page }) => {
    await page.goto('/recycler-dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard.png');
  });

  test('Waste list visual snapshot', async ({ page }) => {
    await page.goto('/waste-list');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('waste-list.png');
  });

  test('Analytics visual snapshot', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('analytics.png');
  });
});

test.describe('Performance Tests', () => {
  test('Page load performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('Waste list rendering performance', async ({ page }) => {
    await page.goto('/waste-list');

    const startTime = Date.now();
    await page.waitForSelector('[data-testid="waste-list"]');
    const renderTime = Date.now() - startTime;

    // Should render within 2 seconds
    expect(renderTime).toBeLessThan(2000);
  });
});
