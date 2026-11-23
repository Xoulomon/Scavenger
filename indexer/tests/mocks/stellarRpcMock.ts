/**
 * Shared Stellar RPC Mock Service (#945)
 *
 * Provides a configurable, reusable mock factory for Stellar Soroban RPC
 * responses. Import `createStellarRpcMock` in any test file to get a
 * fully-typed mock that replaces `@stellar/stellar-sdk`'s `rpc.Server`.
 *
 * Usage
 * -----
 * ```ts
 * import { createStellarRpcMock, RpcMockOptions } from './mocks/stellarRpcMock';
 *
 * const mock = createStellarRpcMock();
 * mock.getAccount.mockResolvedValue(mock.defaults.account);
 * ```
 */

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface MockAccountRecord {
  id: string
  sequence: string
  balances: Array<{ asset_type: string; balance: string }>
}

export interface MockTransactionRecord {
  id: string
  hash: string
  ledger: number
  status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND'
  envelope_xdr: string
  result_xdr: string
  result_meta_xdr: string
  fee_charged: string
}

export interface MockSendTransactionResponse {
  hash: string
  status: 'PENDING' | 'DUPLICATE' | 'TRY_AGAIN_LATER' | 'ERROR'
  latestLedger: number
  latestLedgerCloseTime: string
  errorResultXdr?: string
}

export interface MockLedger {
  sequence: number
  ledgerCloseTime: string
  transactionCount: number
  operationCount: number
  totalCoins: string
  feePool: string
  baseFeeInStroops: number
  baseReserveInStroops: number
  maxTxSetSize: number
  protocolVersion: number
  headerXdr: string
}

export interface MockContractEvent {
  id: string
  type: 'contract' | 'system' | 'diagnostic'
  ledger: number
  ledgerClosedAt: string
  contractId: string
  txHash: string
  topic: unknown[]
  value: unknown
  inSuccessfulContractCall: boolean
}

export interface MockLatestLedger {
  id: string
  sequence: number
  protocolVersion: number
}

export interface RpcMockDefaults {
  account: MockAccountRecord
  transaction: MockTransactionRecord
  sendTransactionResponse: MockSendTransactionResponse
  ledger: MockLedger
  event: MockContractEvent
  latestLedger: MockLatestLedger
}

export interface StellarRpcMock {
  /** Mock for rpc.Server.getAccount() */
  getAccount: jest.MockedFunction<(address: string) => Promise<MockAccountRecord>>
  /** Mock for rpc.Server.getTransaction() */
  getTransaction: jest.MockedFunction<(hash: string) => Promise<MockTransactionRecord>>
  /** Mock for rpc.Server.sendTransaction() */
  sendTransaction: jest.MockedFunction<(tx: unknown) => Promise<MockSendTransactionResponse>>
  /** Mock for rpc.Server.getLedgers() or similar */
  getLedgers: jest.MockedFunction<(params: unknown) => Promise<{ ledgers: MockLedger[] }>>
  /** Mock for rpc.Server.getEvents() */
  getEvents: jest.MockedFunction<
    (params: unknown) => Promise<{ events: MockContractEvent[]; latestLedger: number }>
  >
  /** Mock for rpc.Server.getLatestLedger() */
  getLatestLedger: jest.MockedFunction<() => Promise<MockLatestLedger>>
  /** Mock for rpc.Server.simulateTransaction() */
  simulateTransaction: jest.MockedFunction<(tx: unknown) => Promise<{ results: unknown[] }>>
  /** Mock for rpc.Server.getContractData() */
  getContractData: jest.MockedFunction<
    (contractId: string, key: unknown) => Promise<{ val: unknown }>
  >

  /** Pre-built default response objects ready to use in tests */
  defaults: RpcMockDefaults

  /**
   * Reset all mocks to their default resolved values.
   * Call this in beforeEach() to ensure test isolation.
   */
  reset(): void

  /**
   * Configure all mocks to reject with the given error.
   * Useful for testing network-failure / RPC-down scenarios.
   */
  simulateNetworkFailure(error?: Error): void

  /**
   * Configure the mock to simulate a rate-limit (HTTP 429) scenario.
   */
  simulateRateLimit(): void

  /**
   * Configure the mock to simulate a ledger-not-found scenario.
   */
  simulateLedgerNotFound(): void
}

export interface RpcMockOptions {
  /** Override default account data */
  account?: Partial<MockAccountRecord>
  /** Override default transaction data */
  transaction?: Partial<MockTransactionRecord>
  /** Override default send-transaction response */
  sendTransactionResponse?: Partial<MockSendTransactionResponse>
  /** Override default ledger data */
  ledger?: Partial<MockLedger>
  /** Override default contract event */
  event?: Partial<MockContractEvent>
  /** Override latest ledger info */
  latestLedger?: Partial<MockLatestLedger>
}

// ─── Default Fixtures ────────────────────────────────────────────────────────

const DEFAULT_ADDRESS = 'GAAHI5IUDNXOB45BGPCYWEHOGFGZL6XK5ZQOLNOLFJDLXSLLFJ7GDVW'
const DEFAULT_TX_HASH = '0000000000000000000000000000000000000000000000000000000000000001'
const DEFAULT_CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM'

function buildDefaults(overrides: RpcMockOptions = {}): RpcMockDefaults {
  const account: MockAccountRecord = {
    id: overrides.account?.id ?? DEFAULT_ADDRESS,
    sequence: overrides.account?.sequence ?? '7200000000',
    balances: overrides.account?.balances ?? [{ asset_type: 'native', balance: '10000.0000000' }],
    ...overrides.account
  }

  const transaction: MockTransactionRecord = {
    id: overrides.transaction?.id ?? DEFAULT_TX_HASH,
    hash: overrides.transaction?.hash ?? DEFAULT_TX_HASH,
    ledger: overrides.transaction?.ledger ?? 100,
    status: overrides.transaction?.status ?? 'SUCCESS',
    envelope_xdr: overrides.transaction?.envelope_xdr ?? 'AAAA',
    result_xdr: overrides.transaction?.result_xdr ?? 'AAAA',
    result_meta_xdr: overrides.transaction?.result_meta_xdr ?? 'AAAA',
    fee_charged: overrides.transaction?.fee_charged ?? '100',
    ...overrides.transaction
  }

  const sendTransactionResponse: MockSendTransactionResponse = {
    hash: overrides.sendTransactionResponse?.hash ?? DEFAULT_TX_HASH,
    status: overrides.sendTransactionResponse?.status ?? 'PENDING',
    latestLedger: overrides.sendTransactionResponse?.latestLedger ?? 100,
    latestLedgerCloseTime:
      overrides.sendTransactionResponse?.latestLedgerCloseTime ?? '2024-01-01T00:00:00Z',
    ...overrides.sendTransactionResponse
  }

  const ledger: MockLedger = {
    sequence: overrides.ledger?.sequence ?? 100,
    ledgerCloseTime: overrides.ledger?.ledgerCloseTime ?? '2024-01-01T00:00:00Z',
    transactionCount: overrides.ledger?.transactionCount ?? 5,
    operationCount: overrides.ledger?.operationCount ?? 10,
    totalCoins: overrides.ledger?.totalCoins ?? '105443902087.3472865',
    feePool: overrides.ledger?.feePool ?? '30916.6131895',
    baseFeeInStroops: overrides.ledger?.baseFeeInStroops ?? 100,
    baseReserveInStroops: overrides.ledger?.baseReserveInStroops ?? 5000000,
    maxTxSetSize: overrides.ledger?.maxTxSetSize ?? 1000,
    protocolVersion: overrides.ledger?.protocolVersion ?? 21,
    headerXdr: overrides.ledger?.headerXdr ?? 'AAAA',
    ...overrides.ledger
  }

  const event: MockContractEvent = {
    id: overrides.event?.id ?? `0000000000000100-0000000001-0000`,
    type: overrides.event?.type ?? 'contract',
    ledger: overrides.event?.ledger ?? 100,
    ledgerClosedAt: overrides.event?.ledgerClosedAt ?? '2024-01-01T00:00:00Z',
    contractId: overrides.event?.contractId ?? DEFAULT_CONTRACT_ID,
    txHash: overrides.event?.txHash ?? DEFAULT_TX_HASH,
    topic: overrides.event?.topic ?? ['recycled', '42'],
    value: overrides.event?.value ?? [0, '1000', DEFAULT_ADDRESS, '40000000', '-74000000'],
    inSuccessfulContractCall: overrides.event?.inSuccessfulContractCall ?? true,
    ...overrides.event
  }

  const latestLedger: MockLatestLedger = {
    id: overrides.latestLedger?.id ?? 'abc123',
    sequence: overrides.latestLedger?.sequence ?? 100,
    protocolVersion: overrides.latestLedger?.protocolVersion ?? 21,
    ...overrides.latestLedger
  }

  return { account, transaction, sendTransactionResponse, ledger, event, latestLedger }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a fresh StellarRpcMock instance with optional default overrides.
 *
 * All methods are `jest.fn()` so you can use `.mockResolvedValue()`,
 * `.mockRejectedValue()`, `.toHaveBeenCalledWith()`, etc.
 */
export function createStellarRpcMock(options: RpcMockOptions = {}): StellarRpcMock {
  const defaults = buildDefaults(options)

  const getAccount = jest
    .fn<Promise<MockAccountRecord>, [string]>()
    .mockResolvedValue(defaults.account)

  const getTransaction = jest
    .fn<Promise<MockTransactionRecord>, [string]>()
    .mockResolvedValue(defaults.transaction)

  const sendTransaction = jest
    .fn<Promise<MockSendTransactionResponse>, [unknown]>()
    .mockResolvedValue(defaults.sendTransactionResponse)

  const getLedgers = jest
    .fn<Promise<{ ledgers: MockLedger[] }>, [unknown]>()
    .mockResolvedValue({ ledgers: [defaults.ledger] })

  const getEvents = jest
    .fn<Promise<{ events: MockContractEvent[]; latestLedger: number }>, [unknown]>()
    .mockResolvedValue({
      events: [defaults.event],
      latestLedger: defaults.latestLedger.sequence
    })

  const getLatestLedger = jest
    .fn<Promise<MockLatestLedger>, []>()
    .mockResolvedValue(defaults.latestLedger)

  const simulateTransaction = jest
    .fn<Promise<{ results: unknown[] }>, [unknown]>()
    .mockResolvedValue({ results: [{ xdr: 'AAAA' }] })

  const getContractData = jest
    .fn<Promise<{ val: unknown }>, [string, unknown]>()
    .mockResolvedValue({ val: null })

  function reset() {
    getAccount.mockReset().mockResolvedValue(defaults.account)
    getTransaction.mockReset().mockResolvedValue(defaults.transaction)
    sendTransaction.mockReset().mockResolvedValue(defaults.sendTransactionResponse)
    getLedgers.mockReset().mockResolvedValue({ ledgers: [defaults.ledger] })
    getEvents.mockReset().mockResolvedValue({
      events: [defaults.event],
      latestLedger: defaults.latestLedger.sequence
    })
    getLatestLedger.mockReset().mockResolvedValue(defaults.latestLedger)
    simulateTransaction.mockReset().mockResolvedValue({ results: [{ xdr: 'AAAA' }] })
    getContractData.mockReset().mockResolvedValue({ val: null })
  }

  function simulateNetworkFailure(error = new Error('Network error: connection refused')) {
    getAccount.mockRejectedValue(error)
    getTransaction.mockRejectedValue(error)
    sendTransaction.mockRejectedValue(error)
    getLedgers.mockRejectedValue(error)
    getEvents.mockRejectedValue(error)
    getLatestLedger.mockRejectedValue(error)
    simulateTransaction.mockRejectedValue(error)
    getContractData.mockRejectedValue(error)
  }

  function simulateRateLimit() {
    const rateLimitError = new Error('Request rate limit exceeded (HTTP 429)')
    simulateNetworkFailure(rateLimitError)
  }

  function simulateLedgerNotFound() {
    const notFoundError = new Error('Ledger not found')
    getLedgers.mockRejectedValue(notFoundError)
    getEvents.mockRejectedValue(notFoundError)
  }

  return {
    getAccount,
    getTransaction,
    sendTransaction,
    getLedgers,
    getEvents,
    getLatestLedger,
    simulateTransaction,
    getContractData,
    defaults,
    reset,
    simulateNetworkFailure,
    simulateRateLimit,
    simulateLedgerNotFound
  }
}

/**
 * Helper: build the Jest module mock object that matches the shape of
 * `@stellar/stellar-sdk`'s `rpc` namespace.
 *
 * Use this inside `jest.mock(...)`:
 *
 * ```ts
 * const rpcMock = createStellarRpcMock();
 * jest.mock('@stellar/stellar-sdk', () => buildSdkModuleMock(rpcMock));
 * ```
 */
export function buildSdkModuleMock(mock: StellarRpcMock) {
  return {
    rpc: {
      Server: jest.fn().mockImplementation(() => ({
        getAccount: mock.getAccount,
        getTransaction: mock.getTransaction,
        sendTransaction: mock.sendTransaction,
        getEvents: mock.getEvents,
        getLatestLedger: mock.getLatestLedger,
        simulateTransaction: mock.simulateTransaction,
        getContractData: mock.getContractData
      }))
    },
    xdr: {
      ScVal: {
        fromXDR: jest.fn()
      },
      ScValType: {
        scvU32: jest.fn().mockReturnValue('scvU32'),
        scvI32: jest.fn().mockReturnValue('scvI32'),
        scvU64: jest.fn().mockReturnValue('scvU64'),
        scvI64: jest.fn().mockReturnValue('scvI64'),
        scvU128: jest.fn().mockReturnValue('scvU128'),
        scvI128: jest.fn().mockReturnValue('scvI128'),
        scvBool: jest.fn().mockReturnValue('scvBool'),
        scvSymbol: jest.fn().mockReturnValue('scvSymbol'),
        scvString: jest.fn().mockReturnValue('scvString'),
        scvAddress: jest.fn().mockReturnValue('scvAddress'),
        scvVec: jest.fn().mockReturnValue('scvVec'),
        scvVoid: jest.fn().mockReturnValue('scvVoid')
      }
    }
  }
}
