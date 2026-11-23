# Stellar RPC Mock Service

Central, reusable Stellar RPC mock factory for all unit and integration tests.

## Why this exists

Before this mock service, every test file that needed to exercise Stellar RPC
behaviour duplicated its own inline mocks. That led to:

- Different tests making subtly inconsistent assumptions about response shapes.
- High maintenance burden when the SDK API changes.
- No single place to add new RPC operations.

The `stellarRpcMock.ts` module solves all of the above by providing one
configurable factory that every test file imports.

## Installation / Setup

No additional dependencies required — the mock uses Jest's built-in `jest.fn()`.

## Basic Usage

```ts
import { createStellarRpcMock } from './mocks/stellarRpcMock'

const rpcMock = createStellarRpcMock()

describe('MyService', () => {
  beforeEach(() => {
    // Reset all mocks to their default resolved values before each test
    rpcMock.reset()
  })

  it('fetches account info', async () => {
    const account = await rpcMock.getAccount('GABC...')
    expect(account.id).toBe(rpcMock.defaults.account.id)
    expect(rpcMock.getAccount).toHaveBeenCalledWith('GABC...')
  })
})
```

## Customising Default Responses

Pass an options object to `createStellarRpcMock()` to override any default
fixture values:

```ts
const rpcMock = createStellarRpcMock({
  account: {
    id: 'GCUSTOM...',
    sequence: '9999999'
  },
  transaction: {
    status: 'FAILED',
    result_xdr: 'AAAE'
  },
  latestLedger: {
    sequence: 500
  }
})
```

## Per-Test Overrides

You can override individual mock implementations using Jest's standard API:

```ts
rpcMock.getTransaction.mockResolvedValueOnce({
  ...rpcMock.defaults.transaction,
  status: 'NOT_FOUND'
})
```

## Error Scenarios

The mock ships three convenience helpers for common failure modes:

```ts
// Simulate all RPC calls failing with a network error
rpcMock.simulateNetworkFailure()
rpcMock.simulateNetworkFailure(new Error('Custom network error'))

// Simulate HTTP 429 rate limiting
rpcMock.simulateRateLimit()

// Simulate getLedgers / getEvents returning "not found"
rpcMock.simulateLedgerNotFound()
```

## Mocking the Entire SDK Module

When your source module imports `@stellar/stellar-sdk` directly, use
`buildSdkModuleMock` together with `jest.mock`:

```ts
import { createStellarRpcMock, buildSdkModuleMock } from '../tests/mocks/stellarRpcMock'

const rpcMock = createStellarRpcMock()

jest.mock('@stellar/stellar-sdk', () => buildSdkModuleMock(rpcMock))

// Now any code under test that calls `new rpc.Server(url).getEvents(...)` will
// use rpcMock.getEvents under the hood.
```

## Available Mock Methods

| Method                     | Stellar SDK equivalent           | Default behaviour                                                  |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| `getAccount(address)`      | `rpc.Server.getAccount`          | Resolves with `defaults.account`                                   |
| `getTransaction(hash)`     | `rpc.Server.getTransaction`      | Resolves with `defaults.transaction`                               |
| `sendTransaction(tx)`      | `rpc.Server.sendTransaction`     | Resolves with `defaults.sendTransactionResponse` (status: PENDING) |
| `getLedgers(params)`       | `rpc.Server.getLedgers`          | Resolves with `{ ledgers: [defaults.ledger] }`                     |
| `getEvents(params)`        | `rpc.Server.getEvents`           | Resolves with `{ events: [defaults.event], latestLedger: N }`      |
| `getLatestLedger()`        | `rpc.Server.getLatestLedger`     | Resolves with `defaults.latestLedger`                              |
| `simulateTransaction(tx)`  | `rpc.Server.simulateTransaction` | Resolves with `{ results: [{ xdr: 'AAAA' }] }`                     |
| `getContractData(id, key)` | `rpc.Server.getContractData`     | Resolves with `{ val: null }`                                      |

## Adding a New RPC Method

1. Add the type to the `StellarRpcMock` interface in `stellarRpcMock.ts`.
2. Add a `jest.fn()` entry inside `createStellarRpcMock()`.
3. Include it in the `reset()` function.
4. Expose it in `buildSdkModuleMock()` under `rpc.Server`.

## Migrating Existing Tests

If a test file has inline mocks like:

```ts
// BEFORE — inline mock (duplicate, fragile)
jest.mock('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: jest.fn().mockImplementation(() => ({
      getEvents: jest.fn().mockResolvedValue({ events: [], latestLedger: 0 })
    }))
  }
}))
```

Replace it with:

```ts
// AFTER — shared mock factory
import { createStellarRpcMock, buildSdkModuleMock } from './mocks/stellarRpcMock'
const rpcMock = createStellarRpcMock()
jest.mock('@stellar/stellar-sdk', () => buildSdkModuleMock(rpcMock))
```
