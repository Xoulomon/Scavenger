/**
 * Smoke tests — run after every deployment to verify critical functionality.
 * Target: production BASE_URL (set via PLAYWRIGHT_BASE_URL env var).
 * All tests must complete in < 5 minutes total.
 */
import { test, expect } from '@playwright/test'

// ── 1. App loads ──────────────────────────────────────────────────────────────

test('landing page loads with correct title and hero text', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Scavngr/i)
  await expect(page.getByRole('heading', { name: /recycling, rewarded on-chain/i })).toBeVisible()
})

test('landing page renders navigation and CTA buttons', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /launch app/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /get started/i })).toBeVisible()
})

test('landing page displays live stats section', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/live stats/i)).toBeVisible()
  // Stats cards are rendered (values may be loading dashes or numbers)
  await expect(page.getByText(/waste items/i)).toBeVisible()
  await expect(page.getByText(/total weight/i)).toBeVisible()
  await expect(page.getByText(/tokens distributed/i)).toBeVisible()
})

test('"How it works" section shows all three steps', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/how it works/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: /recycle/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /collect/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /manufacture/i })).toBeVisible()
})

// ── 2. Routing ────────────────────────────────────────────────────────────────

test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('login page renders wallet connect button', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /welcome to scavngr/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible()
})

test('404 page renders for unknown routes', async ({ page }) => {
  await page.goto('/this-route-does-not-exist')
  // Either a 404 component or a redirect — page must not crash
  const body = page.locator('body')
  await expect(body).not.toBeEmpty()
  // Should not show a raw error stack
  await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error')
})

// ── 3. Wallet connection UI ───────────────────────────────────────────────────

test('wallet connect button is interactive and shows loading state', async ({ page }) => {
  await page.goto('/login')
  const btn = page.getByRole('button', { name: /connect wallet/i })
  await expect(btn).toBeEnabled()
  // Click triggers loading (Freighter not installed in CI → error message shown)
  await btn.click()
  // Either loading text or an error alert — either way the UI responds
  const responded =
    (await page.getByText(/connecting/i).isVisible()) || (await page.getByRole('alert').isVisible())
  expect(responded).toBe(true)
})

// ── 4. Contract / config health ───────────────────────────────────────────────

test('app does not throw config errors on load', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.goto('/')
  // Filter out known non-critical third-party noise; fail on config/contract errors
  const critical = errors.filter((e) =>
    /missing required environment variable|invalid vite_network|contract/i.test(e)
  )
  expect(critical).toHaveLength(0)
})

test('login page contract client initialises without crashing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible()
  const critical = errors.filter((e) => /contract|rpc|network passphrase/i.test(e))
  expect(critical).toHaveLength(0)
})

// ── 5. Critical user flows (UI layer) ────────────────────────────────────────

test('incentives marketplace page is accessible after login redirect', async ({ page }) => {
  // Navigating to /incentives without auth should redirect to login, not crash
  await page.goto('/incentives')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible()
})

test('page performance: landing page loads within 5 seconds', async ({ page }) => {
  const start = Date.now()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /recycling, rewarded on-chain/i })).toBeVisible()
  expect(Date.now() - start).toBeLessThan(5000)
})
