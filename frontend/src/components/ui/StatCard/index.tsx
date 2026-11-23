import * as React from 'react'
import { memo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

type ColorVariant = 'default' | 'primary' | 'success' | 'warning' | 'destructive'

const variantStyles: Record<ColorVariant, string> = {
  default: '',
  primary: 'border-primary/30 bg-primary/5',
  success: 'border-green-500/30 bg-green-500/5',
  warning: 'border-yellow-500/30 bg-yellow-500/5',
  destructive: 'border-destructive/30 bg-destructive/5'
}

const iconVariantStyles: Record<ColorVariant, string> = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  destructive: 'text-destructive'
}

export interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  trend?: 'up' | 'down'
  trendLabel?: string
  isLoading?: boolean
  variant?: ColorVariant
  className?: string
}

export const StatCard = memo(function StatCard({
  icon,
  label,
  value,
  trend,
  trendLabel,
  isLoading,
  variant = 'default',
  className
}: StatCardProps) {
  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className={cn('h-4 w-4', iconVariantStyles[variant])}>{icon}</span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-7 w-24 animate-pulse rounded bg-muted" />
            {trendLabel && <div className="h-3 w-16 animate-pulse rounded bg-muted" />}
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold">{value}</p>
            {(trend || trendLabel) && (
              <p
                className={cn(
                  'mt-1 flex items-center gap-1 text-xs',
                  trend === 'up' && 'text-green-600 dark:text-green-400',
                  trend === 'down' && 'text-destructive',
                  !trend && 'text-muted-foreground'
                )}
              >
                {trend === 'up' && <TrendingUp className="h-3 w-3" />}
                {trend === 'down' && <TrendingDown className="h-3 w-3" />}
                {trendLabel}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
})
StatCard.displayName = 'StatCard'
