import type { ScavengerClient } from '@/api/client'

import type { TransferFormData } from './types'

/**
 * Plain transaction logic for material transfers. Nothing in this module
 * touches React, so the submission flow can be unit-tested with a mocked client.
 */

export type TransferClient = Pick<ScavengerClient, 'transferWaste'>

export interface SubmitTransferParams {
  wasteId: bigint
  from: string
  to: string
  note: string
}

/** Combines the free-text fields into the single on-chain note. */
export function buildTransferNote(
  form: Pick<TransferFormData, 'transferNotes' | 'conditionNotes' | 'handlingInstructions'>
): string {
  const combined = [
    form.transferNotes,
    form.conditionNotes ? `Condition: ${form.conditionNotes}` : '',
    form.handlingInstructions ? `Handling: ${form.handlingInstructions}` : '',
  ]
    .filter(Boolean)
    .join(' | ')

  return combined || 'Transfer'
}

/** Submits a waste transfer through the given client. */
export async function submitWasteTransfer(
  client: TransferClient,
  params: SubmitTransferParams
) {
  if (!params.from) throw new Error('No wallet connected.')
  return client.transferWaste(
    params.wasteId,
    params.from,
    params.to,
    BigInt(0),
    BigInt(0),
    params.note,
    params.from
  )
}
