import { CheckCircle2 } from 'lucide-react'

import { cn } from '@/lib/utils'

import { STEP_LABELS } from '../constants'

export function RegistrationStepIndicator({
  current,
  total,
}: {
  current: number
  total: number
}) {
  return (
    <nav aria-label="Registration progress" className="mb-8">
      <div className="flex items-center justify-between">
        {Array.from({ length: total }, (_, i) => {
          const stepNum = i + 1
          const isActive = stepNum === current
          const isComplete = stepNum < current
          return (
            <div key={stepNum} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    isComplete && 'bg-primary text-primary-foreground',
                    isActive && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                    !isComplete && !isActive && 'bg-muted text-muted-foreground'
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={cn(
                    'hidden text-xs font-medium sm:block',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>
              {i < total - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1 rounded-full transition-colors',
                    stepNum < current ? 'bg-primary' : 'bg-muted'
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground sm:hidden">
        Step {current} of {total} — {STEP_LABELS[current - 1]}
      </p>
    </nav>
  )
}
