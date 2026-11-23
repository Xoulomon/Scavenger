export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type StatusFilter = 'all' | 'pending' | 'verified'
export type SortField = 'id' | 'date' | 'weight' | 'type'
export type SortDirection = 'asc' | 'desc'

export type VerificationDecision = 'approved' | 'rejected'

export type TimelineEventType = 'submitted' | 'transfer' | 'verified' | 'confirmed' | 'deactivated'

export interface VerificationFormData {
  grade: QualityGrade
  contaminated: boolean
  notes: string
}

export interface VerificationRecord {
  materialId: number
  decision: VerificationDecision
  notes: string
  contaminated: boolean
  grade: QualityGrade
  verifiedAt: number
  verifier: string
}

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  timestamp: number
  label: string
  detail?: string
  actor?: string
}
