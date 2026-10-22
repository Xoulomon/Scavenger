import type { WasteType } from '@/api/types'
import { WasteType as WasteTypeEnum } from '@/api/types'

import type { QualityGrade } from './types'

export const GRADES: QualityGrade[] = ['A', 'B', 'C', 'D', 'F']

export const GRADE_COLORS: Record<QualityGrade, string> = {
  A: 'bg-emerald-500 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-yellow-500 text-white',
  D: 'bg-orange-500 text-white',
  F: 'bg-destructive text-destructive-foreground',
}

export const WASTE_TYPE_OPTIONS: { value: string; label: string; type: WasteType }[] = [
  { value: '0', label: 'Paper', type: WasteTypeEnum.Paper },
  { value: '1', label: 'PET Plastic', type: WasteTypeEnum.PetPlastic },
  { value: '2', label: 'Plastic', type: WasteTypeEnum.Plastic },
  { value: '3', label: 'Metal', type: WasteTypeEnum.Metal },
  { value: '4', label: 'Glass', type: WasteTypeEnum.Glass },
]
