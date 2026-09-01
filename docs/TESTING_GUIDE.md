# Testing Guide

Comprehensive testing strategy, guidelines, and best practices for Scavenger.

## Table of Contents

- [Testing Strategy](#testing-strategy)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [E2E Testing](#e2e-testing)
- [Test Coverage](#test-coverage)
- [Mocking and Fixtures](#mocking-and-fixtures)
- [CI/CD Integration](#cicd-integration)
- [Performance Testing](#performance-testing)

## Testing Strategy

### Overview

Scavenger uses a multi-layered testing approach:

1. **Unit Tests** — Test individual functions in isolation
2. **Integration Tests** — Test component interactions
3. **E2E Tests** — Test complete user workflows
4. **Performance Tests** — Validate performance requirements

### Test Pyramid

```
        /\
       /  \  E2E Tests (10%)
      /____\
     /      \
    /        \ Integration Tests (30%)
   /          \
  /____________\
 /              \
/                \ Unit Tests (60%)
/__________________\
```

### Coverage Goals

- **Overall:** 80% minimum
- **Critical paths:** 100%
- **New code:** 100%
- **Public APIs:** 100%

---

## Unit Testing

### Rust Smart Contract Tests

#### Test Structure

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_register_participant_success() {
        // Arrange
        let env = Env::default();
        let address = Address::random(&env);

        // Act
        let result = register_participant(
            &env,
            address.clone(),
            ParticipantRole::Recycler,
            "Test User".to_string(),
            0,
            0,
        );

        // Assert
        assert!(result.is_ok());
    }

    #[test]
    #[should_panic(expected = "invalid role")]
    fn test_register_participant_invalid_role() {
        let env = Env::default();
        // Test implementation
    }
}
```

#### Running Tests

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_register_participant

# Run with output
cargo test -- --nocapture

# Run with backtrace
RUST_BACKTRACE=1 cargo test

# Run single-threaded (for debugging)
cargo test -- --test-threads=1
```

#### Test Naming Convention

- `test_<function>_<scenario>` — `test_register_participant_success`
- `test_<function>_<error_case>` — `test_register_participant_invalid_role`
- `test_<function>_<edge_case>` — `test_register_participant_max_weight`

#### Common Patterns

**Testing Success Cases:**
```rust
#[test]
fn test_submit_material_success() {
    let env = Env::default();
    let submitter = Address::random(&env);

    let result = submit_material(
        &env,
        submitter,
        WasteType::Plastic,
        100,
        0,
        0,
    );

    assert!(result.is_ok());
    let waste_id = result.unwrap();
    assert_eq!(waste_id, 1);
}
```

**Testing Error Cases:**
```rust
#[test]
fn test_submit_material_unregistered_user() {
    let env = Env::default();
    let unregistered = Address::random(&env);

    let result = submit_material(
        &env,
        unregistered,
        WasteType::Plastic,
        100,
        0,
        0,
    );

    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Error::UnregisteredParticipant);
}
```

**Testing State Changes:**
```rust
#[test]
fn test_participant_stats_update() {
    let env = Env::default();
    let participant = Address::random(&env);

    // Register participant
    register_participant(&env, participant.clone(), ParticipantRole::Recycler, "Test", 0, 0).unwrap();

    // Submit material
    submit_material(&env, participant.clone(), WasteType::Plastic, 100, 0, 0).unwrap();

    // Verify stats updated
    let stats = get_stats(&env, participant);
    assert_eq!(stats.total_waste_submitted, 100);
}
```

### TypeScript/React Frontend Tests

#### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParticipantForm } from './participant-form';

describe('ParticipantForm', () => {
  let mockOnSubmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSubmit = vi.fn();
  });

  it('should render form fields', () => {
    render(<ParticipantForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
  });

  it('should call onSubmit with form data', async () => {
    const user = userEvent.setup();
    render(<ParticipantForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/name/i), 'John Doe');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'John Doe' })
    );
  });

  it('should display validation errors', async () => {
    const user = userEvent.setup();
    render(<ParticipantForm onSubmit={mockOnSubmit} />);

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });
});
```

#### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test participant-form

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run single test
npm test -- -t "should render form fields"
```

#### Test Utilities

**Setup and Teardown:**
```typescript
beforeEach(() => {
  // Setup before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});
```

**Mocking API Calls:**
```typescript
import { vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ id: 1, name: 'Test' }),
});
```

---

## Integration Testing

### Smart Contract Integration Tests

Integration tests verify interactions between contract functions:

```rust
#[test]
fn test_complete_waste_flow() {
    let env = Env::default();
    let recycler = Address::random(&env);
    let collector = Address::random(&env);

    // Register participants
    register_participant(&env, recycler.clone(), ParticipantRole::Recycler, "Recycler", 0, 0).unwrap();
    register_participant(&env, collector.clone(), ParticipantRole::Collector, "Collector", 0, 0).unwrap();

    // Submit material
    let waste_id = submit_material(&env, recycler.clone(), WasteType::Plastic, 100, 0, 0).unwrap();

    // Verify material
    verify_material(&env, waste_id, collector.clone()).unwrap();

    // Transfer waste
    transfer_waste(&env, waste_id, recycler.clone(), collector.clone(), 0, 0, "Transfer".to_string()).unwrap();

    // Verify final state
    let waste = get_waste(&env, waste_id).unwrap();
    assert_eq!(waste.owner, collector);
}
```

### Frontend Integration Tests

Integration tests verify component interactions:

```typescript
describe('Participant Registration Flow', () => {
  it('should complete full registration flow', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn().mockResolvedValue({ id: 1 });

    render(
      <RegistrationFlow onSuccess={mockSubmit} />
    );

    // Fill form
    await user.type(screen.getByLabelText(/name/i), 'John Doe');
    await user.selectOption(screen.getByLabelText(/role/i), 'Recycler');

    // Submit
    await user.click(screen.getByRole('button', { name: /register/i }));

    // Verify success
    await waitFor(() => {
      expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
    });
  });
});
```

---

## E2E Testing

### E2E Test Structure

E2E tests simulate real user workflows:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Participant Registration E2E', () => {
  test('should register new participant', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');

    // Click register button
    await page.click('text=Register');

    // Fill form
    await page.fill('input[name="name"]', 'John Doe');
    await page.selectOption('select[name="role"]', 'Recycler');
    await page.fill('input[name="latitude"]', '0');
    await page.fill('input[name="longitude"]', '0');

    // Submit
    await page.click('button:has-text("Register")');

    // Verify success
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=Welcome, John')).toBeVisible();
  });

  test('should submit waste material', async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button:has-text("Login")');

    // Navigate to submit
    await page.click('text=Submit Material');

    // Fill form
    await page.selectOption('select[name="wasteType"]', 'Plastic');
    await page.fill('input[name="weight"]', '100');

    // Submit
    await page.click('button:has-text("Submit")');

    // Verify success
    await expect(page.locator('text=Material submitted')).toBeVisible();
  });
});
```

### Running E2E Tests

```bash
# Install Playwright
npm install -D @playwright/test

# Run E2E tests
npx playwright test

# Run specific test
npx playwright test participant-registration

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

---

## Test Coverage

### Measuring Coverage

**Rust:**
```bash
# Install tarpaulin
cargo install cargo-tarpaulin

# Generate coverage report
cargo tarpaulin --out Html --output-dir coverage

# View report
open coverage/index.html
```

**TypeScript:**
```bash
# Generate coverage report
npm test -- --coverage

# View report
open coverage/index.html
```

### Coverage Requirements

- **New code:** 100% coverage required
- **Modified code:** No coverage reduction
- **Critical paths:** 100% coverage
- **Overall:** Minimum 80%

### Improving Coverage

1. **Identify uncovered lines:**
   ```bash
   # View coverage report
   npm test -- --coverage
   ```

2. **Add tests for uncovered code:**
   ```typescript
   it('should handle edge case', () => {
     // Test uncovered scenario
   });
   ```

3. **Verify coverage increased:**
   ```bash
   npm test -- --coverage
   ```

---

## Mocking and Fixtures

### Rust Fixtures

**Create reusable test data:**
```rust
mod fixtures {
    use super::*;
    use soroban_sdk::Env;

    pub fn create_test_env() -> Env {
        Env::default()
    }

    pub fn create_test_participant(env: &Env) -> Address {
        Address::random(env)
    }

    pub fn create_test_waste_data() -> (WasteType, u128, i32, i32) {
        (WasteType::Plastic, 100, 0, 0)
    }
}

#[test]
fn test_with_fixtures() {
    let env = fixtures::create_test_env();
    let participant = fixtures::create_test_participant(&env);
    let (waste_type, weight, lat, lon) = fixtures::create_test_waste_data();

    // Test implementation
}
```

### TypeScript Fixtures

**Create reusable test data:**
```typescript
export const mockParticipant = {
  id: '1',
  name: 'Test Participant',
  role: 'Recycler',
  address: '0x123...',
  registeredAt: new Date('2024-01-01'),
};

export const mockWaste = {
  id: '1',
  type: 'Plastic',
  weight: 100,
  submittedBy: mockParticipant.id,
  submittedAt: new Date('2024-01-02'),
};

export const createMockParticipant = (overrides = {}) => ({
  ...mockParticipant,
  ...overrides,
});
```

### Mocking API Calls

**Rust:**
```rust
#[test]
fn test_with_mock_storage() {
    let env = Env::default();

    // Mock storage operations
    let storage = env.storage().persistent();
    storage.set(&DataKey::Participant(address.clone()), &participant);

    // Test implementation
}
```

**TypeScript:**
```typescript
import { vi } from 'vitest';

const mockApi = {
  registerParticipant: vi.fn().mockResolvedValue({ id: '1' }),
  submitWaste: vi.fn().mockResolvedValue({ id: '1' }),
};

vi.mock('./api', () => ({ default: mockApi }));

it('should call API on submit', async () => {
  // Test implementation
  expect(mockApi.registerParticipant).toHaveBeenCalled();
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  rust-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: wasm32-unknown-unknown
      - name: Run tests
        run: cargo test
      - name: Generate coverage
        run: cargo tarpaulin --out Xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd frontend && npm install
      - name: Run tests
        run: cd frontend && npm test
      - name: Generate coverage
        run: cd frontend && npm test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Install Playwright
        run: npx playwright install
      - name: Run E2E tests
        run: npx playwright test
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit

# Create .pre-commit-config.yaml
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: local
    hooks:
      - id: rust-tests
        name: Rust tests
        entry: cargo test
        language: system
        pass_filenames: false
        stages: [commit]
      - id: frontend-tests
        name: Frontend tests
        entry: npm test
        language: system
        pass_filenames: false
        stages: [commit]
EOF

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

---

## Performance Testing

### Load Testing

**Using k6:**
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:8000/api/participants');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

**Run load test:**
```bash
# Install k6
brew install k6

# Run test
k6 run performance/k6-load-test.js
```

### Benchmarking

**Rust benchmarks:**
```rust
#![feature(test)]
extern crate test;

use test::Bencher;

#[bench]
fn bench_register_participant(b: &mut Bencher) {
    let env = Env::default();
    let address = Address::random(&env);

    b.iter(|| {
        register_participant(
            &env,
            address.clone(),
            ParticipantRole::Recycler,
            "Test".to_string(),
            0,
            0,
        )
    });
}
```

**Run benchmarks:**
```bash
cargo bench
```

---

## Best Practices

1. **Test behavior, not implementation** — Focus on what the code does, not how
2. **Keep tests focused** — One assertion per test when possible
3. **Use descriptive names** — Test names should explain what they test
4. **Avoid test interdependence** — Tests should run independently
5. **Mock external dependencies** — Isolate the code under test
6. **Test edge cases** — Boundary values, empty inputs, etc.
7. **Maintain test data** — Keep fixtures and mocks up to date
8. **Review test coverage** — Regularly check coverage reports
9. **Automate testing** — Use CI/CD to run tests automatically
10. **Document complex tests** — Add comments explaining non-obvious logic

---

## Troubleshooting

### Common Issues

**Tests fail locally but pass in CI:**
- Check environment variables
- Verify test data setup
- Check for timing issues
- Run tests in same order as CI

**Flaky tests:**
- Avoid hardcoded timeouts
- Use proper wait mechanisms
- Mock time-dependent code
- Check for race conditions

**Coverage not updating:**
- Clear coverage cache: `rm -rf coverage/`
- Rebuild: `cargo clean && cargo build`
- Regenerate: `npm test -- --coverage`

### Debug Commands

```bash
# Rust: Run single test with output
cargo test test_name -- --nocapture

# Rust: Run with backtrace
RUST_BACKTRACE=1 cargo test

# Frontend: Run single test
npm test -- -t "test name"

# Frontend: Debug mode
node --inspect-brk node_modules/.bin/vitest
```
