# Indexer Test Setup

## Overview

This directory contains integration tests for the `scavngr-indexer` package.

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Test Structure

- `tests/*.test.ts` — Unit and integration tests using Jest
- `tests/integration/` — Dedicated integration tests (e.g., `job-queue.test.ts`)
- `tests/migration/` — Database migration tests
- `tests/mocks/` — Mock fixtures for test isolation

## Job Queue Integration Tests

The `job-queue.test.ts` and `jobs-integration.test.ts` files test the `JobQueue` class
from `src/jobs/job-queue.ts`. They cover:

- **Enqueue/retrieve**: Basic job lifecycle
- **Processing**: Job execution with registered processors
- **Retry**: Failed jobs are retried with configurable max attempts
- **Backoff**: Retry delays between attempts
- **Dead-letter**: Jobs marked FAILED after exhausting max attempts
- **Priority**: Jobs processed according to priority level
- **Scheduling**: Recurring job scheduling with cron expressions
- **Statistics**: Queue metrics tracking
- **Idempotency**: Completed jobs don't duplicate on re-enqueue

### Test Backend

Integration tests use an in-memory mock Redis client (`createMockRedisClient`)
to ensure determinism without requiring a live Redis instance. The mock simulates
sorted-set and hash operations used by `JobQueue`.

For the live Redis test (`job-queue.test.ts`), start Redis locally:
```bash
redis-server --port 6379
```

## Required Setup

```bash
cd indexer
npm install
npm run build
```

## Test Environment

- **Test runner**: Jest with `ts-jest` preset
- **Environment**: Node.js
- **Coverage threshold**: 70% lines, 70% functions, 60% branches
