/**
 * participantService – business logic layer for contract-account / participant
 * records.  Route handlers should call this layer instead of touching queries
 * or DB connections directly.
 */

import {
  Participant,
  ParticipantRole,
  ParticipantQueryResult,
  queryParticipantByAddress,
  queryParticipants,
  upsertParticipant,
  deactivateParticipant
} from '../queries/participantQueries'

export type { Participant, ParticipantRole }

export interface ListParticipantsParams {
  role?: string | null
  isActive?: string | null
  limit?: string | null
  offset?: string | null
}

/** Validate and normalise a role string; throws if invalid. */
function parseRole(raw: string): ParticipantRole {
  const validRoles: ParticipantRole[] = ['Recycler', 'Collector', 'Manufacturer']
  if (!validRoles.includes(raw as ParticipantRole)) {
    throw new ValidationError(`Invalid role "${raw}". Must be one of: ${validRoles.join(', ')}`)
  }
  return raw as ParticipantRole
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(address: string) {
    super(`Participant not found: ${address}`)
    this.name = 'NotFoundError'
  }
}

/**
 * Retrieve a single participant by Stellar address.
 * Throws NotFoundError when no record exists.
 */
export async function getParticipant(address: string): Promise<Participant> {
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    throw new ValidationError('address is required')
  }
  const participant = await queryParticipantByAddress(address.trim())
  if (!participant) {
    throw new NotFoundError(address)
  }
  return participant
}

/**
 * List participants with optional role and active-status filters.
 */
export async function listParticipants(
  params: ListParticipantsParams
): Promise<ParticipantQueryResult> {
  const role = params.role ? parseRole(params.role) : undefined
  const isActive =
    params.isActive === 'true' ? true : params.isActive === 'false' ? false : undefined
  const limit =
    params.limit !== undefined && params.limit !== null
      ? Math.max(1, Math.min(Number(params.limit) || 100, 1000))
      : 100
  const offset =
    params.offset !== undefined && params.offset !== null
      ? Math.max(0, Number(params.offset) || 0)
      : 0

  return queryParticipants({ role, isActive, limit, offset })
}

export interface RegisterParticipantInput {
  address: string
  role: string
  name: string
  latitude: number
  longitude: number
  registeredAtLedger: number
  registeredAt: Date
}

/**
 * Register or update a participant from an on-chain event.
 * Validates all required fields before writing.
 */
export async function registerParticipant(input: RegisterParticipantInput): Promise<Participant> {
  if (!input.address || typeof input.address !== 'string') {
    throw new ValidationError('address is required')
  }
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new ValidationError('name is required')
  }
  if (typeof input.latitude !== 'number' || !isFinite(input.latitude)) {
    throw new ValidationError('latitude must be a finite number')
  }
  if (typeof input.longitude !== 'number' || !isFinite(input.longitude)) {
    throw new ValidationError('longitude must be a finite number')
  }
  if (
    typeof input.registeredAtLedger !== 'number' ||
    !Number.isInteger(input.registeredAtLedger) ||
    input.registeredAtLedger < 0
  ) {
    throw new ValidationError('registeredAtLedger must be a non-negative integer')
  }

  const role = parseRole(input.role)

  return upsertParticipant({
    address: input.address.trim(),
    role,
    name: input.name.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    registeredAtLedger: input.registeredAtLedger,
    registeredAt: input.registeredAt
  })
}

/**
 * Deactivate a participant by Stellar address.
 * Throws NotFoundError when no record exists.
 */
export async function removeParticipant(address: string): Promise<void> {
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    throw new ValidationError('address is required')
  }
  const updated = await deactivateParticipant(address.trim())
  if (!updated) {
    throw new NotFoundError(address)
  }
}
