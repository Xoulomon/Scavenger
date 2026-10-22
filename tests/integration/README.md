# Integration Tests

Comprehensive integration tests for the Scavenger platform covering all system components.

## Overview

This test suite includes 15+ integration tests covering:
- Contract-Frontend integration
- Contract-Backend integration
- Database integration
- Event handling
- External API integration

## Test Categories

### 1. Contract-Frontend Integration (6 tests)
- Participant registration through frontend API
- Participant data retrieval from contract
- Waste submission and verification
- Role updates
- Statistics tracking
- Concurrent operations

### 2. Contract-Backend Integration (7 tests)
- Participant data synchronization
- Waste transfer handling
- Incentive data consistency
- Batch operations
- Reward distribution
- Error handling
- Transaction integrity

### 3. Database Integration (5 tests)
- Data persistence
- Referential integrity
- Concurrent writes
- Transaction support
- Query consistency

### 4. Event Handling (6 tests)
- Participant registered events
- Waste submitted events
- Waste transferred events
- Incentive created events
- Event ordering
- Event propagation

### 5. External API Integration (3 tests)
- Stellar testnet integration
- Rate limiting
- Timeout handling

## Setup

These tests run against a live environment. Set one up using the canonical guide
first — Node.js, Docker, the Stellar network, Postgres, and the deployed contract are
all covered there:

➡️ **[Developer Onboarding Guide](../../docs/DEVELOPER_ONBOARDING.md#development-environment-setup)**

Then install and configure this suite:

```bash
pnpm install
```

Create a `.env` in this directory pointing at your running environment:

```env
API_URL=http://localhost:3000/api
CONTRACT_ID=your-contract-id
DATABASE_URL=postgresql://user:password@localhost:5432/scavenger
STELLAR_NETWORK=testnet
```

Set `CONTRACT_ID` to the contract you deployed during setup. If you brought the stack
up with `docker compose`, `DATABASE_URL` is
`postgresql://scavngr:scavngr_dev@localhost:5432/scavngr`.

## Running Tests

### All Integration Tests (from repo root)

```bash
pnpm test:integration
```

### Specific Test Suites (from this directory)

```bash
# All integration tests
pnpm test

# Contract-Frontend integration
pnpm run test:contract

# Contract-Backend integration
pnpm run test:backend

# Watch mode
pnpm run test:watch
```

## Test Fixtures

### Mock Data

Test fixtures are automatically created for each test:
- Test participants with unique IDs
- Test waste materials
- Test incentives
- Test transfers

### Cleanup

Tests automatically clean up after themselves:
- Remove test participants
- Remove test waste
- Remove test incentives
- Restore database state

## CI/CD Integration

### GitHub Actions

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm test:integration
```

## Troubleshooting

### Connection Errors

**Error**: `ECONNREFUSED`

**Solution**:
- Verify API is running
- Check API_URL environment variable
- Check network connectivity

### Database Errors

**Error**: `ENOTFOUND`

**Solution**:
- Verify database is running
- Check DATABASE_URL environment variable
- Check database credentials

### Timeout Errors

**Error**: `ETIMEDOUT`

**Solution**:
- Increase timeout in test configuration
- Check system resources
- Check network latency

### Test Failures

**Error**: `AssertionError`

**Solution**:
- Check test logs
- Verify test data
- Check API responses
- Review error messages

## Performance Considerations

### Test Execution Time

- Total suite: ~5-10 minutes
- Individual test: ~100-500ms
- Parallel execution: ~2-3 minutes

### Resource Usage

- Memory: ~200MB
- CPU: ~50%
- Network: ~10MB

## Best Practices

### Writing Tests

1. Use descriptive test names
2. Test one thing per test
3. Use fixtures for setup
4. Clean up after tests
5. Handle async operations

### Running Tests

1. Run tests before committing
2. Run full suite before pushing
3. Monitor test performance
4. Review test coverage
5. Update tests with code changes

## References

- [Vitest Documentation](https://vitest.dev/)
- [Axios Documentation](https://axios-http.com/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Integration Testing Guide](https://martinfowler.com/bliki/IntegrationTest.html)
