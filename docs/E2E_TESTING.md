# E2E Testing Suite

## Overview

This document describes the comprehensive end-to-end (E2E) testing suite for Scavngr, covering all major user workflows and system interactions.

---

## Setup

### Prerequisites

- Node.js 16+
- npm or yarn
- Playwright installed

### Installation

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install

# Install dependencies
npm install
```

### Configuration

The test suite is configured in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
})
```

---

## Running Tests

### Run All Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test e2e/tests.spec.ts
```

### Run Tests in Headed Mode (See Browser)

```bash
npx playwright test --headed
```

### Run Tests in Debug Mode

```bash
npx playwright test --debug
```

### Run Tests for Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run Tests with Specific Tag

```bash
npx playwright test --grep @smoke
```

---

## Test Structure

### Test Suites

#### 1. User Registration Flow (4 tests)

Tests participant registration for all roles:

- **Register Recycler**: Validates recycler participant creation
- **Register Collector**: Validates collector participant creation
- **Register Manufacturer**: Validates manufacturer participant creation
- **Reject Invalid Coordinates**: Validates coordinate validation

**Location**: `e2e/tests.spec.ts` - `User Registration Flow`

#### 2. Waste Submission Flow (5 tests)

Tests waste submission for all waste types:

- **Submit Paper Waste**: Paper waste submission
- **Submit Plastic Waste**: Plastic waste submission
- **Submit Metal Waste**: Metal waste submission
- **Submit Glass Waste**: Glass waste submission
- **Submit Organic Waste**: Organic waste submission

**Location**: `e2e/tests.spec.ts` - `Waste Submission Flow`

#### 3. Waste Transfer Workflow (3 tests)

Tests waste transfers between participants:

- **Transfer Recycler to Collector**: Validates transfer from recycler to collector
- **Transfer Collector to Manufacturer**: Validates transfer from collector to manufacturer
- **Include Transfer Notes**: Validates transfer with notes

**Location**: `e2e/tests.spec.ts` - `Waste Transfer Workflow`

#### 4. Incentive Creation Flow (5 tests)

Tests incentive management:

- **Create Paper Incentive**: Creates paper waste incentive
- **Create Plastic Incentive**: Creates plastic waste incentive
- **Create Metal Incentive**: Creates metal waste incentive
- **Update Incentive**: Updates existing incentive
- **Deactivate Incentive**: Deactivates incentive

**Location**: `e2e/tests.spec.ts` - `Incentive Creation Flow`

#### 5. Admin Operations (3 tests)

Tests admin functions:

- **Set Token Address**: Sets reward token address
- **Set Charity Contract**: Sets charity contract address
- **Set Reward Percentages**: Configures reward distribution percentages

**Location**: `e2e/tests.spec.ts` - `Admin Operations`

#### 6. Dashboard and Metrics (2 tests)

Tests dashboard functionality:

- **Display Global Metrics**: Validates metrics display
- **Display Participant Statistics**: Validates participant stats display

**Location**: `e2e/tests.spec.ts` - `Dashboard and Metrics`

#### 7. Complete Supply Chain Flow (1 test)

End-to-end integration test:

- **Complete Recycler to Collector to Manufacturer Flow**: Full workflow from registration through incentive creation

**Location**: `e2e/tests.spec.ts` - `Complete Supply Chain Flow`

---

## Page Objects

Page objects encapsulate UI interactions and element selectors for maintainability.

### LoginPage

```typescript
class LoginPage {
  async goto()
  async login(email: string, password: string)
  async isLoggedIn()
}
```

### RegistrationPage

```typescript
class RegistrationPage {
  async goto()
  async registerParticipant(name, role, lat, lon)
  async getSuccessMessage()
  async getErrorMessage()
}
```

### WasteSubmissionPage

```typescript
class WasteSubmissionPage {
  async goto()
  async submitWaste(wasteType, weight, lat, lon)
  async getWasteId()
}
```

### WasteTransferPage

```typescript
class WasteTransferPage {
  async goto()
  async transferWaste(wasteId, recipient, lat, lon, note?)
  async getSuccessMessage()
}
```

### IncentiveManagementPage

```typescript
class IncentiveManagementPage {
  async goto()
  async createIncentive(wasteType, rewardPoints, budget)
  async updateIncentive(incentiveId, rewardPoints, budget)
  async deactivateIncentive(incentiveId)
  async getIncentiveList()
}
```

### AdminPage

```typescript
class AdminPage {
  async goto()
  async setTokenAddress(tokenAddress)
  async setCharityContract(charityAddress)
  async setRewardPercentages(collectorPct, ownerPct)
  async getSuccessMessage()
}
```

### DashboardPage

```typescript
class DashboardPage {
  async goto()
  async getMetrics()
  async getParticipantStats()
}
```

---

## Test Data

Test data is centralized in `e2e/fixtures/test-data.ts`:

```typescript
export const testData = {
  participants: {
    recycler: { name, role, lat, lon },
    collector: { name, role, lat, lon },
    manufacturer: { name, role, lat, lon }
  },
  waste: {
    paper: { type, weight, lat, lon },
    plastic: { type, weight, lat, lon },
    metal: { type, weight, lat, lon },
    glass: { type, weight, lat, lon },
    organic: { type, weight, lat, lon }
  },
  incentives: {
    paperIncentive: { wasteType, rewardPoints, budget },
    plasticIncentive: { wasteType, rewardPoints, budget },
    metalIncentive: { wasteType, rewardPoints, budget }
  }
}
```

---

## Visual Regression Testing

Screenshots are automatically captured on test failures:

```bash
# Run tests with screenshots
npx playwright test --screenshot=only-on-failure

# View screenshots
npx playwright show-report
```

---

## CI/CD Integration

### GitHub Actions

Tests run automatically on push and pull requests:

```yaml
- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

### Local Pre-commit Hook

```bash
#!/bin/bash
npm run test:e2e
if [ $? -ne 0 ]; then
  echo "E2E tests failed. Commit aborted."
  exit 1
fi
```

---

## Debugging

### View Test Report

```bash
npx playwright show-report
```

### Debug Single Test

```bash
npx playwright test e2e/tests.spec.ts:10 --debug
```

### Trace Viewer

```bash
npx playwright show-trace trace.zip
```

### Browser DevTools

```bash
npx playwright test --headed --debug
```

---

## Best Practices

1. **Use Page Objects**: Encapsulate UI interactions in page objects
2. **Centralize Test Data**: Keep test data in fixtures
3. **Meaningful Assertions**: Use clear, specific assertions
4. **Avoid Hard Waits**: Use Playwright's auto-waiting
5. **Test Independence**: Each test should be independent
6. **Descriptive Names**: Use clear test names
7. **Error Handling**: Capture and report errors clearly
8. **Parallel Execution**: Run tests in parallel when possible

---

## Troubleshooting

### Tests Timeout

```bash
# Increase timeout
npx playwright test --timeout=60000
```

### Browser Crashes

```bash
# Run in headed mode to see what's happening
npx playwright test --headed
```

### Flaky Tests

- Use explicit waits instead of hard waits
- Ensure test data is properly isolated
- Check for race conditions
- Increase timeout for slow operations

### Element Not Found

- Verify selectors in browser DevTools
- Check if element is visible/enabled
- Use `waitForSelector` if needed

---

## Test Coverage

Current test coverage includes:

- ✅ User registration (all roles)
- ✅ Waste submission (all types)
- ✅ Waste transfers (all paths)
- ✅ Incentive management (create, update, deactivate)
- ✅ Admin operations (token, charity, percentages)
- ✅ Dashboard metrics
- ✅ Complete supply chain flow

**Total Tests**: 23
**Coverage**: All major user workflows

---

## Future Enhancements

- [ ] Performance testing (load times, response times)
- [ ] Accessibility testing (WCAG compliance)
- [ ] Mobile device testing
- [ ] Network error scenarios
- [ ] Concurrent user testing
- [ ] Data persistence testing
- [ ] Security testing (XSS, CSRF)
- [ ] Internationalization testing

---

## Related Documentation

- [Playwright Documentation](https://playwright.dev)
- [Test Coverage Report](./TEST_COVERAGE_REPORT.md)
- [CI/CD Pipeline](./CI_CD_PIPELINE.md)
- [Contributing Guide](../CONTRIBUTING.md)
