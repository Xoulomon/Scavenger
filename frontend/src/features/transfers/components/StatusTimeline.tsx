import { STATUS_CONFIG, STATUS_ORDER } from '../constants'
import type { TransferStatus } from '../types'

export function StatusTimeline({ status }: { status: TransferStatus }) {
  const currentIdx = STATUS_ORDER.indexOf(status)

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Transfer status timeline">
      {STATUS_ORDER.map((s, idx) => {
        const config = STATUS_CONFIG[s]
        const isCompleted = idx <= currentIdx
        const isCurrent = idx === currentIdx

        return (
          <div key={s} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  isCompleted ? `${config.bgColor} ${config.color}` : 'bg-muted text-muted-foreground'
                } ${isCurrent ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                aria-label={`${config.label}${isCurrent ? ' (current)' : isCompleted ? ' (completed)' : ''}`}
              >
                {config.icon}
              </div>
              <span
                className={`text-[10px] sm:text-xs ${
                  isCompleted ? 'font-medium' : 'text-muted-foreground'
                }`}
              >
                {config.label}
              </span>
            </div>
            {idx < STATUS_ORDER.length - 1 && (
              <div
                className={`mx-1 h-0.5 flex-1 rounded ${
                  idx < currentIdx ? 'bg-emerald-400' : 'bg-muted'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
