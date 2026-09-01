# Testing & Quality Assurance

## Overview

This document outlines the comprehensive testing and quality assurance strategy for Scavngr, covering unit tests, integration tests, end-to-end tests, and quality metrics.

---

## Testing Strategy

### Test Pyramid

```
        E2E Tests (23 tests)
       /                    \
      /   Integration Tests  \
     /     (50+ tests)        \
    /                          \
   /___________________________\
   Unit Tests (200+ tests)
```

### Test Coverage Goals

- **Unit Tests**: 80%+ code coverage
- **Integration Tests**: All contract functions
- **E2E Tests**: All user workflows
- **Overall**: 85%+ code coverage

---

## Unit Testing

### Rust Contract Tests

Located in `stellar-contract/tests/`

#### Test Categories

1. **Participant Management** (30+ tests)
   - Registration with all roles
   - Role updates
   - Deregistration
   - Location validation
   - Duplicate prevention

2. **Waste Management** (50+ tests)
   - Submission for all waste types
   - Weight validation
   - Coordinate validation
   - Waste retrieval
   - Waste deactivation

3. **Transfer Operations** (40+ tests)
   - Valid transfer paths
   - Invalid transfer paths
   - Transfer history tracking
   - Ownership updates
   - Location recording

4. **Incentive Management** (35+ tests)
   - Creation by manufacturers
   - Budget tracking
   - Reward calculation
   - Deactivation
   - Query functions

5. **Admin Operations** (25+ tests)
   - Token address management
   - Charity contract management
   - Percentage configuration
   - Admin transfer
   - Authorization checks

6. **Edge Cases** (30+ tests)
   - Boundary values
   - Zero amounts
   - Maximum values
   - Concurrent operations
   - Reentrancy protection

#### Running Unit Tests

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_participant_registration

# Run with output
cargo test -- --nocapture

# Run with specific thread count
cargo test -- --test-threads=1

# Generate coverage report
cargo tarpaulin --out Html
```

#### Test Example

```rust
#[test]
fn test_participant_registration() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let participant_address = Address::random(&env);
    let role = ParticipantRole::Recycler;

    client.register_participant(
        &participant_address,
        &role,
        &String::from_slice(&env, "Test Recycler"),
        &40.7128,
        &-74.006,
    );

    let participant = client.get_participant(&participant_address);
    assert_eq!(participant.role, role);
    assert_eq!(participant.name, "Test Recycler");
}
```

### Frontend Tests

Located in `frontend/src/test/`

#### Test Categories

1. **Component Tests** (20+ tests)
   - Registration form
   - Waste submission form
   - Transfer form
   - Incentive form
   - Admin panel

2. **Hook Tests** (15+ tests)
   - useContractInteraction
   - useParticipantData
   - useWasteData
   - useIncentiveData

3. **Utility Tests** (10+ tests)
   - Validation functions
   - Formatting functions
   - Calculation functions

#### Running Frontend Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Generate coverage report
npm test -- --coverage

# Run specific test file
npm test -- src/components/RegistrationForm.test.tsx
```

---

## Integration Testing

### Contract Integration Tests

Located in `stellar-contract/tests/integration_test.rs`

#### Test Scenarios

1. **Complete Participant Lifecycle**
   - Register → Update → Deregister
   - Verify state transitions
   - Check event emissions

2. **Waste Supply Chain**
   - Submit → Transfer → Verify → Confirm
   - Track ownership changes
   - Validate transfer history

3. **Incentive Workflow**
   - Create → Update → Distribute → Deactivate
   - Verify budget tracking
   - Check reward calculations

4. **Multi-Participant Scenarios**
   - Multiple recyclers
   - Multiple collectors
   - Multiple manufacturers
   - Complex transfer chains

#### Running Integration Tests

```bash
# Run integration tests
cargo test --test integration_test

# Run with logging
RUST_LOG=debug cargo test --test integration_test -- --nocapture
```

---

## End-to-End Testing

### E2E Test Suite

Located in `frontend/e2e/`

#### Test Coverage

- **23 comprehensive tests** covering all user workflows
- **Multi-browser support**: Chromium, Firefox, WebKit
- **Visual regression testing**: Screenshot comparison
- **Performance monitoring**: Load time tracking

#### Test Categories

1. **User Registration** (4 tests)
   - Recycler registration
   - Collector registration
   - Manufacturer registration
   - Invalid input handling

2. **Waste Submission** (5 tests)
   - Paper waste
   - Plastic waste
   - Metal waste
   - Glass waste
   - Organic waste

3. **Waste Transfer** (3 tests)
   - Recycler to Collector
   - Collector to Manufacturer
   - Transfer with notes

4. **Incentive Management** (5 tests)
   - Create incentive
   - Update incentive
   - Deactivate incentive
   - Multiple incentives

5. **Admin Operations** (3 tests)
   - Set token address
   - Set charity contract
   - Configure percentages

6. **Dashboard** (2 tests)
   - Global metrics
   - Participant statistics

7. **Supply Chain Flow** (1 test)
   - Complete end-to-end workflow

#### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run in headed mode
npm run test:e2e:headed

# Run in debug mode
npm run test:e2e:debug

# View test report
npm run test:e2e:report

# Run specific test file
npx playwright test e2e/tests.spec.ts

# Run specific test
npx playwright test -g "should register a recycler"
```

---

## Quality Metrics

### Code Coverage

```bash
# Generate coverage report
cargo tarpaulin --out Html --output-dir coverage

# View report
open coverage/index.html
```

**Target Coverage**: 85%+

### Code Quality

#### Rust Linting

```bash
# Run clippy
cargo clippy -- -D warnings

# Format code
cargo fmt

# Check formatting
cargo fmt -- --check
```

#### TypeScript Linting

```bash
# Run ESLint
npm run lint

# Fix issues
npm run lint -- --fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Performance Metrics

#### Contract Performance

```bash
# Run performance tests
cargo test --test performance_test -- --nocapture

# Measure gas usage
cargo test --test gas_test -- --nocapture
```

#### Frontend Performance

```bash
# Run Lighthouse audit
npm run lighthouse

# Check bundle size
npm run build -- --analyze
```

---

## Continuous Integration

### GitHub Actions Workflow

Located in `.github/workflows/ci.yml`

#### Rust Quality Checks

```yaml
- name: Format check
  run: cargo fmt -- --check

- name: Clippy
  run: cargo clippy -- -D warnings

- name: Unit tests
  run: cargo test

- name: Security audit
  run: cargo audit
```

#### Frontend Quality Checks

```yaml
- name: Format check
  run: npm run format:check

- name: ESLint
  run: npm run lint

- name: TypeScript check
  run: npx tsc --noEmit

- name: Unit tests
  run: npm test

- name: Build
  run: npm run build
```

#### E2E Tests

```yaml
- name: E2E tests
  run: npm run test:e2e

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

---

## Testing Checklist

### Pre-Release

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Code coverage > 85%
- [ ] No ESLint warnings
- [ ] No Clippy warnings
- [ ] No TypeScript errors
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation updated

### Deployment

- [ ] Staging environment tested
- [ ] Smoke tests passed
- [ ] Performance acceptable
- [ ] No critical issues
- [ ] Rollback plan ready
- [ ] Monitoring configured

---

## Test Data Management

### Test Fixtures

Located in `frontend/e2e/fixtures/test-data.ts`

```typescript
export const testData = {
  participants: { /* ... */ },
  waste: { /* ... */ },
  incentives: { /* ... */ },
};
```

### Database Seeding

```bash
# Seed test database
npm run seed:test

# Reset test database
npm run reset:test
```

---

## Debugging Tests

### Rust Tests

```bash
# Run with backtrace
RUST_BACKTRACE=1 cargo test

# Run with logging
RUST_LOG=debug cargo test -- --nocapture

# Debug specific test
rust-gdb --args cargo test test_name
```

### Frontend Tests

```bash
# Debug in browser
npm test -- --debug

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage
```

### E2E Tests

```bash
# Debug mode
npm run test:e2e:debug

# Headed mode
npm run test:e2e:headed

# Trace viewer
npx playwright show-trace trace.zip
```

---

## Performance Testing

### Load Testing

```bash
# Run k6 load test
k6 run performance/k6-load-test.js

# With custom parameters
k6 run -e USERS=100 -e DURATION=5m performance/k6-load-test.js
```

### Benchmark Tests

```bash
# Run Rust benchmarks
cargo bench

# Run frontend benchmarks
npm run bench
```

---

## Security Testing

### Dependency Audits

```bash
# Rust dependencies
cargo audit

# Node dependencies
npm audit

# Fix vulnerabilities
npm audit fix
```

### Code Analysis

```bash
# SAST with Clippy
cargo clippy -- -D warnings

# ESLint security rules
npm run lint
```

---

## Test Maintenance

### Regular Tasks

- **Weekly**: Review test failures and flaky tests
- **Monthly**: Update test data and fixtures
- **Quarterly**: Review test coverage and add missing tests
- **Annually**: Audit test infrastructure and tools

### Flaky Test Management

1. Identify flaky tests
2. Analyze root cause
3. Fix underlying issue
4. Add retry logic if needed
5. Monitor for recurrence

---

## Documentation

### Test Documentation

- [E2E Testing Guide](./E2E_TESTING.md)
- [Test Coverage Report](./TEST_COVERAGE_REPORT.md)
- [Contributing Guide](../CONTRIBUTING.md)

### Related Resources

- [Rust Testing Book](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Playwright Documentation](https://playwright.dev)
- [Vitest Documentation](https://vitest.dev)

---

## Support

For testing issues:

1. Check test logs and error messages
2. Review test documentation
3. Check GitHub issues for similar problems
4. Contact development team

---

## Summary

| Test Type | Count | Coverage | Tools |
|-----------|-------|----------|-------|
| Unit Tests | 200+ | 80%+ | Cargo, Vitest |
| Integration Tests | 50+ | 100% | Cargo |
| E2E Tests | 23 | All workflows | Playwright |
| **Total** | **273+** | **85%+** | **Multiple** |

This comprehensive testing strategy ensures code quality, reliability, and user satisfaction across all components of the Scavngr platform.
