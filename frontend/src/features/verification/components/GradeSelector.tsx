import { cn } from '@/lib/utils'

import { GRADE_COLORS,GRADES } from '../constants'
import type { QualityGrade } from '../types'

export function GradeSelector({
  value,
  onChange,
}: {
  value: QualityGrade
  onChange: (g: QualityGrade) => void
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Quality grade">
      {GRADES.map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          aria-pressed={value === g}
          aria-label={`Grade ${g}`}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            GRADE_COLORS[g],
            value === g
              ? 'opacity-100 ring-2 ring-offset-1 ring-ring'
              : 'opacity-40 hover:opacity-70'
          )}
        >
          {g}
        </button>
      ))}
    </div>
  )
}
