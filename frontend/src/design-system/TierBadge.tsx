import { Badge } from '@/components/ui/Badge'

interface TierBadgeProps {
  tier: string
  className?: string
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  return (
    <Badge variant="secondary" className={className}>
      {tier}
    </Badge>
  )
}
