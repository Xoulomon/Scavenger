import { memo } from 'react'
import { Badge } from '@/components/ui/Badge'

export type Tier = 'free' | 'basic' | 'pro' | 'enterprise'

interface TierBadgeProps {
  tier: Tier | string
  className?: string
}

const tierTokenClasses: Record<Tier, string> = {
  free: 'text-[var(--color-tier-free)]',
  basic: 'text-[var(--color-tier-basic)]',
  pro: 'text-[var(--color-tier-pro)]',
  enterprise: 'text-[var(--color-tier-enterprise)]'
}

function isTier(value: string): value is Tier {
  return value in tierTokenClasses
}

export const TierBadge = memo(function TierBadge({ tier, className }: TierBadgeProps) {
  const tokenClass = isTier(tier) ? tierTokenClasses[tier] : undefined
  const combinedClassName = [tokenClass, className].filter(Boolean).join(' ') || undefined

  return (
    <Badge variant="secondary" className={combinedClassName}>
      {tier}
    </Badge>
  )
})
