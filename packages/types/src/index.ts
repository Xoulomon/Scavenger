/**
 * @fileoverview Shared TypeScript types for the Scavngr ecosystem
 * 
 * This package consolidates all common types used across frontend, indexer, 
 * and SDK packages to ensure consistency and reduce duplication.
 */

// ===========================
// Core Enums and Constants
// ===========================

/** Roles a participant can have in the Scavngr ecosystem */
export enum ParticipantRole {
  Recycler = 0,
  Collector = 1,
  Manufacturer = 2,
}

/** Types of waste materials tracked by the system */
export enum WasteType {
  Paper = 0,
  PetPlastic = 1,
  Plastic = 2,
  Metal = 3,
  Glass = 4,
  Organic = 5,
  Electronic = 6,
}

/** Status of waste items in the system */
export enum WasteStatus {
  Submitted = 'submitted',
  Verified = 'verified',
  Transferred = 'transferred',
  Deactivated = 'deactivated',
}

/** Certification levels for participants */
export enum CertificationLevel {
  Beginner = 0,
  Intermediate = 1,
  Advanced = 2,
  Expert = 3,
}

/** Supported Stellar networks */
export enum StellarNetwork {
  Standalone = 'STANDALONE',
  Testnet = 'TESTNET',
  Futurenet = 'FUTURENET',
  Mainnet = 'MAINNET',
}

// ===========================
// Type Mappings for Contract Integration
// ===========================

export const WASTE_TYPE_MAP: Record<number, keyof typeof WasteType> = {
  0: 'Paper',
  1: 'PetPlastic', 
  2: 'Plastic',
  3: 'Metal',
  4: 'Glass',
  5: 'Organic',
  6: 'Electronic',
} as const

export const ROLE_MAP: Record<number, keyof typeof ParticipantRole> = {
  0: 'Recycler',
  1: 'Collector', 
  2: 'Manufacturer',
} as const

export const CERTIFICATION_MAP: Record<number, keyof typeof CertificationLevel> = {
  0: 'Beginner',
  1: 'Intermediate',
  2: 'Advanced', 
  3: 'Expert',
} as const

// ===========================
// Core Data Interfaces
// ===========================

/** A registered participant in the Scavngr ecosystem */
export interface Participant {
  address: string
  role: ParticipantRole
  name: string
  latitude: number
  longitude: number
  registeredAt: number
}

/** Extended participant information including statistics */
export interface ParticipantInfo extends Participant {
  stats: ParticipantStats
}

/** Statistics for a specific participant */
export interface ParticipantStats {
  totalEarned: bigint
  materialsSubmitted: number
  transfersCount: number
  wastesByType: Record<WasteType, number>
}

/** A waste item in the system */
export interface Waste {
  id: string | bigint
  type: WasteType
  weight: number | bigint
  owner: string
  currentOwner?: string
  submitter?: string
  latitude: number | bigint
  longitude: number | bigint
  status: WasteStatus
  createdAt: number
  isActive: boolean
  isConfirmed: boolean
  confirmer?: string
}

/** A material submission (legacy interface for compatibility) */
export interface Material extends Omit<Waste, 'id' | 'status'> {
  id: number
  verified: boolean
  submittedAt: number
}

/** An incentive program for rewarding waste collection */
export interface Incentive {
  id: string | number
  rewarder: string
  wasteType: WasteType
  rewardPoints: number
  totalBudget: number
  remainingBudget?: number
  active: boolean
  createdAt: number
}

/** A record of waste transfer between participants */
export interface WasteTransfer {
  wasteId: string | number
  from: string
  to: string
  transferredAt: number
  latitude?: number
  longitude?: number
  note?: string
}

/** Global ecosystem metrics */
export interface GlobalMetrics {
  totalWastesCount: number
  totalTokensEarned: bigint
  totalParticipants: number
  activeIncentives: number
}

/** Supply chain aggregated statistics */
export interface SupplyChainStats {
  totalWastes: bigint
  totalWeight: bigint
  totalTokens: bigint
  averageProcessingTime: number
}

// ===========================
// Contract and Network Configuration
// ===========================

/** Stellar network configuration */
export interface NetworkConfig {
  rpcUrl: string
  networkPassphrase: string
  network: StellarNetwork
}

/** Contract configuration for connecting to Scavngr */
export interface ContractConfig {
  contractId: string
  network: StellarNetwork
  rpcUrl: string
}

/** Options for initializing SDK clients */
export interface ClientOptions extends ContractConfig {
  pollTimeoutMs?: number
  pollIntervalMs?: number
}

// ===========================
// API and Response Types
// ===========================

/** Standard API response wrapper */
export interface ApiResponse<T> {
  data: T
  status: number
  message?: string
  timestamp?: number
}

// ===========================
// Canonical Error Taxonomy
// ===========================

/**
 * Canonical dot-notation error codes shared across the entire Scavngr stack.
 *
 * The backend (Rust/actix-web) emits these as the `code` field of every
 * error response. The indexer (TypeScript) uses these same values so that
 * API consumers can `switch` on a single set of codes regardless of which
 * service originated the error.
 *
 * Full reference: docs/ERROR_CONTRACT.md
 */
export type ErrorCode =
  // Authentication
  | 'auth.unauthorized'
  | 'auth.forbidden'
  | 'auth.token_expired'
  | 'auth.invalid_token'
  | 'auth.csrf_mismatch'
  // Validation
  | 'validation.field_error'
  | 'validation.multiple_errors'
  | 'validation.format_error'
  // Resource lookup
  | `not_found.${string}`
  // Database / persistence (indexer-side)
  | 'database.query_failed'
  // Network / upstream
  | 'network.connection_failed'
  // Contract (Stellar/Soroban)
  | 'contract.call_failed'
  | 'contract.not_found'
  | 'contract.invalid_state'
  | 'contract.insufficient_balance'
  | 'contract.unauthorized'
  // Export
  | 'export.csv_error'
  | 'export.json_error'
  | 'export.pdf_error'
  | 'export.serialization_error'
  | 'export.invalid_format'
  // Rate limiting
  | 'rate_limit.exceeded'
  // Catch-all
  | 'bad_request'
  | 'internal'
  // Allow service-specific extensions without breaking the type
  | (string & Record<never, never>)

/** API error structure returned by every error response. */
export interface ApiError {
  /** Dot-notation canonical code — see `ErrorCode` for known values. */
  code: ErrorCode
  /** Human-readable description of the error. */
  message: string
  /** HTTP status code mirrored from the response status line. */
  status?: number
  /** Per-field validation details (present only for validation errors). */
  fields?: Array<{ field: string; message: string }>
  /** Arbitrary extra context attached by the originating service. */
  details?: Record<string, unknown>
}

/** Query result wrapper for React Query and similar libraries */
export interface QueryResult<T> {
  data: T | null
  isLoading: boolean
  error: ApiError | null
  isError: boolean
  isSuccess: boolean
}

// ===========================
// Form and Input Types
// ===========================

/** Form data for participant registration */
export interface RegistrationFormData {
  name: string
  role: ParticipantRole
  latitude: number
  longitude: number
}

/** Form data for waste submission */
export interface WasteSubmissionFormData {
  type: WasteType
  weight: number
  latitude: number
  longitude: number
  description?: string
}

/** Form data for waste transfer */
export interface WasteTransferFormData {
  wasteId: string
  toAddress: string
  latitude: number
  longitude: number
  note?: string
}

/** Form data for incentive creation */
export interface IncentiveFormData {
  wasteType: WasteType
  rewardPoints: number
  totalBudget: number
  description?: string
}

/** Batch submission item for multiple materials */
export interface MaterialBatchItem {
  wasteType: WasteType
  weight: number | bigint
  latitude?: number
  longitude?: number
}

// ===========================
// Event and Contract Types
// ===========================

/** Raw contract event from Stellar indexing */
export interface RawContractEvent {
  ledgerSequence: number
  ledgerCloseTime: Date
  transactionHash: string
  contractId: string
  eventType: string
  topic: string[]
  value: unknown
}

/** Processed contract event with typed data */
export interface ContractEvent<T = unknown> {
  type: string
  data: T
  blockHeight: number
  timestamp: number
  transactionHash: string
}

// ===========================
// Utility Types
// ===========================

/** Pagination parameters for API queries */
export interface PaginationParams {
  limit?: number
  offset?: number
  cursor?: string
}

/** Sorting parameters for API queries */
export interface SortParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/** Filter parameters for waste queries */
export interface WasteFilters {
  type?: WasteType
  status?: WasteStatus
  owner?: string
  dateFrom?: Date
  dateTo?: Date
}

/** Filter parameters for participant queries */
export interface ParticipantFilters {
  role?: ParticipantRole
  certified?: boolean
  location?: {
    latitude: number
    longitude: number
    radius: number
  }
}

/** Geolocation coordinates */
export interface Coordinates {
  latitude: number
  longitude: number
}

/** Geographic bounds for area queries */
export interface GeoBounds {
  north: number
  south: number
  east: number
  west: number
}

// ===========================
// Export All Types
// ===========================

export type {
  // Re-export commonly used utility types
  Partial,
  Required,
  Pick,
  Omit,
  Record,
} from 'typescript'