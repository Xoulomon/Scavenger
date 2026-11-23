import { defineConfig, devices } from '@playwright/test'

const isSmoke = process.env.SMOKE === '1'
// Smoke tests run against a live deployment; all other tests use the dev server.
const baseURL = isSmoke
  ? (process.env.PLAYWRIGHT_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:5173')
  : 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }]
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  // Snapshot comparison settings
  expect: {
    toHaveScreenshot: {
      // Allow up to 0.2% pixel difference to handle anti-aliasing across OS/GPU
      maxDiffPixelRatio: 0.002,
      // Snapshots stored per-project so chrome/firefox baselines are separate
      animations: 'disabled'
    }
  },

  projects: [
    // ── Standard E2E (non-visual) ──────────────────────────────────────────
    {
      name: 'chromium',
      testIgnore: '**/visual-regression.spec.ts',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      testIgnore: '**/visual-regression.spec.ts',
      use: { ...devices['Desktop Firefox'] }
    },

    // ── Visual Regression ─────────────────────────────────────────────────
    {
      name: 'visual-chromium',
      testMatch: '**/visual-regression.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 }
      },
      snapshotPathTemplate: '{testDir}/__snapshots__/{projectName}/{testFilePath}/{arg}{ext}'
    },
    {
      name: 'visual-firefox',
      testMatch: '**/visual-regression.spec.ts',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 800 }
      },
      snapshotPathTemplate: '{testDir}/__snapshots__/{projectName}/{testFilePath}/{arg}{ext}'
    },
    {
      name: 'visual-mobile',
      testMatch: '**/visual-regression.spec.ts',
      use: {
        ...devices['Pixel 5']
      },
      snapshotPathTemplate: '{testDir}/__snapshots__/{projectName}/{testFilePath}/{arg}{ext}'
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
})
