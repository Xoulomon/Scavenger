/**
 * Zod schemas for entities defined in @scavngr/types.
 *
 * Forms and the API contract both validate against these, so a value that the
 * shared package defines is accepted by the form that collects it.
 */
import { z } from 'zod'
import { WasteType } from '@scavngr/types'

/** Waste material type, derived from the shared enum. */
export const wasteTypeSchema = z.nativeEnum(WasteType)

/** Stellar public key: 56 chars, starts with G. */
export const stellarAddressSchema = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar address.')
