/**
 * #963 – Shared E2E test utilities
 *
 * Single source of truth for all Playwright helper functions, fixtures, and
 * data factories previously duplicated across:
 *
 *   - e2e/helpers/test-helpers.ts   (TestHelpers, TestDataFactory, PerformanceHelpers, VisualRegressionHelpers)
 *   - e2e/fixtures/seed.ts          (seedWalletConnection, seedApiRoutes, seedLocalStorageAuth, …)
 *
 * Import from this file in all new and migrated specs:
 *
 *   import { seedWalletConnection, TestHelpers, … } from '../test-utils';
 *
 * The original files re-export from here to remain backwards-compatible during
 * the migration period.
 */

import type { Page, BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Deterministic Stellar address used in all E2E tests. */
export const TEST_WALLET_ADDRESS = 'GTEST7SCAVNGR000000000000000000000000000000000000000000001'

/** Deterministic contract ID used in all E2E tests. */
export const TEST_CONTRACT_ID = 'CSCAVNGR0000000000000000000000000000000000000000000000001'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MockParticipant {
  address: string
  name: string
  role: number
  latitude: number
  longitude: number
  registered_at: number
  is_active: boolean
}

export interface MockWaste {
  waste_id: number
  waste_type: number
  weight: number
  current_owner: string
  latitude: number
  longitude: number
  recycled_timestamp: number
  is_active: boolean
  is_confirmed: boolean
  confirmer: string
}

// ─── Default fixtures ─────────────────────────────────────────────────────────

export const defaultParticipant: MockParticipant = {
  address: TEST_WALLET_ADDRESS,
  name: 'E2E Test Recycler',
  role: 0,
  latitude: 40_712_800,
  longitude: -74_006_000,
  registered_at: Math.floor(Date.now() / 1000),
  is_active: true
}

export const defaultWaste: MockWaste = {
  waste_id: 1,
  waste_type: 0,
  weight: 1500,
  current_owner: TEST_WALLET_ADDRESS,
  latitude: 40_712_800,
  longitude: -74_006_000,
  recycled_timestamp: Math.floor(Date.now() / 1000),
  is_active: true,
  is_confirmed: false,
  confirmer: ''
}

// ─── Wallet / auth seeds ──────────────────────────────────────────────────────

/**
 * Inject a Freighter wallet stub into the browser page before the first
 * navigation.  Must be called before `page.goto()`.
 */
export async function seedWalletConnection(page: Page): Promise<void> {
  await page.addInitScript((address: string) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    ;(window as any).freighter = {
      isConnected: () => Promise.resolve(true),
      isAllowed: () => Promise.resolve(true),
      getPublicKey: () => Promise.resolve(address),
      getNetwork: () => Promise.resolve('TESTNET'),
      getNetworkDetails: () =>
        Promise.resolve({
          network: 'TESTNET',
          networkUrl: 'https://soroban-testnet.stellar.org'
        }),
      signTransaction: (_xdr: string) => Promise.resolve({ signedTxXdr: 'AAAAAQAAAAAAAAAA' }),
      signAuthEntry: (_entryXdr: string) => Promise.resolve({ signedEntryXdr: 'AAAAAQAAAAAAAAAA' })
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, TEST_WALLET_ADDRESS)
}

/**
 * Pre-populate localStorage so pages that check wallet connectivity skip
 * the connect-wallet modal.  Must be called on the BrowserContext before
 * navigating.
 */
export async function seedLocalStorageAuth(context: BrowserContext): Promise<void> {
  await context.addInitScript((address: string) => {
    localStorage.setItem('walletAddress', address)
    localStorage.setItem('walletConnected', 'true')
    localStorage.setItem('walletType', 'freighter')
  }, TEST_WALLET_ADDRESS)
}

/** Remove all wallet / auth items from localStorage. */
export async function clearLocalStorageAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('walletAddress')
    localStorage.removeItem('walletConnected')
    localStorage.removeItem('walletType')
  })
}

// ─── API route mocks ──────────────────────────────────────────────────────────

export interface SeedApiOptions {
  participant?: Partial<MockParticipant>
  waste?: Partial<MockWaste>
  wastes?: MockWaste[]
  txHash?: string
}

/**
 * Intercept all known API routes and return deterministic mock responses.
 * Call once per test in `test.beforeEach`.
 */
export async function seedApiRoutes(page: Page, overrides: SeedApiOptions = {}): Promise<void> {
  const participant = { ...defaultParticipant, ...overrides.participant }
  const waste = { ...defaultWaste, ...overrides.waste }
  const wastes = overrides.wastes ?? [waste]
  const txHash =
    overrides.txHash ?? '0000000000000000000000000000000000000000000000000000000000000001'

  // Health
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' })
    })
  )

  // Participant lookup
  await page.route(`**/api/participants/${TEST_WALLET_ADDRESS}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(participant)
    })
  )

  // Participant list / registration
  await page.route('**/api/participants', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, participant })
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ participants: [participant], total: 1 })
    })
  })

  // Waste list / submission
  await page.route('**/api/wastes', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, waste, txHash })
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ wastes, total: wastes.length })
    })
  })

  // Individual waste
  await page.route(`**/api/wastes/${waste.waste_id}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(waste)
    })
  )

  // Contract / transaction
  await page.route('**/api/contract/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, txHash })
    })
  )

  // Stats / metrics
  await page.route('**/api/metrics', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ eventsProcessed: 42, totalWaste: wastes.length })
    })
  )

  // Incentives
  await page.route('**/api/incentives**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ incentives: [], total: 0 })
    })
  )
}

// ─── Page state helpers ───────────────────────────────────────────────────────

/** Wait for all network requests to settle (networkidle). */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
}

/** Dismiss any Sonner toast / notification banner that may obscure clicks. */
export async function dismissNotifications(page: Page): Promise<void> {
  try {
    const closeBtn = page.locator('[data-sonner-toast] button[aria-label="Close"]')
    if (await closeBtn.isVisible({ timeout: 500 })) {
      await closeBtn.click()
    }
  } catch {
    // No notifications visible — continue.
  }
}

/** Navigate to a path and wait for the page to fully load. */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

/** Fill the waste submission form fields. */
export async function fillWasteForm(
  page: Page,
  data: { type: string; weight: string; latitude: string; longitude: string }
): Promise<void> {
  await page.selectOption('[data-testid="waste-type"]', data.type)
  await page.fill('[data-testid="waste-weight"]', data.weight)
  await page.fill('[data-testid="waste-latitude"]', data.latitude)
  await page.fill('[data-testid="waste-longitude"]', data.longitude)
}

/** Fill the participant registration form fields. */
export async function fillRegistrationForm(
  page: Page,
  data: { name: string; role: string; latitude: string; longitude: string }
): Promise<void> {
  await page.fill('[data-testid="participant-name"]', data.name)
  await page.selectOption('[data-testid="participant-role"]', data.role)
  await page.fill('[data-testid="latitude"]', data.latitude)
  await page.fill('[data-testid="longitude"]', data.longitude)
}

/** Generic form fill + submit. */
export async function submitForm(
  page: Page,
  formSelector: string,
  data: Record<string, string>
): Promise<void> {
  for (const [field, value] of Object.entries(data)) {
    await page.fill(`${formSelector} [name="${field}"]`, value)
  }
  await page.click(`${formSelector} [type="submit"]`)
}

// ─── Assertion helpers ────────────────────────────────────────────────────────

/** Assert a locator is visible within the given timeout. */
export async function assertVisible(page: Page, selector: string, timeout = 5000): Promise<void> {
  await expect(page.locator(selector)).toBeVisible({ timeout })
}

/** Assert a locator contains the given text. */
export async function assertTextContains(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  await expect(page.locator(selector)).toContainText(text)
}

/** Assert a table has at least `minRows` body rows. */
export async function verifyTableHasRows(
  page: Page,
  tableSelector: string,
  minRows = 1
): Promise<void> {
  const rows = await page.locator(`${tableSelector} tbody tr`).count()
  expect(rows).toBeGreaterThanOrEqual(minRows)
}

/** Assert no notification with `message` appears. */
export async function verifyNotification(
  page: Page,
  message: string,
  type: 'success' | 'error' | 'info' = 'success'
): Promise<void> {
  await expect(page.locator(`[data-testid="notification-${type}"]`)).toContainText(message)
}

// ─── Wait helpers ─────────────────────────────────────────────────────────────

/** Wait for a `[data-testid="transaction-success"]` element to appear. */
export async function waitForTransaction(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForSelector('[data-testid="transaction-success"]', { timeout })
}

/** Wait for `[data-testid="loading"]` to disappear. */
export async function waitForLoadingComplete(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="loading"]', { state: 'hidden' })
}

/** Wait for an API URL pattern to return HTTP 200. */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string,
  timeout = 5000
): Promise<void> {
  await page.waitForResponse((res) => res.url().includes(urlPattern) && res.status() === 200, {
    timeout
  })
}

// ─── Browser feature helpers ──────────────────────────────────────────────────

/** Override the browser geolocation. */
export async function mockGeolocation(
  page: Page,
  latitude: number,
  longitude: number
): Promise<void> {
  await page.context().setGeolocation({ latitude, longitude })
  await page.context().grantPermissions(['geolocation'])
}

/** Override `Date.now` to return a fixed timestamp. */
export async function mockDateTime(page: Page, date: Date): Promise<void> {
  await page.addInitScript((ts: number) => {
    Date.now = () => ts
  }, date.getTime())
}

/** Return an array of console errors collected after this call. */
export function collectConsoleErrors(page: Page): () => string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return () => [...errors]
}

// ─── Screenshot helpers ───────────────────────────────────────────────────────

/** Take a timestamped full-page screenshot. */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await page.screenshot({
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true
  })
}

// ─── File download helpers ────────────────────────────────────────────────────

/** Click `buttonSelector` and wait for the browser download event. */
export async function downloadFile(page: Page, buttonSelector: string) {
  const downloadPromise = page.waitForEvent('download')
  await page.click(buttonSelector)
  const download = await downloadPromise
  const filePath = await download.path()
  expect(filePath).toBeTruthy()
  return download
}

// ─── Performance helpers ──────────────────────────────────────────────────────

/** Return the time (ms) to navigate to `url` and reach networkidle. */
export async function measurePageLoad(page: Page, url: string): Promise<number> {
  const start = Date.now()
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  return Date.now() - start
}

/** Return the time (ms) until `selector` first appears. */
export async function measureRenderTime(page: Page, selector: string): Promise<number> {
  const start = Date.now()
  await page.waitForSelector(selector)
  return Date.now() - start
}

/** Return the JS heap size in bytes (Chromium only; 0 elsewhere). */
export async function getMemoryUsage(page: Page): Promise<number> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (performance as any).memory?.usedJSHeapSize ?? 0
  })
}

// ─── Keyboard navigation ──────────────────────────────────────────────────────

/** Press Tab `count` times with a short pause between presses. */
export async function tabThrough(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)
  }
}

// ─── Data factory ─────────────────────────────────────────────────────────────

export const TestDataFactory = {
  generateWasteData() {
    return {
      type: 'Plastic',
      weight: (Math.random() * 10_000 + 1_000).toFixed(0),
      latitude: (Math.random() * 180 - 90).toFixed(6),
      longitude: (Math.random() * 360 - 180).toFixed(6)
    }
  },

  generateParticipantData(role: string) {
    return {
      name: `Test ${role} ${Math.random().toString(36).slice(7)}`,
      role,
      latitude: (Math.random() * 180 - 90).toFixed(6),
      longitude: (Math.random() * 360 - 180).toFixed(6)
    }
  },

  generateIncentiveData() {
    return {
      wasteType: 'Metal',
      rewardPoints: (Math.random() * 200 + 50).toFixed(0),
      budget: (Math.random() * 100_000 + 10_000).toFixed(0)
    }
  }
} as const

// ─── Class-based façade (backwards-compatible with old TestHelpers import) ────

/**
 * Object-oriented wrapper around the helpers above.
 *
 * @deprecated Prefer the standalone named exports.  This class is kept for
 * backward-compatibility while existing specs are migrated.
 */
export class TestHelpers {
  constructor(private readonly page: Page) {}

  mockWalletConnection = () => seedWalletConnection(this.page)
  mockContractCalls = () =>
    this.page.route('**/api/contract/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { txHash: 'mock_tx_hash' } })
      })
    )
  waitForTransaction = (timeout?: number) => waitForTransaction(this.page, timeout)
  fillWasteForm = (data: Parameters<typeof fillWasteForm>[1]) => fillWasteForm(this.page, data)
  fillRegistrationForm = (data: Parameters<typeof fillRegistrationForm>[1]) =>
    fillRegistrationForm(this.page, data)
  assertVisible = (selector: string, timeout?: number) =>
    assertVisible(this.page, selector, timeout)
  assertTextContains = (selector: string, text: string) =>
    assertTextContains(this.page, selector, text)
  takeScreenshot = (name: string) => takeScreenshot(this.page, name)
  waitForApiResponse = (urlPattern: string, timeout?: number) =>
    waitForApiResponse(this.page, urlPattern, timeout)
  navigateTo = (path: string) => navigateTo(this.page, path)
  checkConsoleErrors = () => collectConsoleErrors(this.page)
  mockGeolocation = (lat: number, lon: number) => mockGeolocation(this.page, lat, lon)
  searchWaste = async (query: string) => {
    await this.page.fill('[data-testid="search-input"]', query)
    await this.page.click('[data-testid="search-button"]')
    await this.page.waitForSelector('[data-testid="search-results"]')
  }
  applyFilters = async (filters: Record<string, string>) => {
    for (const [key, value] of Object.entries(filters)) {
      await this.page.fill(`[data-testid="filter-${key}"]`, value)
    }
    await this.page.click('[data-testid="apply-filters"]')
  }
  verifyTableHasRows = (selector: string, minRows?: number) =>
    verifyTableHasRows(this.page, selector, minRows)
  waitForLoadingComplete = () => waitForLoadingComplete(this.page)
  checkAccessibility = () =>
    this.page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (window as any).axe !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = await (window as any).axe.run()
        return results.violations
      }
      return []
    })
  testKeyboardNav = (tabCount: number) => tabThrough(this.page, tabCount)
  mockDateTime = (date: Date) => mockDateTime(this.page, date)
  submitForm = (formSelector: string, data: Record<string, string>) =>
    submitForm(this.page, formSelector, data)
  verifyNotification = (message: string, type?: 'success' | 'error' | 'info') =>
    verifyNotification(this.page, message, type)
  downloadFile = (buttonSelector: string) => downloadFile(this.page, buttonSelector)
}

/** @deprecated Use standalone helpers or TestDataFactory. */
export class PerformanceHelpers {
  static measurePageLoad = measurePageLoad
  static measureRenderTime = measureRenderTime
  static getMemoryUsage = getMemoryUsage
  static measureApiResponseTime = async (
    page: Page,
    apiUrl: string,
    action: () => Promise<void>
  ): Promise<number> => {
    const start = Date.now()
    const responsePromise = page.waitForResponse((r) => r.url().includes(apiUrl))
    await action()
    await responsePromise
    return Date.now() - start
  }
}

/** @deprecated Use standalone helpers. */
export class VisualRegressionHelpers {
  static async compareScreenshot(page: Page, name: string, options?: Record<string, unknown>) {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    return page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
      ...options
    })
  }

  static async compareElement(page: Page, selector: string, name: string) {
    const element = page.locator(selector)
    await element.waitFor({ state: 'visible' })
    return element.screenshot({
      path: `test-results/screenshots/${name}-element.png`
    })
  }
}
