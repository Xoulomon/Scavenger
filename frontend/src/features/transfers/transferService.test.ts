import { describe, expect, it, vi } from 'vitest'

import { transferDestinationSchema } from './schemas'
import { buildTransferNote, submitWasteTransfer } from './service'
import type { TransferFormData } from './types'

const VALID_ADDRESS = 'G' + 'A'.repeat(55)

const form = (overrides: Partial<TransferFormData> = {}): TransferFormData => ({
  wasteId: 1n,
  waste: null,
  recipientAddress: VALID_ADDRESS,
  transferNotes: '',
  conditionNotes: '',
  handlingInstructions: '',
  beforePhotos: [],
  afterPhotos: [],
  senderConfirmed: false,
  ...overrides,
})

describe('buildTransferNote', () => {
  it('falls back to "Transfer" when no notes are given', () => {
    expect(buildTransferNote(form())).toBe('Transfer')
  })

  it('joins transfer, condition and handling notes with a separator', () => {
    expect(
      buildTransferNote(
        form({
          transferNotes: 'Handover at depot',
          conditionNotes: 'Dry',
          handlingInstructions: 'Keep sealed',
        })
      )
    ).toBe('Handover at depot | Condition: Dry | Handling: Keep sealed')
  })
})

describe('submitWasteTransfer', () => {
  it('calls transferWaste with the sender, recipient and zero fees', async () => {
    const transferWaste = vi.fn().mockResolvedValue('ok')
    const result = await submitWasteTransfer(
      { transferWaste } as never,
      { wasteId: 9n, from: 'GSENDER', to: VALID_ADDRESS, note: 'note' }
    )

    expect(result).toBe('ok')
    expect(transferWaste).toHaveBeenCalledWith(
      9n,
      'GSENDER',
      VALID_ADDRESS,
      0n,
      0n,
      'note',
      'GSENDER'
    )
  })

  it('refuses to submit without a connected wallet', async () => {
    const transferWaste = vi.fn()
    await expect(
      submitWasteTransfer({ transferWaste } as never, {
        wasteId: 9n,
        from: '',
        to: VALID_ADDRESS,
        note: 'note',
      })
    ).rejects.toThrow('No wallet connected.')
    expect(transferWaste).not.toHaveBeenCalled()
  })

  it('propagates client errors to the caller', async () => {
    const transferWaste = vi.fn().mockRejectedValue(new Error('RPC is unavailable.'))
    await expect(
      submitWasteTransfer({ transferWaste } as never, {
        wasteId: 1n,
        from: 'GSENDER',
        to: VALID_ADDRESS,
        note: 'n',
      })
    ).rejects.toThrow('RPC is unavailable.')
  })
})

describe('transferDestinationSchema', () => {
  it('accepts a 56-character address starting with G', () => {
    expect(transferDestinationSchema.safeParse({ recipientAddress: VALID_ADDRESS }).success).toBe(true)
  })

  it('rejects addresses that are not valid Stellar public keys', () => {
    expect(transferDestinationSchema.safeParse({ recipientAddress: 'GSHORT' }).success).toBe(false)
    expect(transferDestinationSchema.safeParse({ recipientAddress: '' }).success).toBe(false)
  })
})
