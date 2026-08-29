# Scavngr E2E Test Suite

End-to-end tests for the Scavngr frontend, running with [Playwright](https://playwright.dev/).

## ⭐ Canonical Smoke Test

**`waste-submission-verification-reward.spec.ts`** is the **canonical smoke test** for the platform.

It covers the full happy-path supply chain flow in a single E2E test:

```
Wallet connection + recycler registration (seeded via mocks)
       │
  POST /api/waste/submit          – Waste Submission
       │
  GET  /api/indexer/waste/:id     – Indexer state assertion (isConfirmed = false)
       │
  POST /api/waste/verify/:id      – Waste Verification
       │
  POST /api/rewards               – Reward Distribution
       │
  GET  /api/indexer/waste/:id     – On-chain state assertion (isConfirmed = true, rewardDistributed = true)
       │
  Dashboard reward assertion
```

All Stellar RPC and API calls are intercepted via `page.route()` — no real network traffic required. The Freighter wallet extension is stubbed with `seedWalletConnection()`.

> This test should be included in every CI smoke run and treated as the first signal of a broken deployment.

## Running the Tests

```bash
# Run all E2E tests
npx playwright test

# Run only the canonical smoke test
npx playwright test e2e/waste-submission-verification-reward.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Run with headed browsers
npx playwright test --headed
```

## Test Organization

| File | Description |
|------|-------------|
| `waste-submission-verification-reward.spec.ts` | **Canonical smoke test** — full happy-path flow (Issue #1118) |
| `core-flows.spec.ts` | Core user flow tests |
| `smoke.spec.ts` | Quick smoke checks |
| `smoke-build.spec.ts` | Build verification smoke tests |
| `user-registration.spec.ts` | Participant registration flow |
| `waste-submission.spec.ts` | Waste submission form tests |
| `waste-transfer.spec.ts` | Waste transfer flow |
| `incentive-creation.spec.ts` | Incentive creation flow |
| `admin-operations.spec.ts` | Admin operations |
| `accessibility.spec.ts` | Accessibility checks (axe-core) |
| `keyboard-navigation.spec.ts` | Keyboard navigation |
| `visual-regression.spec.ts` | Visual regression snapshots |
| `dispute-resolution.spec.ts` | Dispute resolution flow |
| `tests.spec.ts` | Combined flow tests |

## Shared Utilities

| Path | Purpose |
|------|---------|
| `test-utils.ts` | Canonical helpers: `seedWalletConnection`, `seedApiRoutes`, `seedLocalStorageAuth`, `waitForAppReady`, `dismissNotifications` |
| `fixtures/test-data.ts` | Test data constants (participants, waste types, incentives) |
| `fixtures/seed.ts` | Backwards-compatible re-export shim → imports from `test-utils` |
| `pages/index.ts` | Page object models (LoginPage, RegistrationPage, WasteSubmissionPage, etc.) |
| `helpers/test-helpers.ts` | Low-level test helpers |

## Playwright Configuration

- **Default config**: `../../playwright.config.ts` (root)
- **Smoke-build config**: `playwright.smoke-build.config.ts`
- **Local override**: `playwright.config.ts`

## Coverage Requirements

The canonical smoke test (`waste-submission-verification-reward.spec.ts`) must:

- ✅ Cover the full happy-path flow in one continuous E2E test
- ✅ Assert on-chain state via indexer query (not just UI state)
- ✅ Use page objects from `pages/index.ts`
- ✅ Use fixtures from `fixtures/test-data.ts`
- ✅ Mock all network calls via `page.route()` (no live network traffic)
- ✅ Be marked as the canonical smoke test in this README
