// Re-export all shared types
export * from '@scavngr/types'

// SDK-specific types and client extensions
import type { 
  ClientOptions as BaseClientOptions,
  NetworkConfig,
  WasteType,
  ParticipantRole
} from '@scavngr/types'

/** Enhanced client options with SDK-specific configuration */
export interface SdkClientOptions extends BaseClientOptions {
  /** Enable automatic retry on network failures */
  enableRetry?: boolean
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Enable request/response logging */
  enableLogging?: boolean
  /** Custom user agent for HTTP requests */
  userAgent?: string
}

/** Transaction simulation result */
export interface SimulationResult {
  success: boolean
  cost: {
    cpuInstructions: number
    memoryBytes: number
  }
  result?: any
  error?: string
}

/** Transaction submission result */
export interface TransactionResult<T = any> {
  success: boolean
  transactionHash?: string
  result?: T
  error?: string
  gasUsed?: number
}
