/**
 * Error thrown when a Soroban smart contract call fails.
 * Contains an optional numeric error code extracted from the contract error.
 *
 * @example
 * ```ts
 * try {
 *   await client.registerParticipant(address, Role.Recycler, 'Alice', 0, 0, address)
 * } catch (err) {
 *   if (err instanceof ContractError) {
 *     console.error(`Contract error #${err.code ?? 'unknown'}: ${err.message}`)
 *   }
 * }
 * ```
 */
export class ContractError extends Error {
  /** @param message - Human-readable error description. */
  constructor(
    message: string,
    /** Numeric error code from the contract, if available. */
    public code?: number
  ) {
    super(message)
    this.name = 'ContractError'
  }
}

/**
 * Error thrown when a transaction fails on-chain after submission.
 *
 * @example
 * ```ts
 * try {
 *   await client.transferWaste(wasteId, from, to, lat, lon, note, from)
 * } catch (err) {
 *   if (err instanceof TransactionError) {
 *     console.error(`Transaction failed on-chain. TxHash: ${err.txHash ?? 'none'}`)
 *   }
 * }
 * ```
 */
export class TransactionError extends Error {
  /** @param message - Description of what went wrong. */
  constructor(
    message: string,
    /** Transaction hash if available. */
    public txHash?: string,
    /** Result XDR from the failed transaction if available. */
    public resultXdr?: string
  ) {
    super(message)
    this.name = 'TransactionError'
  }
}

/**
 * Error thrown when wallet signing fails or is rejected by the user.
 *
 * @example
 * ```ts
 * try {
 *   await client.submitMaterial(submitter, WasteType.Plastic, 500n, 0n, 0n, submitter)
 * } catch (err) {
 *   if (err instanceof SigningError) {
 *     console.error(`User rejected signing or wallet unavailable: ${err.message}`)
 *   }
 * }
 * ```
 */
export class SigningError extends Error {
  /** @param message - Description of the signing failure. */
  constructor(message: string) {
    super(message)
    this.name = 'SigningError'
  }
}

/**
 * Error thrown when network configuration is invalid or connection fails.
 *
 * @example
 * ```ts
 * try {
 *   const config = resolveNetwork('invalid-network' as any)
 * } catch (err) {
 *   if (err instanceof NetworkError) {
 *     console.error(`Network configuration error: ${err.message}`)
 *   }
 * }
 * ```
 */
export class NetworkError extends Error {
  /** @param message - Description of the network issue. */
  constructor(
    message: string,
    /** The RPC URL that failed. */
    public rpcUrl?: string
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}

/**
 * Error thrown when a transaction confirmation times out.
 *
 * @example
 * ```ts
 * try {
 *   await client.submitMaterial(submitter, WasteType.Plastic, 500n, 0n, 0n, submitter)
 * } catch (err) {
 *   if (err instanceof TimeoutError) {
 *     console.error(`Transaction confirmation timed out: ${err.message}`)
 *   }
 * }
 * ```
 */
export class TimeoutError extends Error {
  /** @param message - Description of the timeout. */
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/** Union type of all SDK-specific errors. */
export type SdkError = ContractError | TransactionError | SigningError | NetworkError | TimeoutError

