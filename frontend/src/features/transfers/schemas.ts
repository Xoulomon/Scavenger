import { z } from 'zod'

import { stellarAddressSchema } from '@/lib/validation/stellarAddress'

/** Destination step: the recipient must be a valid Stellar public key. */
export const transferDestinationSchema = z.object({
  recipientAddress: stellarAddressSchema
})

export type TransferDestination = z.infer<typeof transferDestinationSchema>

/** Handling instructions for a transfer. */
export const transferHandlingInstructionsSchema = z.enum([
  'standard',
  'fragile',
  'perishable',
  'hazardous'
])

export type TransferHandlingInstructions = z.infer<typeof transferHandlingInstructionsSchema>

/** Condition of the item being transferred. */
export const transferConditionSchema = z.enum(['new', 'like-new', 'good', 'fair', 'poor'])

export type TransferCondition = z.infer<typeof transferConditionSchema>

/**
 * Full transfer form: recipient, notes, condition, and handling instructions.
 * Shared between form validation (react-hook-form + zodResolver) and types.
 */
export const transferFormSchema = z.object({
  recipientAddress: stellarAddressSchema,
  notes: z
    .string()
    .trim()
    .max(500, 'Notes must be 500 characters or fewer')
    .optional()
    .or(z.literal('')),
  condition: transferConditionSchema,
  handlingInstructions: transferHandlingInstructionsSchema
})

export type TransferForm = z.infer<typeof transferFormSchema>

/** Default values for the full transfer form. */
export const transferFormDefaults: TransferForm = {
  recipientAddress: '',
  notes: '',
  condition: 'good',
  handlingInstructions: 'standard'
}
