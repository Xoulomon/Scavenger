import type { Role } from '@/api/types'

export interface FileInfo {
  name: string
  size: number
  type: string
}

export interface FormDraft {
  role: Role | null
  displayName: string
  email: string
  phone: string
  bio: string
  latitude: string
  longitude: string
  agreedToTerms: boolean
  identityDoc: FileInfo | null
  selfiePhoto: FileInfo | null
}

export type ValidationErrors = Record<string, string>
