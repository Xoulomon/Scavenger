import { CheckCircle2, Clock, FileText, MapPin, Package, ShieldCheck, Truck } from 'lucide-react'
import type { ReactNode } from 'react'

import { TRANSFER_STATUSES } from '@/lib/constants'

import type { TransferFormData, TransferStatus, TransferStep } from './types'

export { TRANSFER_STATUSES }

export const STEPS: { key: TransferStep; label: string; icon: ReactNode }[] = [
  { key: 'select', label: 'Select Waste', icon: <Package className="h-4 w-4" /> },
  { key: 'destination', label: 'Destination', icon: <MapPin className="h-4 w-4" /> },
  { key: 'documentation', label: 'Documentation', icon: <FileText className="h-4 w-4" /> },
  { key: 'review', label: 'Review', icon: <CheckCircle2 className="h-4 w-4" /> }
]

export const INITIAL_FORM: TransferFormData = {
  wasteId: null,
  waste: null,
  recipientAddress: '',
  transferNotes: '',
  conditionNotes: '',
  handlingInstructions: '',
  beforePhotos: [],
  afterPhotos: [],
  senderConfirmed: false
}

export const STATUS_ORDER: TransferStatus[] = [
  TRANSFER_STATUSES.PENDING,
  TRANSFER_STATUSES.IN_TRANSIT,
  TRANSFER_STATUSES.DELIVERED,
  TRANSFER_STATUSES.CONFIRMED
]

export const STATUS_CONFIG: Record<
  TransferStatus,
  { label: string; icon: ReactNode; color: string; bgColor: string }
> = {
  [TRANSFER_STATUSES.PENDING]: {
    label: 'Pending',
    icon: <Clock className="h-4 w-4" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100'
  },
  [TRANSFER_STATUSES.IN_TRANSIT]: {
    label: 'In Transit',
    icon: <Truck className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  [TRANSFER_STATUSES.DELIVERED]: {
    label: 'Delivered',
    icon: <Package className="h-4 w-4" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100'
  },
  [TRANSFER_STATUSES.CONFIRMED]: {
    label: 'Confirmed',
    icon: <ShieldCheck className="h-4 w-4" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100'
  }
}
