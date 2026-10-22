# @scavenger/test-mocks

Shared Stellar RPC mock library for frontend and indexer tests.

## Overview

This package provides:

- **Typed RPC response factories** — Create consistent mock Stellar RPC responses
- **MSW integration** — Ready-to-use Mock Service Worker handlers
- **Recorded fixtures** — Pre-built responses based on real testnet data
- **Partial overrides** — Customize responses for specific test scenarios

## Installation

```bash
npm install --save-dev @scavenger/test-mocks
```

## Usage

### Basic Factory Usage

```typescript
import {
  createGetEventsResponse,
  createGetLedgerResponse,
  createSimulateTransactionResponse,
} from '@scavenger/test-mocks';

// Create a default response
const eventsResponse = createGetEventsResponse();

// Create a response with custom ledger
const customResponse = createGetEventsResponse({
  ledger: 75000,
  timestamp: new Date('2024-02-01T00:00:00Z'),
});
```

### MSW Handler Setup

```typescript
import { setupServer } from 'msw/node';
import { createStellarRpcHandlers } from '@scavenger/test-mocks';

// In your test setup file
export const server = setupServer(
  ...createStellarRpcHandlers('http://localhost:8000')
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Using Recorded Fixtures

```typescript
import {
  createWasteRegisteredEvent,
  createParticipantRegisteredEvent,
  createWasteTransferredEvent,
  createTokensRewardedEvent,
  createEventsBatchResponse,
} from '@scavenger/test-mocks';

// Create individual event fixtures
const wasteEvent = createWasteRegisteredEvent();
const participantEvent = createParticipantRegisteredEvent();

// Create a batch with multiple event types
const batchResponse = createEventsBatchResponse(
  [
    'waste_registered',
    'participant_registered',
    'waste_transferred',
    'tokens_rewarded',
  ],
  { ledger: 50000 }
);
```

### Overriding Response Data

```typescript
const customEvent = createWasteRegisteredEvent({
  contractId: 'CUSTOM_CONTRACT_ID',
  topic: ['custom_event', 'custom_id'],
});

const customBatch = createSimulateTransactionResponse({
  cpuInsn: '5000',
  memByte: '10000',
});
```

## API Reference

### Factories

#### `createGetEventsResponse(options?)`

Creates a mock `getEvents` RPC response.

**Options:**
- `ledger?: number` — Ledger sequence (default: 50000)
- `timestamp?: string | number` — ISO timestamp (default: 2024-01-15T12:00:00Z)
- `contractId?: string` — Contract ID (default: well-known test contract)
- `eventCount?: number` — Number of events to include (default: 1)

#### `createGetLedgerResponse(options?)`

Creates a mock `getLedger` RPC response.

#### `createSimulateTransactionResponse(options?)`

Creates a mock `simulateTransaction` RPC response.

**Additional Options:**
- `cpuInsn?: string` — CPU instructions (default: "1000")
- `memByte?: string` — Memory bytes (default: "2000")

### Recorded Fixtures

#### `createWasteRegisteredEvent(overrides?)`

Pre-configured waste registration event.

#### `createParticipantRegisteredEvent(overrides?)`

Pre-configured participant registration event.

#### `createWasteTransferredEvent(overrides?)`

Pre-configured waste transfer event.

#### `createTokensRewardedEvent(overrides?)`

Pre-configured token reward event.

#### `createEventsBatchResponse(eventTypes?, options?)`

Creates a batch response with specified event types.

**Parameters:**
- `eventTypes?: string[]` — Array of event type names
- `options?: RpcResponseFactoryOptions` — Response options

### MSW Handlers

#### `createStellarRpcHandlers(baseUrl?, options?)`

Creates a complete set of Stellar RPC mock handlers for MSW.

**Parameters:**
- `baseUrl?: string` — RPC server base URL (default: "http://localhost:8000")
- `options?: RpcResponseFactoryOptions` — Response options

## Re-recording Fixtures

To update fixtures against testnet:

```bash
npm run record
```

This script connects to Stellar testnet and records actual RPC responses for:
- `getEvents` — Contract event fetching
- `getLedger` — Ledger information retrieval
- `simulateTransaction` — Transaction simulation

Fixtures are stored in `src/fixtures/` and used by factory functions.

## Integration Examples

### Frontend Test

```typescript
import { render, screen } from '@testing-library/react';
import { setupServer } from 'msw/node';
import {
  createStellarRpcHandlers,
  createWasteRegisteredEvent,
} from '@scavenger/test-mocks';

const server = setupServer(
  ...createStellarRpcHandlers('http://localhost:8000', {
    ledger: 50000,
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('displays waste events', async () => {
  render(<WasteEventsList />);
  await screen.findByText(/waste registered/i);
});
```

### Indexer Test

```typescript
import { createGetEventsResponse } from '@scavenger/test-mocks';

test('processes waste events', async () => {
  const mockResponse = createGetEventsResponse({
    eventCount: 5,
  });

  const { events } = mockResponse;
  const result = await processEvents(events);

  expect(result.processed).toBe(5);
});
```

## Contributing

To add new fixture types:

1. Add factory function to `src/factories.ts`
2. Add TypeScript types to `src/types.ts`
3. Add test in `src/__tests__/factories.test.ts`
4. Update `README.md` with usage examples

## Related Documentation

- [Testing Guide](../../docs/TESTING_GUIDE.md)
- [Factory Helpers Guide](../../docs/FACTORY_HELPERS_GUIDE.md)
