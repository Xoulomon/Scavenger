import type { WasteType } from '@/api/types'
import { WasteType as WasteTypeEnum } from '@/api/types'
import { WASTE_TYPES } from '@/lib/constants'

import type { QualityGrade } from './types'

export const GRADES: QualityGrade[] = ['A', 'B', 'C', 'D', 'F']

export const GRADE_COLORS: Record<QualityGrade, string> = {
  A: 'bg-emerald-500 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-yellow-500 text-white',
  D: 'bg-orange-500 text-white',
  F: 'bg-destructive text-destructive-foreground'
}

export const WASTE_TYPE_OPTIONS: { value: string; label: string; type: WasteType }[] = [
  {
    value: String(WASTE_TYPES.PAPER.value),
    label: WASTE_TYPES.PAPER.label,
    type: WasteTypeEnum.Paper
  },
  {
    value: String(WASTE_TYPES.PET_PLASTIC.value),
    label: WASTE_TYPES.PET_PLASTIC.label,
    type: WasteTypeEnum.PetPlastic
  },
  {
    value: String(WASTE_TYPES.PLASTIC.value),
    label: WASTE_TYPES.PLASTIC.label,
    type: WasteTypeEnum.Plastic
  },
  {
    value: String(WASTE_TYPES.METAL.value),
    label: WASTE_TYPES.METAL.label,
    type: WasteTypeEnum.Metal
  },
  {
    value: String(WASTE_TYPES.GLASS.value),
    label: WASTE_TYPES.GLASS.label,
    type: WasteTypeEnum.Glass
  }
]
