/**
 * Shared Domain Test Factories (#1752)
 *
 * Reusable factories for creating test data that represents domain entities
 * (participants, waste, incentives, transfers) across frontend, indexer, and
 * integration tests.
 *
 * These factories produce deterministic, valid test data that can be used
 * directly in tests or customized via the builder pattern.
 *
 * Usage:
 * ```ts
 * import { createParticipant, createWaste } from '@scavenger/test-mocks';
 *
 * const recycler = createParticipant({ role: ParticipantRole.Recycler });
 * const waste = createWaste({ current_owner: recycler.address });
 * ```
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export enum ParticipantRole {
  Recycler = 0,
  Collector = 1,
  Processor = 2,
  Rewarder = 3,
  Auditor = 4
}

export enum WasteType {
  Plastic = 0,
  Metal = 1,
  Glass = 2,
  Paper = 3,
  Electronics = 4,
  Organic = 5,
  Textile = 6,
  Hazardous = 7
}

export interface Participant {
  address: string
  name: string
  role: ParticipantRole
  latitude: number
  longitude: number
  registered_at: number
  is_active: boolean
  total_waste_processed?: number
  total_tokens_earned?: number
  reputation_score?: number
}

export interface Waste {
  waste_id: number
  waste_type: WasteType
  weight: number
  current_owner: string
  latitude: number
  longitude: number
  recycled_timestamp: number
  is_active: boolean
  is_confirmed: boolean
  confirmer?: string
  grade?: string
  processing_status?: number
  contamination_level?: number
}

export interface WasteTransfer {
  transfer_id: number
  waste_id: number
  from_address: string
  to_address: string
  transfer_timestamp: number
  transfer_type: string
}

export interface Incentive {
  incentive_id: number
  rewarder: string
  waste_type: WasteType
  initial_reward: number
  total_weight_reward: number
  total_weight_rewarded: number
  is_active: boolean
  start_time: number
  end_time: number
}

export interface TokenReward {
  recipient: string
  amount: number
  waste_id: number
  awarded_at: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const TEST_ADDRESSES = {
  RECYCLER_1: 'GAAA1RECYCLER11111111111111111111111111111111111111111',
  RECYCLER_2: 'GAAA2RECYCLER22222222222222222222222222222222222222222',
  COLLECTOR: 'GAAA3COLLECTOR3333333333333333333333333333333333333333',
  PROCESSOR: 'GAAA4PROCESSOR4444444444444444444444444444444444444444',
  REWARDER: 'GAAA5REWARDER55555555555555555555555555555555555555555',
  AUDITOR: 'GAAA6AUDITOR666666666666666666666666666666666666666666'
} as const

export const DEFAULT_COORDINATES = {
  NYC: { latitude: 40_712_800, longitude: -74_006_000 },
  LA: { latitude: 34_052_230, longitude: -118_243_680 },
  CHICAGO: { latitude: 41_878_110, longitude: -87_629_800 },
  HOUSTON: { latitude: 29_760_430, longitude: -95_369_800 },
  PHOENIX: { latitude: 33_448_370, longitude: -112_074_040 }
} as const

// ─── Participant Factories ───────────────────────────────────────────────────

let participantIdCounter = 1

export interface ParticipantOptions extends Partial<Participant> {
  /** Generate a unique address instead of using a test constant */
  uniqueAddress?: boolean
}

/**
 * Create a test participant with sensible defaults
 */
export function createParticipant(options: ParticipantOptions = {}): Participant {
  const role = options.role ?? ParticipantRole.Recycler
  const address = options.uniqueAddress
    ? `G${role}${String(participantIdCounter++).padStart(54, '0')}`
    : (options.address ?? TEST_ADDRESSES.RECYCLER_1)

  return {
    address,
    name: options.name ?? `Test Recycler ${address.slice(-4)}`,
    role,
    latitude: options.latitude ?? DEFAULT_COORDINATES.NYC.latitude,
    longitude: options.longitude ?? DEFAULT_COORDINATES.NYC.longitude,
    registered_at: options.registered_at ?? Math.floor(Date.now() / 1000) - 86400,
    is_active: options.is_active ?? true,
    total_waste_processed: options.total_waste_processed ?? 0,
    total_tokens_earned: options.total_tokens_earned ?? 0,
    reputation_score: options.reputation_score ?? 100
  }
}

/**
 * Create multiple participants with sequential IDs
 */
export function createParticipants(count: number, options: ParticipantOptions = {}): Participant[] {
  return Array.from({ length: count }, (_, i) =>
    createParticipant({
      ...options,
      uniqueAddress: true,
      name: options.name ?? `Test Recycler ${i + 1}`
    })
  )
}

/**
 * Create a recycler participant
 */
export function createRecycler(options: Omit<ParticipantOptions, 'role'> = {}): Participant {
  return createParticipant({ ...options, role: ParticipantRole.Recycler })
}

/**
 * Create a collector participant
 */
export function createCollector(options: Omit<ParticipantOptions, 'role'> = {}): Participant {
  return createParticipant({ ...options, role: ParticipantRole.Collector })
}

/**
 * Create a processor participant
 */
export function createProcessor(options: Omit<ParticipantOptions, 'role'> = {}): Participant {
  return createParticipant({ ...options, role: ParticipantRole.Processor })
}

/**
 * Create a rewarder participant
 */
export function createRewarder(options: Omit<ParticipantOptions, 'role'> = {}): Participant {
  return createParticipant({ ...options, role: ParticipantRole.Rewarder })
}

// ─── Waste Factories ─────────────────────────────────────────────────────────

let wasteIdCounter = 1

export interface WasteOptions extends Partial<Waste> {}

/**
 * Create a test waste record with sensible defaults
 */
export function createWaste(options: WasteOptions = {}): Waste {
  const wasteId = options.waste_id ?? wasteIdCounter++

  return {
    waste_id: wasteId,
    waste_type: options.waste_type ?? WasteType.Plastic,
    weight: options.weight ?? 1500,
    current_owner: options.current_owner ?? TEST_ADDRESSES.RECYCLER_1,
    latitude: options.latitude ?? DEFAULT_COORDINATES.NYC.latitude,
    longitude: options.longitude ?? DEFAULT_COORDINATES.NYC.longitude,
    recycled_timestamp: options.recycled_timestamp ?? Math.floor(Date.now() / 1000) - 3600,
    is_active: options.is_active ?? true,
    is_confirmed: options.is_confirmed ?? false,
    confirmer: options.confirmer ?? '',
    grade: options.grade,
    processing_status: options.processing_status,
    contamination_level: options.contamination_level
  }
}

/**
 * Create multiple waste records with sequential IDs
 */
export function createWastes(count: number, options: WasteOptions = {}): Waste[] {
  return Array.from({ length: count }, () => createWaste(options))
}

/**
 * Create a confirmed waste record
 */
export function createConfirmedWaste(options: WasteOptions = {}): Waste {
  return createWaste({
    ...options,
    is_confirmed: true,
    confirmer: options.confirmer ?? TEST_ADDRESSES.AUDITOR
  })
}

/**
 * Create waste records of different types
 */
export function createWasteOfEachType(baseOptions: WasteOptions = {}): Waste[] {
  return [
    createWaste({ ...baseOptions, waste_type: WasteType.Plastic }),
    createWaste({ ...baseOptions, waste_type: WasteType.Metal }),
    createWaste({ ...baseOptions, waste_type: WasteType.Glass }),
    createWaste({ ...baseOptions, waste_type: WasteType.Paper }),
    createWaste({ ...baseOptions, waste_type: WasteType.Electronics })
  ]
}

// ─── Waste Transfer Factories ────────────────────────────────────────────────

let transferIdCounter = 1

export interface WasteTransferOptions extends Partial<WasteTransfer> {}

/**
 * Create a test waste transfer with sensible defaults
 */
export function createWasteTransfer(options: WasteTransferOptions = {}): WasteTransfer {
  return {
    transfer_id: options.transfer_id ?? transferIdCounter++,
    waste_id: options.waste_id ?? 1,
    from_address: options.from_address ?? TEST_ADDRESSES.RECYCLER_1,
    to_address: options.to_address ?? TEST_ADDRESSES.COLLECTOR,
    transfer_timestamp: options.transfer_timestamp ?? Math.floor(Date.now() / 1000),
    transfer_type: options.transfer_type ?? 'collection'
  }
}

/**
 * Create a transfer chain for a waste record
 */
export function createTransferChain(wasteId: number, addresses: string[]): WasteTransfer[] {
  const transfers: WasteTransfer[] = []
  for (let i = 0; i < addresses.length - 1; i++) {
    transfers.push(
      createWasteTransfer({
        waste_id: wasteId,
        from_address: addresses[i],
        to_address: addresses[i + 1],
        transfer_timestamp: Math.floor(Date.now() / 1000) - (addresses.length - i - 1) * 3600
      })
    )
  }
  return transfers
}

// ─── Incentive Factories ─────────────────────────────────────────────────────

let incentiveIdCounter = 1

export interface IncentiveOptions extends Partial<Incentive> {}

/**
 * Create a test incentive with sensible defaults
 */
export function createIncentive(options: IncentiveOptions = {}): Incentive {
  const now = Math.floor(Date.now() / 1000)

  return {
    incentive_id: options.incentive_id ?? incentiveIdCounter++,
    rewarder: options.rewarder ?? TEST_ADDRESSES.REWARDER,
    waste_type: options.waste_type ?? WasteType.Plastic,
    initial_reward: options.initial_reward ?? 50,
    total_weight_reward: options.total_weight_reward ?? 100000,
    total_weight_rewarded: options.total_weight_rewarded ?? 0,
    is_active: options.is_active ?? true,
    start_time: options.start_time ?? now - 86400,
    end_time: options.end_time ?? now + 86400 * 30
  }
}

/**
 * Create an expired incentive
 */
export function createExpiredIncentive(options: IncentiveOptions = {}): Incentive {
  const now = Math.floor(Date.now() / 1000)
  return createIncentive({
    ...options,
    is_active: false,
    start_time: now - 86400 * 60,
    end_time: now - 86400 * 30
  })
}

/**
 * Create a fully claimed incentive
 */
export function createFullyClaimedIncentive(options: IncentiveOptions = {}): Incentive {
  return createIncentive({
    ...options,
    total_weight_rewarded: options.total_weight_reward ?? 100000,
    is_active: false
  })
}

// ─── Token Reward Factories ──────────────────────────────────────────────────

export interface TokenRewardOptions extends Partial<TokenReward> {}

/**
 * Create a test token reward with sensible defaults
 */
export function createTokenReward(options: TokenRewardOptions = {}): TokenReward {
  return {
    recipient: options.recipient ?? TEST_ADDRESSES.RECYCLER_1,
    amount: options.amount ?? 500,
    waste_id: options.waste_id ?? 1,
    awarded_at: options.awarded_at ?? Math.floor(Date.now() / 1000)
  }
}

// ─── Seed Data Generators ────────────────────────────────────────────────────

/**
 * Generate a complete seed dataset for testing
 */
export function generateSeedData() {
  const recyclers = [
    createRecycler({ address: TEST_ADDRESSES.RECYCLER_1, name: 'Alice Recycler' }),
    createRecycler({ address: TEST_ADDRESSES.RECYCLER_2, name: 'Bob Recycler' })
  ]

  const collector = createCollector({
    address: TEST_ADDRESSES.COLLECTOR,
    name: 'Charlie Collector'
  })

  const processor = createProcessor({
    address: TEST_ADDRESSES.PROCESSOR,
    name: 'Diana Processor'
  })

  const rewarder = createRewarder({
    address: TEST_ADDRESSES.REWARDER,
    name: 'Eve Rewarder'
  })

  const participants = [...recyclers, collector, processor, rewarder]

  const wastes = [
    createWaste({
      waste_id: 1,
      current_owner: TEST_ADDRESSES.RECYCLER_1,
      waste_type: WasteType.Plastic,
      weight: 1500
    }),
    createWaste({
      waste_id: 2,
      current_owner: TEST_ADDRESSES.RECYCLER_2,
      waste_type: WasteType.Metal,
      weight: 2500
    }),
    createConfirmedWaste({
      waste_id: 3,
      current_owner: TEST_ADDRESSES.PROCESSOR,
      waste_type: WasteType.Glass,
      weight: 3000
    })
  ]

  const transfers = createTransferChain(1, [
    TEST_ADDRESSES.RECYCLER_1,
    TEST_ADDRESSES.COLLECTOR,
    TEST_ADDRESSES.PROCESSOR
  ])

  const incentives = [
    createIncentive({ waste_type: WasteType.Plastic, initial_reward: 50 }),
    createIncentive({ waste_type: WasteType.Metal, initial_reward: 75 })
  ]

  const rewards = [
    createTokenReward({ recipient: TEST_ADDRESSES.RECYCLER_1, waste_id: 1, amount: 500 }),
    createTokenReward({ recipient: TEST_ADDRESSES.RECYCLER_2, waste_id: 2, amount: 750 })
  ]

  return {
    participants,
    recyclers,
    collector,
    processor,
    rewarder,
    wastes,
    transfers,
    incentives,
    rewards
  }
}

/**
 * Reset all ID counters (useful in beforeEach hooks)
 */
export function resetFactoryCounters() {
  participantIdCounter = 1
  wasteIdCounter = 1
  transferIdCounter = 1
  incentiveIdCounter = 1
}
