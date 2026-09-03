/**
 * @scavngr/sdk – TypeScript SDK for the Scavngr Soroban smart contract.
 *
 * Provides a fully-typed client for all contract functions, pluggable signing
 * strategies (Freighter, secret key), network presets, and a rich error
 * hierarchy so callers can handle contract, network, and signing failures
 * independently.
 *
 * @example Minimal read-only usage
 * ```ts
 * import { ScavengerClient, Network, resolveNetwork } from '@scavngr/sdk'
 *
 * const client = new ScavengerClient({
 *   ...resolveNetwork(Network.Testnet),
 *   contractId: 'CC...',
 * })
 * const metrics = await client.getMetrics()
 * ```
 *
 * @example Submit a transaction with Freighter
 * ```ts
 * import { ScavengerClient, FreighterSigningStrategy, Network, WasteType, resolveNetwork } from '@scavngr/sdk'
 *
 * const client = new ScavengerClient({
 *   ...resolveNetwork(Network.Testnet),
 *   contractId: 'CC...',
 * })
 * client.setSigningStrategy(new FreighterSigningStrategy())
 *
 * await client.submitMaterial(address, WasteType.Plastic, 500n, 0n, 0n, address)
 * ```
 *
 * @packageDocumentation
 */

// ── Main client ──────────────────────────────────────────────────────────────

/** The primary entry point. Use `ScavengerClient` to call any contract function. */
export { ScavengerClient } from './client'

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Base connection options required by `ScavengerClient`.
 * @see SdkClientOptions for the extended SDK variant with retry/logging options.
 */
export type { ClientOptions } from './types'

export {
  // Enum of supported participant roles (Recycler, Collector, Manufacturer).
  Role,
  // Enum of waste material categories (Paper, PetPlastic, Plastic, …).
  WasteType,
  // Certification level tiers for participants (Beginner → Expert).
  CertificationLevel,
  // Supported Stellar network presets. Pass to `resolveNetwork()`.
  Network,
} from './types'

export type {
  // A registered participant including address, role, name, and coordinates.
  Participant,
  // An active incentive program offering rewards for a specific waste type.
  Incentive,
  // A submitted material/waste item before confirmation.
  Material,
  // A confirmed waste item tracked through the supply chain.
  Waste,
  // A record of waste ownership transfer between participants.
  WasteTransfer,
  // Per-participant recycling statistics.
  ParticipantStats,
  // Global ecosystem-wide metrics (total wastes, tokens, participants).
  GlobalMetrics,
  // Aggregated supply chain statistics.
  SupplyChainStats,
  // Stellar network RPC configuration.
  NetworkConfig,
  // Single item in a batch material submission.
  MaterialBatchItem,
} from './types'

// ── Errors ───────────────────────────────────────────────────────────────────

export {
  // Thrown when the Soroban contract returns an error code.
  ContractError,
  // Thrown when an on-chain transaction fails after submission.
  TransactionError,
  // Thrown when wallet signing is rejected or unavailable.
  SigningError,
  // Thrown when network configuration is invalid or the RPC is unreachable.
  NetworkError,
  // Thrown when transaction confirmation polling exceeds `pollTimeoutMs`.
  TimeoutError,
} from './errors'

/** Union of all SDK-specific error types for exhaustive catch handling. */
export type { SdkError } from './errors'

// ── Network utilities ─────────────────────────────────────────────────────────

export {
  // Resolve a `Network` preset or a custom `NetworkConfig` into a
  // `{ rpcUrl, networkPassphrase }` object ready for `ScavengerClient`.
  resolveNetwork,
  // Return `true` if the address matches the Stellar base32 public key
  // format (`/^G[A-Z2-7]{55}$/`).
  isValidStellarAddress,
  // List all recognized network preset names.
  getAvailableNetworks,
  // Return a human-readable display label for a network (e.g. "Testnet").
  getNetworkLabel,
} from './network'

// ── Signing strategies ────────────────────────────────────────────────────────

export {
  // Sign a transaction using the Freighter browser wallet.
  // Throws `SigningError` if Freighter is not installed or the user rejects.
  signWithFreighter,
  // Sign a transaction using a raw Stellar secret key.
  // Intended for server-side or CLI usage only — never expose secret keys
  // in browser code.
  signWithSecretKey,
  // Signing strategy adapter for the Freighter browser extension.
  FreighterSigningStrategy,
  // Signing strategy adapter for a raw secret key string.
  SecretKeySigningStrategy,
} from './signing'

/**
 * Interface for pluggable signing strategies.
 * Implement this to add support for additional wallets (Albedo, WalletConnect, etc.).
 */
export type { SigningStrategy } from './signing'
