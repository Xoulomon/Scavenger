import type { Waste } from '@/api/types'

export type TransferStep = 'select' | 'destination' | 'documentation' | 'review'

export type TransferStatus = 'pending' | 'in-transit' | 'delivered' | 'confirmed'

export interface TransferFormData {
  wasteId: bigint | null
  waste: Waste | null
  recipientAddress: string
  transferNotes: string
  conditionNotes: string
  handlingInstructions: string
  beforePhotos: File[]
  afterPhotos: File[]
  senderConfirmed: boolean
}

export interface LocalTransferRecord {
  wasteId: number
  from: string
  to: string
  transferredAt: number
  notes: string
  conditionNotes: string
  handlingInstructions: string
  status: TransferStatus
}
