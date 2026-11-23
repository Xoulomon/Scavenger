/**
 * #962 – Playwright configuration for post-build smoke tests.
 *
 * Runs smoke-build.spec.ts against the compiled dist/ artefact using
 * `vite preview` as the web server (or against an external URL when
 * SMOKE_BUILD_URL is set).
 *
 * Usage
 * -----
 *   # Full build + smoke run (from /frontend):
 *   npm run build && npx playwright test --config e2e/playwright.smoke-build.config.ts
 *
 *   # Against a deployed URL:
 *   SMOKE_BUILD_URL=https://staging.example.com \
 *     npx playwright test --config e2e/playwright.smoke-build.config.ts
 */

import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const externalUrl = process.env.SMOKE_BUILD_URL
const previewPort = parseInt(process.env.SMOKE_BUILD_PORT ?? '4173', 10)
const baseURL = externalUrl ?? `http://localhost:${previewPort}`

export default defineConfig({
  // Only execute the post-build smoke spec.
  testMatch: '**/smoke-build.spec.ts',

  // Do NOT use the dev-server webServer stanza when targeting an external URL.
  webServer: externalUrl
    ? undefined
    : {
        // `vite preview` serves the already-built dist/ directory.
        command: `npx vite preview --port ${previewPort} --strictPort`,
        url: `http://localhost:${previewPort}`,
        reuseExistingServer: !process.env.CI,
        // Give the preview server up to 30 s to start.
        timeout: 30_000,
        cwd: path.join(__dirname, '..')
      },

  use: {
    baseURL,
    // Smoke tests are fast; a short global timeout is fine.
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    // Capture screenshots/traces only on failure so CI artefacts stay small.
    screenshot: 'only-on-failure',
    trace: 'on-first-retry'
  },

  // Fail fast on the first test failure in CI.
  maxFailures: process.env.CI ? 1 : undefined,

  // Single retry in CI to absorb flakiness caused by server cold-start.
  retries: process.env.CI ? 1 : 0,

  // Run serially to keep resource usage predictable.
  workers: 1,

  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: path.join(__dirname, '..', 'playwright-report', 'smoke-build'),
        open: 'never'
      }
    ],
    [
      'json',
      {
        outputFile: path.join(__dirname, '..', 'playwright-report', 'smoke-build', 'results.json')
      }
    ]
  ],

  projects: [
    {
      name: 'smoke-chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
