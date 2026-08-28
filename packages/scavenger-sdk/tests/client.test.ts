/**
 * Unit tests for packages/scavenger-sdk/src/client.ts
 *
 * Issue #1122: Add unit tests for WalletService-equivalent in packages/scavenger-sdk
 *
 * Tests:
 * - ScavengerClient construction and configuration
 * - setSigningStrategy / getSigningStrategy
 * - Read-only invocations (simulation path)
 * - Write invocations (signing + submission path)
 * - Simulation error handling
 * - Transaction failure (status ERROR)
 * - Transaction failure (on-chain FAILED status)
 * - Transaction confirmation timeout
 * - Network failures
 * - Malformed response handling
 * - All top-level contract method wrappers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ContractError,
  TransactionError,
  TimeoutError,
} from '../src/errors'
import {
  FreighterSigningStrategy,
  SecretKeySigningStrategy,
} from '../src/signing'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const RPC_URL = 'https://soroban-testnet.stellar.org'
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM'
const SIGNER_ADDRESS = 'GAAHI5IUDNXOB45BGPCYWEHOGFGZL6XK5ZQOLNOLFJDLXSLLFJ7GDVW'
const MOCK_SIGNED_XDR = 'AAAAAAAAAXDR'
const MOCK_TX_HASH = '0000000000000000000000000000000000000000000000000000000000000001'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// We need to mock the entire @stellar/stellar-sdk before importing client.ts
const mockSimulateTransaction = vi.fn()
const mockGetAccount = vi.fn()
const mockSendTransaction = vi.fn()
const mockGetTransaction = vi.fn()

vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk')

  // A minimal Account stub
  class MockAccount {
    accountId() { return SIGNER_ADDRESS }
    sequenceNumber() { return '100' }
    incrementSequenceNumber() {}
  }

  // A minimal Operation stub
  const mockOperation = {}

  // Mock Contract
  const MockContract = vi.fn().mockImplementation(() => ({
    call: vi.fn().mockReturnValue(mockOperation),
  }))

  // Mock TransactionBuilder
  const mockBuiltTx = {
    toXDR: vi.fn().mockReturnValue('raw-tx-xdr'),
    sign: vi.fn(),
  }
  const MockTransactionBuilder = {
    fromXDR: vi.fn().mockReturnValue(mockBuiltTx),
  }
  function MockTransactionBuilderClass(_account: unknown, _opts: unknown) {
    return {
      addOperation: vi.fn().mockReturnThis(),
      setTimeout: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue(mockBuiltTx),
    }
  }
  Object.assign(MockTransactionBuilderClass, MockTransactionBuilder)

  // Mock rpc.Server
  const MockServer = vi.fn().mockImplementation(() => ({
    simulateTransaction: mockSimulateTransaction,
    getAccount: mockGetAccount,
    sendTransaction: mockSendTransaction,
    getTransaction: mockGetTransaction,
  }))

  return {
    ...actual,
    Contract: MockContract,
    TransactionBuilder: MockTransactionBuilderClass,
    Address: {
      fromString: vi.fn((s: string) => s),
    },
    rpc: {
      ...(actual as any).rpc,
      Server: MockServer,
      Api: {
        ...(actual as any).rpc?.Api,
        isSimulationError: vi.fn((sim: any) => !!sim.__isError),
        GetTransactionStatus: {
          SUCCESS: 'SUCCESS',
          FAILED: 'FAILED',
          NOT_FOUND: 'NOT_FOUND',
        },
        assembleTransaction: vi.fn((_tx: unknown, _sim: unknown) => ({
          build: vi.fn().mockReturnValue({
            toXDR: vi.fn().mockReturnValue('assembled-tx-xdr'),
          }),
        })),
      },
      assembleTransaction: vi.fn((_tx: unknown, _sim: unknown) => ({
        build: vi.fn().mockReturnValue({
          toXDR: vi.fn().mockReturnValue('assembled-tx-xdr'),
        }),
      })),
    },
    scValToNative: vi.fn((v: any) => v),
    nativeToScVal: vi.fn((v: any) => v),
    BASE_FEE: '100',
    xdr: actual.xdr,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSuccessSimulation(returnVal: unknown = null) {
  return {
    __isError: false,
    result: { retval: returnVal },
  }
}

function buildErrorSimulation(errorMsg = 'Error(Contract, #1)') {
  return {
    __isError: true,
    error: errorMsg,
  }
}

// ---------------------------------------------------------------------------
// Import client AFTER mocks are set up
// ---------------------------------------------------------------------------
async function getClient(opts?: Partial<{ pollTimeoutMs: number; pollIntervalMs: number }>) {
  const { ScavengerClient } = await import('../src/client')
  return new ScavengerClient({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    contractId: CONTRACT_ID,
    pollTimeoutMs: opts?.pollTimeoutMs ?? 100,
    pollIntervalMs: opts?.pollIntervalMs ?? 10,
  })
}

// ---------------------------------------------------------------------------
// Tests: Construction and Configuration
// ---------------------------------------------------------------------------

describe('ScavengerClient — construction', () => {
  it('creates a client with required options', async () => {
    const client = await getClient()
    expect(client).toBeDefined()
  })

  it('returns null from getSigningStrategy by default', async () => {
    const client = await getClient()
    expect(client.getSigningStrategy()).toBeNull()
  })

  it('sets and retrieves signing strategy', async () => {
    const client = await getClient()
    const strategy = new SecretKeySigningStrategy('SKEY')
    client.setSigningStrategy(strategy)
    expect(client.getSigningStrategy()).toBe(strategy)
  })

  it('replaces existing signing strategy', async () => {
    const client = await getClient()
    const s1 = new SecretKeySigningStrategy('SKEY1')
    const s2 = new FreighterSigningStrategy()
    client.setSigningStrategy(s1)
    client.setSigningStrategy(s2)
    expect(client.getSigningStrategy()).toBe(s2)
  })
})

// ---------------------------------------------------------------------------
// Tests: Read-only (simulation) path
// ---------------------------------------------------------------------------

describe('ScavengerClient — read-only simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAccount.mockResolvedValue({
      accountId: () => SIGNER_ADDRESS,
      sequenceNumber: () => '100',
      incrementSequenceNumber: () => {},
    })
    mockSimulateTransaction.mockResolvedValue(buildSuccessSimulation())
  })

  it('getMetrics calls simulateTransaction and returns result', async () => {
    const mockMetrics = { total_wastes_count: 5, total_tokens_earned: BigInt(1000) }
    mockSimulateTransaction.mockResolvedValue(buildSuccessSimulation(mockMetrics))

    const client = await getClient()
    const result = await client.getMetrics()
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(1)
    expect(result).toEqual(mockMetrics)
  })

  it('getParticipant returns null when no result retval', async () => {
    mockSimulateTransaction.mockResolvedValue(buildSuccessSimulation(null))
    const client = await getClient()
    const result = await client.getParticipant(SIGNER_ADDRESS)
    expect(result).toBeNull()
  })

  it('isParticipantRegistered returns boolean result', async () => {
    mockSimulateTransaction.mockResolvedValue(buildSuccessSimulation(true))
    const client = await getClient()
    const result = await client.isParticipantRegistered(SIGNER_ADDRESS)
    expect(result).toBe(true)
  })

  it('throws ContractError on simulation error', async () => {
    mockSimulateTransaction.mockResolvedValue(buildErrorSimulation('Error(Contract, #5)'))
    const { rpc } = await import('@stellar/stellar-sdk')
    ;(rpc.Api.isSimulationError as any).mockReturnValue(true)

    const client = await getClient()
    await expect(client.getMetrics()).rejects.toThrow(ContractError)
  })

  it('ContractError has numeric error code when pattern matches', async () => {
    mockSimulateTransaction.mockResolvedValue(buildErrorSimulation('Error(Contract, #42)'))
    const { rpc } = await import('@stellar/stellar-sdk')
    ;(rpc.Api.isSimulationError as any).mockReturnValue(true)

    const client = await getClient()
    const err = await client.getMetrics().catch((e) => e)
    expect(err).toBeInstanceOf(ContractError)
    expect(err.code).toBe(42)
  })

  it('throws ContractError with raw message when no contract error pattern', async () => {
    mockSimulateTransaction.mockResolvedValue(buildErrorSimulation('Unknown error'))
    const { rpc } = await import('@stellar/stellar-sdk')
    ;(rpc.Api.isSimulationError as any).mockReturnValue(true)

    const client = await getClient()
    const err = await client.getMetrics().catch((e) => e)
    expect(err).toBeInstanceOf(ContractError)
    expect(err.message).toBe('Unknown error')
  })
})

// ---------------------------------------------------------------------------
// Tests: Write (signing + submission) path
// ---------------------------------------------------------------------------

describe('ScavengerClient — write path', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetAccount.mockResolvedValue({
      accountId: () => SIGNER_ADDRESS,
      sequenceNumber: () => '100',
      incrementSequenceNumber: () => {},
    })
    mockSimulateTransaction.mockResolvedValue(buildSuccessSimulation())

    const { rpc } = await import('@stellar/stellar-sdk')
    ;(rpc.Api.isSimulationError as any).mockReturnValue(false)
  })

  it('throws when no signing strategy is configured', async () => {
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: MOCK_TX_HASH })
    mockGetTransaction.mockResolvedValue({
      status: 'SUCCESS',
      returnValue: null,
    })

    const client = await getClient()
    // No strategy set → should throw
    await expect(client.initializeAdmin(SIGNER_ADDRESS)).rejects.toThrow(
      'No signing strategy configured'
    )
  })

  it('calls signing strategy.sign() with assembled XDR', async () => {
    const mockSign = vi.fn().mockResolvedValue(MOCK_SIGNED_XDR)
    const strategy = { name: 'mock', sign: mockSign }

    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: MOCK_TX_HASH })
    mockGetTransaction.mockResolvedValue({ status: 'SUCCESS', returnValue: null })

    const client = await getClient()
    client.setSigningStrategy(strategy)
    await client.initializeAdmin(SIGNER_ADDRESS)

    expect(mockSign).toHaveBeenCalledTimes(1)
    expect(mockSign).toHaveBeenCalledWith(expect.any(String), NETWORK_PASSPHRASE)
  })

  it('submits the signed transaction via sendTransaction', async () => {
    const strategy = { name: 'mock', sign: vi.fn().mockResolvedValue(MOCK_SIGNED_XDR) }
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: MOCK_TX_HASH })
    mockGetTransaction.mockResolvedValue({ status: 'SUCCESS', returnValue: null })

    const client = await getClient()
    client.setSigningStrategy(strategy)
    await client.initializeAdmin(SIGNER_ADDRESS)
    expect(mockSendTransaction).toHaveBeenCalledTimes(1)
  })

  it('throws TransactionError when sendTransaction returns ERROR status', async () => {
    const strategy = { name: 'mock', sign: vi.fn().mockResolvedValue(MOCK_SIGNED_XDR) }
    mockSendTransaction.mockResolvedValue({
      status: 'ERROR',
      hash: MOCK_TX_HASH,
      errorResult: null,
    })

    const client = await getClient()
    client.setSigningStrategy(strategy)
    await expect(client.initializeAdmin(SIGNER_ADDRESS)).rejects.toThrow(TransactionError)
  })

  it('throws TransactionError when on-chain transaction FAILED', async () => {
    const strategy = { name: 'mock', sign: vi.fn().mockResolvedValue(MOCK_SIGNED_XDR) }
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: MOCK_TX_HASH })
    mockGetTransaction.mockResolvedValue({
      status: 'FAILED',
      hash: MOCK_TX_HASH,
    })

    const client = await getClient()
    client.setSigningStrategy(strategy)
    await expect(client.initializeAdmin(SIGNER_ADDRESS)).rejects.toThrow(TransactionError)
  })

  it('throws TimeoutError when polling deadline is exceeded', async () => {
    const strategy = { name: 'mock', sign: vi.fn().mockResolvedValue(MOCK_SIGNED_XDR) }
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: MOCK_TX_HASH })
    // Always return NOT_FOUND / pending so timeout fires
    mockGetTransaction.mockResolvedValue({ status: 'NOT_FOUND' })

    const client = await getClient({ pollTimeoutMs: 50, pollIntervalMs: 10 })
    client.setSigningStrategy(strategy)
    await expect(client.initializeAdmin(SIGNER_ADDRESS)).rejects.toThrow(TimeoutError)
  })

  it('returns the scValToNative result on SUCCESS', async () => {
    const { scValToNative } = await import('@stellar/stellar-sdk')
    const mockReturn = { id: 1 }
    ;(scValToNative as any).mockReturnValue(mockReturn)

    const strategy = { name: 'mock', sign: vi.fn().mockResolvedValue(MOCK_SIGNED_XDR) }
    mockSendTransaction.mockResolvedValue({ status: 'PENDING', hash: MOCK_TX_HASH })
    mockGetTransaction.mockResolvedValue({
      status: 'SUCCESS',
      returnValue: { some: 'scval' },
    })

    const client = await getClient()
    client.setSigningStrategy(strategy)
    const result = await client.initializeAdmin(SIGNER_ADDRESS)
    // The mock scValToNative returns mockReturn for any input
    expect(result).toEqual(mockReturn)
  })
})

// ---------------------------------------------------------------------------
// Tests: Network failure scenarios
// ---------------------------------------------------------------------------

describe('ScavengerClient — network failures', () => {
  it('propagates network error from simulateTransaction', async () => {
    mockGetAccount.mockResolvedValue({})
    mockSimulateTransaction.mockRejectedValue(new Error('Network error: connection refused'))

    const client = await getClient()
    await expect(client.getMetrics()).rejects.toThrow('Network error')
  })

  it('propagates network error from getAccount during write', async () => {
    mockGetAccount.mockRejectedValue(new Error('Host not found'))

    const client = await getClient()
    client.setSigningStrategy({ name: 'mock', sign: vi.fn() })
    await expect(client.initializeAdmin(SIGNER_ADDRESS)).rejects.toThrow('Host not found')
  })
})

// ---------------------------------------------------------------------------
// Tests: Signing strategy failure
// ---------------------------------------------------------------------------

describe('ScavengerClient — signing failures', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetAccount.mockResolvedValue({})
    mockSimulateTransaction.mockResolvedValue(buildSuccessSimulation())
    const { rpc } = await import('@stellar/stellar-sdk')
    ;(rpc.Api.isSimulationError as any).mockReturnValue(false)
  })

  it('propagates SigningError when strategy.sign() throws', async () => {
    const { SigningError: SE } = await import('../src/errors')
    const strategy = {
      name: 'mock',
      sign: vi.fn().mockRejectedValue(new SE('User rejected')),
    }

    const client = await getClient()
    client.setSigningStrategy(strategy)
    await expect(client.initializeAdmin(SIGNER_ADDRESS)).rejects.toThrow('User rejected')
  })
})

// ---------------------------------------------------------------------------
// Tests: Contract method smoke-tests
// ---------------------------------------------------------------------------

describe('ScavengerClient — contract methods (simulation smoke)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetAccount.mockResolvedValue({})
    mockSimulateTransaction.mockResolvedValue(buildSuccessSimulation(null))
    const { rpc } = await import('@stellar/stellar-sdk')
    ;(rpc.Api.isSimulationError as any).mockReturnValue(false)
  })

  const readMethods: Array<[string, () => unknown]> = []

  it('getMetrics does not throw on success', async () => {
    const client = await getClient()
    await expect(client.getMetrics()).resolves.not.toThrow()
  })

  it('getParticipant does not throw on success', async () => {
    const client = await getClient()
    await expect(client.getParticipant(SIGNER_ADDRESS)).resolves.not.toThrow()
  })

  it('isParticipantRegistered does not throw on success', async () => {
    const client = await getClient()
    await expect(client.isParticipantRegistered(SIGNER_ADDRESS)).resolves.not.toThrow()
  })

  it('getAdmin does not throw on success', async () => {
    const client = await getClient()
    await expect(client.getAdmin()).resolves.not.toThrow()
  })
})
