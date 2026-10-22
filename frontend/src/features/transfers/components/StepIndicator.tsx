import { ArrowRight, CheckCircle2 } from 'lucide-react'

import { STEPS } from '../constants'
import type { TransferStep } from '../types'

export function StepIndicator({
  currentStep,
  onStepClick,
}: {
  currentStep: TransferStep
  onStepClick: (step: TransferStep) => void
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <nav aria-label="Transfer progress" className="mb-6">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isClickable = idx < currentIdx

          return (
            <li key={step.key} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.key)}
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${idx + 1}: ${step.label}${isCompleted ? ' (completed)' : ''}`}
                className={`flex w-full flex-col items-center gap-1 rounded-lg p-2 text-xs transition-colors sm:flex-row sm:gap-2 sm:p-3 sm:text-sm ${
                  isCurrent
                    ? 'bg-primary/10 font-medium text-primary'
                    : isCompleted
                      ? 'cursor-pointer text-emerald-600 hover:bg-emerald-50'
                      : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <ArrowRight
                  className={`mx-1 hidden h-4 w-4 shrink-0 sm:block ${
                    idx < currentIdx ? 'text-emerald-500' : 'text-muted-foreground/30'
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
