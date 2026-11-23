import { memo } from 'react'
import { Pencil, PowerOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Incentive } from '@/api/types'
import { formatAddress, wasteTypeLabel, formatTokenAmount } from '@/lib/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'

export interface IncentiveCardProps {
  incentive: Incentive
  isManufacturer?: boolean
  onEdit?: (incentive: Incentive) => void
  onDeactivate?: (incentive: Incentive) => void
  className?: string
}

export const IncentiveCard = memo(function IncentiveCard({
  incentive,
  isManufacturer,
  onEdit,
  onDeactivate,
  className
}: IncentiveCardProps) {
  const budgetPercent =
    incentive.total_budget > 0
      ? Math.round((incentive.remaining_budget / incentive.total_budget) * 100)
      : 0

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <CardTitle className="text-base font-semibold">
          {wasteTypeLabel(incentive.waste_type)}
        </CardTitle>
        <Badge variant={incentive.active ? 'default' : 'secondary'}>
          {incentive.active ? 'Active' : 'Inactive'}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Reward per gram</span>
          <span className="font-medium">{formatTokenAmount(incentive.reward_points)} pts</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Budget remaining</span>
          <span className="font-medium">
            {formatTokenAmount(incentive.remaining_budget)}{' '}
            <span className="text-xs text-muted-foreground">
              / {formatTokenAmount(incentive.total_budget)}
            </span>
          </span>
        </div>

        {/* Budget progress bar */}
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                budgetPercent > 50
                  ? 'bg-primary'
                  : budgetPercent > 20
                    ? 'bg-yellow-500'
                    : 'bg-destructive'
              )}
              style={{ width: `${budgetPercent}%` }}
              role="progressbar"
              aria-valuenow={budgetPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Budget remaining"
            />
          </div>
          <p className="text-right text-xs text-muted-foreground">{budgetPercent}% remaining</p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Rewarder</span>
          <span className="font-mono text-xs">{formatAddress(incentive.rewarder)}</span>
        </div>
      </CardContent>

      {isManufacturer && (
        <CardFooter className="gap-2 pt-3">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onEdit?.(incentive)}
            disabled={!incentive.active}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={() => onDeactivate?.(incentive)}
            disabled={!incentive.active}
          >
            <PowerOff className="mr-1.5 h-3.5 w-3.5" />
            Deactivate
          </Button>
        </CardFooter>
      )}
    </Card>
  )
})
IncentiveCard.displayName = 'IncentiveCard'
