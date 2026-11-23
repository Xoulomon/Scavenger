import { type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AlertSeverity = 'good' | 'warning' | 'critical'

export interface PerformanceAlertProps {
  metric: string
  value: string
  severity: AlertSeverity
  message: string
  className?: string
}

const SEVERITY_STYLES: Record<AlertSeverity, { card: string; icon: ReactNode; label: string }> = {
  good: {
    card: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
    icon: <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />,
    label: 'Good'
  },
  warning: {
    card: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
    icon: <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />,
    label: 'Needs Improvement'
  },
  critical: {
    card: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
    icon: <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
    label: 'Poor'
  }
}

export function PerformanceAlert({
  metric,
  value,
  severity,
  message,
  className
}: PerformanceAlertProps) {
  const styles = SEVERITY_STYLES[severity]

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-3', styles.card, className)}>
      <span className="mt-0.5 shrink-0">{styles.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{metric}</span>
          <span className="font-mono text-xs text-muted-foreground">{value}</span>
          <span className="ml-auto text-xs font-medium">{styles.label}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export interface PerformanceSummaryProps {
  passed: number
  total: number
  className?: string
}

export function PerformanceSummary({ passed, total, className }: PerformanceSummaryProps) {
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0
  const allGood = passed === total

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      {allGood ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <TrendingUp className="h-4 w-4 text-yellow-500" />
      )}
      <span
        className={cn(
          'font-medium',
          allGood ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
        )}
      >
        {passed}/{total} metrics passing ({pct}%)
      </span>
    </div>
  )
}
