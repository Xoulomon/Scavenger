import { test, expect, Page } from '@playwright/test';

// CSS selectors for dynamic content that changes between runs.
// These regions are masked with a solid block so screenshots are deterministic.
const DYNAMIC_SELECTORS = [
  // Wallet addresses and truncated keys
  '[data-testid="wallet-address"]',
  '[data-testid="address-display"]',
  // Timestamps and relative times
  'time',
  '[data-testid="timestamp"]',
  '[data-testid="relative-time"]',
  // Random / server-generated IDs
  '[data-testid="waste-id"]',
  '[data-testid="tx-hash"]',
  '[data-testid="transaction-id"]',
];

// Shared helper: wait for page to be visually stable
async function waitForStable(page: Page) {
  await page.waitForLoadState('networkidle');
  // Disable all CSS animations and transitions for deterministic screenshots.
  // Font loading is also forced to use a fallback by overriding font-family so
  // variable network conditions do not affect glyph rendering.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        animation-delay: 0s !important;
        transition-delay: 0s !important;
      }
      * {
        font-family: Arial, Helvetica, sans-serif !important;
      }
    `,
  });
}

/**
 * Collect all dynamic locators on the page that should be masked in screenshots.
 * Returns an array of Locator objects for the `mask` option of toHaveScreenshot.
 */
function dynamicMasks(page: Page) {
  return DYNAMIC_SELECTORS.map((sel) => page.locator(sel));
}

// Public pages (no auth required)
test.describe('Public Pages', () => {
  test('landing page - desktop', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('landing-desktop.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('landing page - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('landing-mobile.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('landing page - tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('landing-tablet.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('login page', async ({ page }) => {
    await page.goto('/login');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('login.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('login page - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('login-mobile.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('404 not found page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('not-found.png', { fullPage: true, mask: dynamicMasks(page) });
  });
});

// Authenticated pages — mock auth via localStorage before navigation
test.describe('Authenticated Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Seed auth state so ProtectedLayout passes
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'visual-test-token');
      localStorage.setItem('user_role', 'recycler');
    });
  });

  test('home / dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('recycler dashboard', async ({ page }) => {
    await page.goto('/dashboard/recycler');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('recycler-dashboard.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('waste list page', async ({ page }) => {
    await page.goto('/wastes');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('waste-list.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('waste list page - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/wastes');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('waste-list-mobile.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('incentives marketplace', async ({ page }) => {
    await page.goto('/incentives');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('incentives-marketplace.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('collector dashboard', async ({ page }) => {
    await page.goto('/collect');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('collector-dashboard.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('manufacturer dashboard', async ({ page }) => {
    await page.goto('/manufacturer');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('manufacturer-dashboard.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('analytics page', async ({ page }) => {
    await page.goto('/analytics');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('analytics.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('rewards page', async ({ page }) => {
    await page.goto('/rewards');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('rewards.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('supply chain tracker', async ({ page }) => {
    await page.goto('/tracker');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('supply-chain-tracker.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('waste map', async ({ page }) => {
    await page.goto('/map');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('waste-map.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('admin dashboard', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('user_role', 'admin'));
    await page.goto('/admin');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('admin-dashboard.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('verification page', async ({ page }) => {
    await page.goto('/verify');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('verification.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('settings page', async ({ page }) => {
    await page.goto('/settings');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('settings.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('community page', async ({ page }) => {
    await page.goto('/community');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('community.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('recycling guide', async ({ page }) => {
    await page.goto('/recycling-guide');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('recycling-guide.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('waste marketplace', async ({ page }) => {
    await page.goto('/marketplace');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('waste-marketplace.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('waste certification', async ({ page }) => {
    await page.goto('/certifications');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('waste-certification.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('predictive analytics', async ({ page }) => {
    await page.goto('/predictions');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('predictive-analytics.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('route planner', async ({ page }) => {
    await page.goto('/route-planner');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('route-planner.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('messaging page', async ({ page }) => {
    await page.goto('/messages');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('messaging.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('waste comparison', async ({ page }) => {
    await page.goto('/compare');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('waste-comparison.png', { fullPage: true, mask: dynamicMasks(page) });
  });
});

// Dark mode variants
test.describe('Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'visual-test-token');
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    });
  });

  test('landing page - dark mode', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('landing-dark.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('dashboard - dark mode', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('dashboard-dark.png', { fullPage: true, mask: dynamicMasks(page) });
  });

  test('settings page - dark mode', async ({ page }) => {
    await page.goto('/settings');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('settings-dark.png', { fullPage: true, mask: dynamicMasks(page) });
  });
});
