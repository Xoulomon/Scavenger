// Re-export all shared types
export * from '@scavngr/types'

// Re-export shared domain types explicitly so consumers (e.g. the frontend)
// can import them from the SDK without duplicating definitions.
export type {
  Participant,
  Incentive,
  Material,
  Waste,
  WasteTransfer,
  ParticipantStats,
  GlobalMetrics,
  ContractError
} from '@scavngr/types'

// SDK-specific types and client extensions
import type { ClientOptions as BaseClientOptions } from '@scavngr/types'

/**
 * Enhanced client options for the `ScavengerClient`.
 *
 * Extends the base `ClientOptions` (contractId, network, rpcUrl,
 * networkPassphrase) with SDK-level concerns like retry policies and logging.
 */
export interface SdkClientOptions extends BaseClientOptions {
  /**
   * Enable automatic retry on transient network failures.
   * @defaultValue false
   */
  enableRetry?: boolean
  /**
   * Maximum number of retry attempts when `enableRetry` is true.
   * @defaultValue 3
   */
  maxRetries?: number
  /**
   * Enable request/response logging to the console.
   * Useful for debugging in development; disable in production.
   * @defaultValue false
   */
  enableLogging?: boolean
  /**
   * Custom `User-Agent` string for HTTP requests.
   * Defaults to `@scavngr/sdk/<version>`.
   */
  userAgent?: string
}

/**
 * Decoded value returned from a simulated contract call.
 *
 * Soroban return values are dynamically typed, so this is a discriminated
 * union of the shapes the SDK knows how to decode rather than `unknown`.
 */
export type SimulationResultValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | SimulationResultValue[]
  | { [key: string]: SimulationResultValue }

/**
 * Result of a Soroban transaction simulation.
 *
 * Returned before submitting a transaction to estimate resource usage
 * and catch contract errors early without consuming sequence numbers.
 */
export interface SimulationResult {
  /** Whether the simulation succeeded without contract errors. */
  success: boolean
  /** On-chain resource cost estimates. */
  cost: {
    /** CPU instruction units consumed. */
    cpuInstructions: number
    /** Memory bytes consumed. */
    memoryBytes: number
  }
  /** Decoded return value if the simulation succeeded. */
  result?: SimulationResultValue
  /** Error message if the simulation failed. */
  error?: string
}

/**
 * Result of a submitted Soroban transaction.
 *
 * @typeParam T - The expected decoded return type from the contract call.
 */
export interface TransactionResult<T = SimulationResultValue> {
  /** Whether the transaction was accepted and confirmed on-chain. */
  success: boolean
  /**
   * Transaction hash, available once the transaction has been submitted.
   * Use this to look up the transaction on a block explorer.
   */
  transactionHash?: string
  /** Decoded return value from the contract call on success. */
  result?: T
  /** Error message if the transaction failed. */
  error?: string
  /** Total gas (CPU instructions) used by this transaction. */
  gasUsed?: number
}
