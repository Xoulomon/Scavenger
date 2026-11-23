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
export const stellarAddressSchema = z.string().regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar address.')

/** Waste weight in kilograms: positive, at most 100,000 kg. */
export const wasteWeightSchema = z
  .number({ invalid_type_error: 'Weight must be a number.' })
  .positive('Weight must be greater than zero.')
  .max(100_000, 'Weight must not exceed 100,000 kg.')

/** Geographic coordinates: latitude in [-90, 90], longitude in [-180, 180]. */
export const coordinatesSchema = z.object({
  latitude: z
    .number({ invalid_type_error: 'Latitude must be a number.' })
    .min(-90, 'Latitude must be at least -90.')
    .max(90, 'Latitude must not exceed 90.'),
  longitude: z
    .number({ invalid_type_error: 'Longitude must be a number.' })
    .min(-180, 'Longitude must be at least -180.')
    .max(180, 'Longitude must not exceed 180.')
})

/** Free-form notes: optional, trimmed, at most 500 characters. */
export const notesSchema = z
  .string()
  .trim()
  .max(500, 'Notes must not exceed 500 characters.')
  .optional()

/** Inferred types shared with feature forms and API contracts. */
export type WasteTypeValue = z.infer<typeof wasteTypeSchema>
export type StellarAddress = z.infer<typeof stellarAddressSchema>
export type WasteWeight = z.infer<typeof wasteWeightSchema>
export type Coordinates = z.infer<typeof coordinatesSchema>
export type Notes = z.infer<typeof notesSchema>
