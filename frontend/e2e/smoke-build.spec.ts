/**
 * #962 – Post-build smoke test
 *
 * Runs against the *built* dist artefact served by `vite preview` (or any
 * static host).  The suite intentionally stays small so it completes in < 2
 * minutes.  It fails fast on:
 *
 *  1. Health – the app boots without JS errors.
 *  2. Routing – landing page title and hero text are present.
 *  3. Auth redirect – unauthenticated users are sent to /login.
 *  4. One real flow – wallet-connect UI responds to interaction.
 *
 * Usage
 * -----
 *  # Build, then run against the preview server (port 4173 by default):
 *  npm run build
 *  npx playwright test e2e/smoke-build.spec.ts --config e2e/playwright.smoke-build.config.ts
 *
 *  # Or set SMOKE_BUILD_URL to an already-running deployment:
 *  SMOKE_BUILD_URL=https://staging.example.com npx playwright test e2e/smoke-build.spec.ts \
 *    --config e2e/playwright.smoke-build.config.ts
 */

import { test, expect } from '@playwright/test'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Collect critical page errors (config / contract / runtime). */
function collectCriticalErrors(page: import('@playwright/test').Page): () => string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => {
    if (/contract|rpc|network passphrase|missing.*env/i.test(err.message)) {
      errors.push(err.message)
    }
  })
  return () => errors
}

// ─── 1. Health ────────────────────────────────────────────────────────────────

test.describe('Smoke: Build health', () => {
  test('app loads without critical JS errors', async ({ page }) => {
    const criticalErrors = collectCriticalErrors(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(criticalErrors()).toHaveLength(0)
  })

  test('HTML document is served with correct content-type', async ({ page }) => {
    const response = await page.goto('/')
    // A 200 or 304 is acceptable; anything >= 400 is a broken deployment.
    expect(response?.status()).toBeLessThan(400)
    const contentType = response?.headers()['content-type'] ?? ''
    expect(contentType).toContain('text/html')
  })

  test('page renders within 5 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/')
    await expect(page.locator('#root')).not.toBeEmpty()
    expect(Date.now() - start).toBeLessThan(5000)
  })
})

// ─── 2. Routing ───────────────────────────────────────────────────────────────

test.describe('Smoke: Core routing', () => {
  test('landing page has correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Scavngr/i)
  })

  test('landing page renders hero heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /recycling, rewarded on-chain/i })).toBeVisible()
  })

  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unknown route does not crash the app', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-smoke-test')
    // App must stay alive; no raw exception dump on screen.
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error')
    await expect(page.locator('#root')).not.toBeEmpty()
  })
})

// ─── 3. One flow – wallet connect UI ─────────────────────────────────────────

test.describe('Smoke: Wallet connect flow', () => {
  test('login page renders wallet connect button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible()
  })

  test('wallet connect button is enabled and responds to click', async ({ page }) => {
    await page.goto('/login')
    const btn = page.getByRole('button', { name: /connect wallet/i })
    await expect(btn).toBeEnabled()

    // Clicking the button should produce *some* UI response:
    // loading indicator, error message, or modal – never a silent white screen.
    await btn.click()
    const responded =
      (await page.getByText(/connecting/i).isVisible()) ||
      (await page.getByRole('alert').isVisible()) ||
      (await page.getByRole('dialog').isVisible()) ||
      (await page.getByText(/freighter/i).isVisible())
    expect(responded).toBe(true)
  })
})

// ─── 4. Static asset integrity ────────────────────────────────────────────────

test.describe('Smoke: Static assets', () => {
  test('main JS bundle is served without 4xx/5xx', async ({ page }) => {
    const failedAssets: string[] = []
    page.on('requestfailed', (req) => {
      if (/\.(js|ts)$/.test(req.url())) failedAssets.push(req.url())
    })
    page.on('response', (res) => {
      if (res.status() >= 400 && /\.(js)$/.test(res.url())) {
        failedAssets.push(`${res.url()} → ${res.status()}`)
      }
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(failedAssets).toHaveLength(0)
  })

  test('CSS is loaded (no FOUC – body has some non-default styles)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // If Tailwind CSS loaded correctly the body background won't be the browser
    // default white (#ffffff).  We only assert CSS files aren't 404'd.
    const failedCss: string[] = []
    page.on('response', (res) => {
      if (res.status() >= 400 && /\.css$/.test(res.url())) {
        failedCss.push(`${res.url()} → ${res.status()}`)
      }
    })
    // Re-navigate to catch the initial load
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(failedCss).toHaveLength(0)
  })
})
