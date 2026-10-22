import { Factory,Recycle, Truck } from 'lucide-react'

import { Role } from '@/api/types'

import type { FormDraft } from './types'

export const STORAGE_KEY = 'scavngr_registration_draft'
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export const ACCEPTED_DOC_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
}

export const ACCEPTED_SELFIE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
}

export const STEP_LABELS = ['Role', 'Profile', 'KYC', 'Confirm'] as const
export const TOTAL_STEPS = STEP_LABELS.length

export const ROLE_CARDS: {
  role: Role
  icon: typeof Recycle
  title: string
  description: string
}[] = [
  {
    role: Role.Recycler,
    icon: Recycle,
    title: 'Recycler',
    description:
      'Collect and submit recyclable materials to earn rewards. You are the first link in the sustainable supply chain.',
  },
  {
    role: Role.Collector,
    icon: Truck,
    title: 'Collector',
    description:
      'Transport and aggregate waste materials from recyclers. Bridge the gap between collection points and manufacturers.',
  },
  {
    role: Role.Manufacturer,
    icon: Factory,
    title: 'Manufacturer',
    description:
      'Transform recycled materials into new products. Create incentives and drive demand for sustainable materials.',
  },
]

export const emptyDraft: FormDraft = {
  role: null,
  displayName: '',
  email: '',
  phone: '',
  bio: '',
  latitude: '',
  longitude: '',
  agreedToTerms: false,
  identityDoc: null,
  selfiePhoto: null,
}
