import { ArrowRight, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WasteTransfer } from '@/api/types'
import { formatAddress, formatDate } from '@/lib/helpers'
import { EmptyState } from './EmptyState'

export interface TransferTimelineProps {
  history: WasteTransfer[]
  currentOwner?: string
  isLoading?: boolean
  className?: string
}

export function TransferTimeline({
  history,
  currentOwner,
  isLoading,
  className
}: TransferTimelineProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)} role="status" aria-live="polite">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="flex flex-col items-center">
              <div className="h-4 w-4 rounded-full bg-muted" />
              {i < 3 && <div className="mt-1 h-12 w-px bg-muted" />}
            </div>
            <div className="mb-4 flex-1 space-y-2 pb-2">
              <div className="h-4 w-1/2 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No transfer history"
        description="This waste hasn't been transferred yet"
        className={className}
      />
    )
  }

  return (
    <ol className={cn('relative space-y-0', className)} aria-label="Transfer history">
      {history.map((transfer, idx) => {
        const isLast = idx === history.length - 1
        const isCurrent = currentOwner ? transfer.to === currentOwner : isLast

        return (
          <li key={`${transfer.waste_id}-${idx}`} className="flex gap-4">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                  isCurrent
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground'
                )}
                aria-hidden="true"
              >
                {isCurrent ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              {!isLast && <div className="mt-1 h-full min-h-[2.5rem] w-px bg-border" />}
            </div>

            {/* Content */}
            <div className={cn('mb-4 flex-1 pb-1', isLast && 'mb-0')}>
              <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                <span className="font-mono text-xs text-muted-foreground">
                  {formatAddress(transfer.from)}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span
                  className={cn(
                    'font-mono text-xs',
                    isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground'
                  )}
                >
                  {formatAddress(transfer.to)}
                </span>
                {isCurrent && (
                  <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    Current owner
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(transfer.transferred_at)}
                </span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
