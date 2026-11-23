/**
 * Shared schema definitions for API contract tests between the frontend and
 * the indexer.  These types mirror what the indexer API actually returns and
 * what the frontend API client expects.  Any drift between the two sides will
 * be caught by the tests in this directory.
 *
 * Issue #954 – Add API contract tests between frontend and indexer.
 */

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

export const VALID_ROLES = ['Recycler', 'Collector', 'Manufacturer'] as const
export type Role = (typeof VALID_ROLES)[number]

export interface ParticipantSchema {
  address: string // Stellar public key (G…)
  role: Role
  name: string
  latitude: number
  longitude: number
  registeredAtLedger: number
  registeredAt: string // ISO-8601 date string
  isActive: boolean
}

export interface ParticipantListSchema {
  participants: ParticipantSchema[]
  total: number
  limit: number
  offset: number
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EventSchema {
  id: number | string
  ledger_sequence: number
  transaction_hash: string
  contract_id: string
  event_type: string
  topic: unknown
  value: unknown
}

export interface EventListSchema {
  events: EventSchema[]
  total: number
  limit: number
  offset: number
}

// ---------------------------------------------------------------------------
// Health / metrics (indexer-only)
// ---------------------------------------------------------------------------

export interface HealthSchema {
  status: 'ok' | 'degraded' | 'down'
  uptime?: number
}

// ---------------------------------------------------------------------------
// Frontend API types (from frontend/src/api/types.ts)
// ---------------------------------------------------------------------------

export const WASTE_TYPES = [
  'Paper',
  'PetPlastic',
  'Plastic',
  'Metal',
  'Glass',
  'Organic',
  'Electronic'
] as const
export type WasteType = (typeof WASTE_TYPES)[number]

/** Frontend Participant shape (from frontend/src/api/types.ts) */
export interface FrontendParticipantSchema {
  address: string
  role: Role
  name: string
  latitude: number
  longitude: number
  registered_at: number // epoch seconds from contract
}

/** Frontend Waste shape */
export interface FrontendWasteSchema {
  waste_id: string // bigint serialised as string
  waste_type: number // WasteType numeric enum
  weight: string
  current_owner: string
  latitude: string
  longitude: string
  recycled_timestamp: number
  is_active: boolean
  is_confirmed: boolean
  confirmer: string
}

/** Frontend Incentive shape */
export interface FrontendIncentiveSchema {
  id: number
  rewarder: string
  waste_type: number
  reward_points: number
  total_budget: number
  remaining_budget: number
  active: boolean
  created_at: number
}

// ---------------------------------------------------------------------------
// Helpers – runtime validators used inside the tests
// ---------------------------------------------------------------------------

/**
 * Asserts that `value` is a string. Throws a descriptive error otherwise.
 */
export function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`Contract violation: "${field}" must be a string, got ${typeof value}`)
  }
}

export function assertNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new TypeError(
      `Contract violation: "${field}" must be a finite number, got ${typeof value}`
    )
  }
}

export function assertBoolean(value: unknown, field: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`Contract violation: "${field}" must be a boolean, got ${typeof value}`)
  }
}

export function assertArray(value: unknown, field: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Contract violation: "${field}" must be an array, got ${typeof value}`)
  }
}

export function assertValidRole(value: unknown, field: string): asserts value is Role {
  assertString(value, field)
  if (!VALID_ROLES.includes(value as Role)) {
    throw new TypeError(
      `Contract violation: "${field}" must be one of [${VALID_ROLES.join(', ')}], got "${value}"`
    )
  }
}

export function assertIsoDate(value: unknown, field: string): asserts value is string {
  assertString(value, field)
  if (isNaN(Date.parse(value))) {
    throw new TypeError(
      `Contract violation: "${field}" must be a valid ISO-8601 date string, got "${value}"`
    )
  }
}

/**
 * Validates a Participant object returned by the indexer API against the
 * expected schema.  Throws a descriptive error on the first violation.
 */
export function validateIndexerParticipant(p: unknown): asserts p is ParticipantSchema {
  if (typeof p !== 'object' || p === null) {
    throw new TypeError('Participant must be a non-null object')
  }
  const obj = p as Record<string, unknown>

  assertString(obj.address, 'participant.address')
  assertValidRole(obj.role, 'participant.role')
  assertString(obj.name, 'participant.name')
  assertNumber(obj.latitude, 'participant.latitude')
  assertNumber(obj.longitude, 'participant.longitude')
  assertNumber(obj.registeredAtLedger, 'participant.registeredAtLedger')
  assertIsoDate(obj.registeredAt, 'participant.registeredAt')
  assertBoolean(obj.isActive, 'participant.isActive')
}

/**
 * Validates a ParticipantList response from the indexer.
 */
export function validateIndexerParticipantList(res: unknown): asserts res is ParticipantListSchema {
  if (typeof res !== 'object' || res === null) {
    throw new TypeError('ParticipantList must be a non-null object')
  }
  const obj = res as Record<string, unknown>

  assertArray(obj.participants, 'participantList.participants')
  assertNumber(obj.total, 'participantList.total')
  assertNumber(obj.limit, 'participantList.limit')
  assertNumber(obj.offset, 'participantList.offset')

  for (const p of obj.participants as unknown[]) {
    validateIndexerParticipant(p)
  }
}

/**
 * Validates an Event object returned by the indexer.
 */
export function validateIndexerEvent(e: unknown): asserts e is EventSchema {
  if (typeof e !== 'object' || e === null) {
    throw new TypeError('Event must be a non-null object')
  }
  const obj = e as Record<string, unknown>

  if (typeof obj.id !== 'number' && typeof obj.id !== 'string') {
    throw new TypeError('Contract violation: "event.id" must be a number or string')
  }
  assertNumber(obj.ledger_sequence as unknown, 'event.ledger_sequence')
  assertString(obj.transaction_hash, 'event.transaction_hash')
  assertString(obj.contract_id, 'event.contract_id')
  assertString(obj.event_type, 'event.event_type')
}

/**
 * Validates an EventList response from the indexer.
 */
export function validateIndexerEventList(res: unknown): asserts res is EventListSchema {
  if (typeof res !== 'object' || res === null) {
    throw new TypeError('EventList must be a non-null object')
  }
  const obj = res as Record<string, unknown>

  assertArray(obj.events, 'eventList.events')
  assertNumber(obj.total, 'eventList.total')
  assertNumber(obj.limit, 'eventList.limit')
  assertNumber(obj.offset, 'eventList.offset')
}
