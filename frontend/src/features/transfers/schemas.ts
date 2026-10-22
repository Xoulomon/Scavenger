import { z } from 'zod'

import { stellarAddressSchema } from '@/lib/validation/stellarAddress'

/** Destination step: the recipient must be a valid Stellar public key. */
export const transferDestinationSchema = z.object({
  recipientAddress: stellarAddressSchema,
})

export type TransferDestination = z.infer<typeof transferDestinationSchema>
