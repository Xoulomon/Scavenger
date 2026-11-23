import { z } from 'zod'

import { Role } from '@/api/types'

import type { FormDraft, ValidationErrors } from './types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Step 1: a role must be chosen. */
export const roleStepSchema = z.object({
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Please select a role to continue.' })
  })
})

/** Inferred type for step 1 form values. */
export type RoleStepValues = z.infer<typeof roleStepSchema>

/** Step 2: display name is required; email is optional but must be well-formed if given. */
export const profileStepSchema = z.object({
  displayName: z.string().refine((v) => v.trim().length > 0, 'Display name is required.'),
  email: z
    .string()
    .refine((v) => !v || EMAIL_PATTERN.test(v), 'Please enter a valid email address.')
})

/** Inferred type for step 2 form values. */
export type ProfileStepValues = z.infer<typeof profileStepSchema>

/** Step 3: an identity document upload is required. */
export const kycStepSchema = z.object({
  identityDoc: z
    .unknown()
    .refine((v) => v !== null && v !== undefined, 'Please upload an identity document.')
})

/** Inferred type for step 3 form values. */
export type KycStepValues = z.infer<typeof kycStepSchema>

/** Step 4: coordinates and terms agreement are required. */
export const confirmStepSchema = z.object({
  latitude: z.string().refine((v) => v.trim().length > 0, 'Latitude is required.'),
  longitude: z.string().refine((v) => v.trim().length > 0, 'Longitude is required.'),
  agreedToTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the terms and conditions.' })
  })
})

/** Inferred type for step 4 form values. */
export type ConfirmStepValues = z.infer<typeof confirmStepSchema>

const STEP_SCHEMAS: Record<number, z.ZodTypeAny> = {
  1: roleStepSchema,
  2: profileStepSchema,
  3: kycStepSchema,
  4: confirmStepSchema
}

/** Union of all inferred step value types. */
export type ParticipantStepValues =
  RoleStepValues | ProfileStepValues | KycStepValues | ConfirmStepValues

/**
 * Validates one wizard step and returns a map of field name to message.
 * An empty object means the step is valid.
 */
export function validateParticipantStep(step: number, draft: FormDraft): ValidationErrors {
  const schema = STEP_SCHEMAS[step]
  if (!schema) return {}

  const result = schema.safeParse(draft)
  if (result.success) return {}

  const errors: ValidationErrors = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0])
    if (!(key in errors)) errors[key] = issue.message
  }
  return errors
}
