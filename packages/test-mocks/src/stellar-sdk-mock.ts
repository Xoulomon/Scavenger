/**
 * Shared Stellar SDK Mock (#1751)
 *
 * Provides reusable mock factories for @stellar/stellar-sdk classes and
 * methods used across frontend and indexer tests. Supports both Jest and
 * Vitest mock systems.
 *
 * Usage (Jest):
 * ```ts
 * import { createStellarSdkMock } from '@scavenger/test-mocks';
 *
 * const sdkMock = createStellarSdkMock();
 * jest.mock('@stellar/stellar-sdk', () => sdkMock.getModuleMock());
 * ```
 *
 * Usage (Vitest):
 * ```ts
 * import { createStellarSdkMock } from '@scavenger/test-mocks';
 * import { vi } from 'vitest';
 *
 * const sdkMock = createStellarSdkMock({ mockFn: vi.fn });
 * vi.mock('@stellar/stellar-sdk', () => sdkMock.getModuleMock());
 * ```
 */

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface MockAccount {
  accountId(): string
  sequenceNumber(): string
  incrementSequenceNumber(): void
  balances: Array<{
    asset_type: string
    balance: string
    asset_code?: string
    asset_issuer?: string
  }>
}

export interface MockTransaction {
  toEnvelope(): { toXDR(encoding: string): string }
  sign(...keypairs: MockKeypair[]): void
  hash(): Buffer
}

export interface MockKeypair {
  publicKey(): string
  secret(): string
  sign(data: Buffer): Buffer
  verify(data: Buffer, signature: Buffer): boolean
}

export interface MockServer {
  loadAccount(publicKey: string): Promise<MockAccount>
  submitTransaction(transaction: MockTransaction): Promise<MockTransactionResponse>
  getTransaction(hash: string): Promise<MockTransactionRecord>
}

export interface MockSorobanRpc {
  Server: new (url: string) => MockRpcServer
}

export interface MockRpcServer {
  getAccount(address: string): Promise<MockRpcAccount>
  getTransaction(hash: string): Promise<MockRpcTransaction>
  sendTransaction(tx: unknown): Promise<MockSendTransactionResponse>
  getEvents(params: unknown): Promise<MockGetEventsResponse>
  getLatestLedger(): Promise<MockLatestLedger>
  simulateTransaction(tx: unknown): Promise<MockSimulateResponse>
  getContractData(contractId: string, key: unknown): Promise<{ val: unknown }>
}

export interface MockRpcAccount {
  id: string
  sequence: string
  balances: Array<{ asset_type: string; balance: string }>
}

export interface MockRpcTransaction {
  id: string
  hash: string
  ledger: number
  status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND'
  envelope_xdr: string
  result_xdr: string
  result_meta_xdr: string
  fee_charged: string
  created_at: string
}

export interface MockSendTransactionResponse {
  hash: string
  status: 'PENDING' | 'DUPLICATE' | 'TRY_AGAIN_LATER' | 'ERROR'
  latestLedger: number
  latestLedgerCloseTime: string
  errorResultXdr?: string
}

export interface MockGetEventsResponse {
  events: Array<{
    id: string
    type: string
    ledger: number
    ledgerClosedAt: string
    contractId: string
    topic: unknown[]
    value: unknown
  }>
  latestLedger: number
}

export interface MockLatestLedger {
  id: string
  sequence: number
  protocolVersion: number
}

export interface MockSimulateResponse {
  transactionData: string
  minResourceFee: string
  events: Array<unknown>
  results: Array<{ xdr: string }>
  cost: { cpuInsn: string; memByte: string }
}

export interface MockTransactionResponse {
  hash: string
  ledger: number
  envelope_xdr: string
  result_xdr: string
  result_meta_xdr: string
  successful: boolean
}

export interface MockTransactionRecord {
  id: string
  hash: string
  ledger: number
  created_at: string
  source_account: string
  fee_charged: number
  successful: boolean
}

export interface MockOperation {
  type: string
  source?: string
}

export interface MockAsset {
  code: string
  issuer: string
  isNative(): boolean
}

export interface StellarSdkMockOptions {
  /** Custom mock function (e.g., vi.fn for Vitest, jest.fn for Jest) */
  mockFn?: <T = any>() => MockFunction<T>
  /** Default account address */
  defaultAddress?: string
  /** Default network passphrase */
  networkPassphrase?: string
  /** Default RPC URL */
  rpcUrl?: string
}

type MockFunction<T = any> = {
  (...args: any[]): T
  mockResolvedValue(value: any): MockFunction<T>
  mockRejectedValue(error: any): MockFunction<T>
  mockImplementation(impl: (...args: any[]) => T): MockFunction<T>
  mockReturnValue(value: T): MockFunction<T>
  mockReset(): MockFunction<T>
  mockClear(): MockFunction<T>
}

// ─── Default Values ──────────────────────────────────────────────────────────

const DEFAULT_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
const DEFAULT_SECRET = 'SBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
const DEFAULT_TX_HASH = '0000000000000000000000000000000000000000000000000000000000000001'
const DEFAULT_CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM'
const DEFAULT_NETWORK = 'Test SDF Network ; September 2015'
const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org'

// ─── Factory Implementation ──────────────────────────────────────────────────

export class StellarSdkMock {
  private mockFn: <T = any>() => MockFunction<T>
  private defaults: Required<Omit<StellarSdkMockOptions, 'mockFn'>>

  constructor(options: StellarSdkMockOptions = {}) {
    this.mockFn =
      options.mockFn ||
      (jest?.fn as any) ||
      (() => {
        throw new Error(
          'No mock function provided. Pass mockFn option or ensure Jest is available.'
        )
      })

    this.defaults = {
      defaultAddress: options.defaultAddress || DEFAULT_ADDRESS,
      networkPassphrase: options.networkPassphrase || DEFAULT_NETWORK,
      rpcUrl: options.rpcUrl || DEFAULT_RPC_URL
    }
  }

  /**
   * Create a mock Keypair instance
   */
  createKeypair(publicKey?: string, secret?: string): MockKeypair {
    const pubKey = publicKey || this.defaults.defaultAddress
    const sec = secret || DEFAULT_SECRET

    return {
      publicKey: () => pubKey,
      secret: () => sec,
      sign: this.mockFn().mockReturnValue(Buffer.from('mock_signature')),
      verify: this.mockFn().mockReturnValue(true)
    }
  }

  /**
   * Create a mock Account instance
   */
  createAccount(accountId?: string, sequence?: string): MockAccount {
    let seq = sequence || '1234567890'

    return {
      accountId: () => accountId || this.defaults.defaultAddress,
      sequenceNumber: () => seq,
      incrementSequenceNumber: () => {
        seq = (BigInt(seq) + 1n).toString()
      },
      balances: [
        {
          asset_type: 'native',
          balance: '10000.0000000'
        }
      ]
    }
  }

  /**
   * Create a mock Transaction instance
   */
  createTransaction(hash?: string): MockTransaction {
    const txHash = hash || DEFAULT_TX_HASH

    return {
      toEnvelope: this.mockFn().mockReturnValue({
        toXDR: this.mockFn().mockReturnValue('AAAA_MOCK_XDR_AAAA')
      }),
      sign: this.mockFn(),
      hash: this.mockFn().mockReturnValue(Buffer.from(txHash, 'hex'))
    }
  }

  /**
   * Create a mock Horizon Server instance
   */
  createServer(url?: string): MockServer {
    const serverUrl = url || 'https://horizon-testnet.stellar.org'

    return {
      loadAccount: this.mockFn().mockResolvedValue(this.createAccount()),
      submitTransaction: this.mockFn().mockResolvedValue({
        hash: DEFAULT_TX_HASH,
        ledger: 12345,
        envelope_xdr: 'AAAA_ENVELOPE_AAAA',
        result_xdr: 'AAAA_RESULT_AAAA',
        result_meta_xdr: 'AAAA_META_AAAA',
        successful: true
      }),
      getTransaction: this.mockFn().mockResolvedValue({
        id: DEFAULT_TX_HASH,
        hash: DEFAULT_TX_HASH,
        ledger: 12345,
        created_at: '2024-01-15T12:00:00Z',
        source_account: this.defaults.defaultAddress,
        fee_charged: 100,
        successful: true
      })
    } as MockServer
  }

  /**
   * Create a mock Soroban RPC Server instance
   */
  createRpcServer(url?: string): MockRpcServer {
    const rpcUrl = url || this.defaults.rpcUrl

    return {
      getAccount: this.mockFn().mockResolvedValue({
        id: this.defaults.defaultAddress,
        sequence: '1234567890',
        balances: [{ asset_type: 'native', balance: '10000.0000000' }]
      }),
      getTransaction: this.mockFn().mockResolvedValue({
        id: DEFAULT_TX_HASH,
        hash: DEFAULT_TX_HASH,
        ledger: 12345,
        status: 'SUCCESS',
        envelope_xdr: 'AAAA_ENVELOPE_AAAA',
        result_xdr: 'AAAA_RESULT_AAAA',
        result_meta_xdr: 'AAAA_META_AAAA',
        fee_charged: '100',
        created_at: '2024-01-15T12:00:00Z'
      }),
      sendTransaction: this.mockFn().mockResolvedValue({
        hash: DEFAULT_TX_HASH,
        status: 'PENDING',
        latestLedger: 12345,
        latestLedgerCloseTime: '2024-01-15T12:00:00Z'
      }),
      getEvents: this.mockFn().mockResolvedValue({
        events: [
          {
            id: `${12345}-0`,
            type: 'contract',
            ledger: 12345,
            ledgerClosedAt: '2024-01-15T12:00:00Z',
            contractId: DEFAULT_CONTRACT_ID,
            topic: ['event_name', 'param1'],
            value: [0, '1000', this.defaults.defaultAddress]
          }
        ],
        latestLedger: 12345
      }),
      getLatestLedger: this.mockFn().mockResolvedValue({
        id: 'latest_ledger_id',
        sequence: 12345,
        protocolVersion: 21
      }),
      simulateTransaction: this.mockFn().mockResolvedValue({
        transactionData: 'AAAA_SIM_DATA_AAAA',
        minResourceFee: '1000',
        events: [],
        results: [{ xdr: 'AAAA_RESULT_XDR_AAAA' }],
        cost: { cpuInsn: '1000000', memByte: '2000000' }
      }),
      getContractData: this.mockFn().mockResolvedValue({
        val: null
      })
    } as MockRpcServer
  }

  /**
   * Create a mock Asset instance
   */
  createAsset(code?: string, issuer?: string): MockAsset {
    return {
      code: code || 'XLM',
      issuer: issuer || this.defaults.defaultAddress,
      isNative: this.mockFn().mockReturnValue(code === 'XLM' || !code)
    }
  }

  /**
   * Create a mock Operation
   */
  createOperation(type: string, source?: string): MockOperation {
    return {
      type,
      source
    }
  }

  /**
   * Get the full module mock object for jest.mock() or vi.mock()
   */
  getModuleMock() {
    const rpcServer = this.createRpcServer()
    const horizonServer = this.createServer()

    return {
      Keypair: {
        random: this.mockFn().mockReturnValue(this.createKeypair()),
        fromSecret: this.mockFn().mockImplementation((secret: string) =>
          this.createKeypair(undefined, secret)
        ),
        fromPublicKey: this.mockFn().mockImplementation((publicKey: string) =>
          this.createKeypair(publicKey)
        )
      },
      Account: this.mockFn().mockImplementation((accountId: string, sequence: string) =>
        this.createAccount(accountId, sequence)
      ),
      TransactionBuilder: this.mockFn().mockImplementation(() => ({
        addOperation: this.mockFn().mockReturnThis(),
        setTimeout: this.mockFn().mockReturnThis(),
        build: this.mockFn().mockReturnValue(this.createTransaction())
      })),
      Operation: {
        payment: this.mockFn().mockReturnValue(this.createOperation('payment')),
        createAccount: this.mockFn().mockReturnValue(this.createOperation('createAccount')),
        invokeContractFunction: this.mockFn().mockReturnValue(
          this.createOperation('invokeContractFunction')
        )
      },
      Asset: {
        native: this.mockFn().mockReturnValue(this.createAsset('XLM'))
      },
      Server: this.mockFn().mockImplementation(() => horizonServer),
      Networks: {
        TESTNET: this.defaults.networkPassphrase,
        PUBLIC: 'Public Global Stellar Network ; September 2015'
      },
      rpc: {
        Server: this.mockFn().mockImplementation(() => rpcServer)
      },
      SorobanRpc: {
        Server: this.mockFn().mockImplementation(() => rpcServer)
      },
      xdr: {
        ScVal: {
          scvU32: this.mockFn(),
          scvSymbol: this.mockFn(),
          scvAddress: this.mockFn()
        },
        ScAddress: {
          scAddressTypeAccount: this.mockFn(),
          scAddressTypeContract: this.mockFn()
        }
      },
      StrKey: {
        encodeEd25519PublicKey: this.mockFn().mockReturnValue(this.defaults.defaultAddress),
        decodeEd25519PublicKey: this.mockFn().mockReturnValue(Buffer.alloc(32)),
        isValidEd25519PublicKey: this.mockFn().mockReturnValue(true)
      }
    }
  }

  /**
   * Reset all mock functions
   */
  resetAll() {
    // Implementation depends on mock framework
    // This is a placeholder for the interface
  }
}

/**
 * Factory function to create a new StellarSdkMock instance
 */
export function createStellarSdkMock(options?: StellarSdkMockOptions): StellarSdkMock {
  return new StellarSdkMock(options)
}

/**
 * Pre-configured mock for Jest
 */
export function createJestStellarSdkMock(
  options?: Omit<StellarSdkMockOptions, 'mockFn'>
): StellarSdkMock {
  return new StellarSdkMock({
    ...options,
    mockFn: jest?.fn as any
  })
}

/**
 * Pre-configured mock for Vitest
 *
 * @param vi - The vi import from 'vitest'
 */
export function createVitestStellarSdkMock(
  vi: any,
  options?: Omit<StellarSdkMockOptions, 'mockFn'>
): StellarSdkMock {
  return new StellarSdkMock({
    ...options,
    mockFn: vi.fn
  })
}
