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

export type FormFieldKey = keyof FormDraft

export type FormFieldErrors = Partial<Record<FormFieldKey, string>>

export interface ParticipantFormState {
  draft: FormDraft
  errors: ValidationErrors
  isSubmitting: boolean
  isDirty: boolean
}

export interface ParticipantFormActions {
  updateField: <K extends FormFieldKey>(field: K, value: FormDraft[K]) => void
  resetForm: () => void
  submitForm: () => Promise<void>
}

export type ParticipantFormContextValue = ParticipantFormState & ParticipantFormActions
