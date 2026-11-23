import { memo } from 'react'
import { TierBadge } from './TierBadge'

interface LeaderboardRowProps {
  rank: number
  address: string
  points: number
  tier: string
  children?: React.ReactNode
}

function getRankColor(rank: number): string {
  switch (rank) {
    case 1:
      return 'bg-warning/20 text-warning'
    case 2:
      return 'bg-muted text-muted-foreground'
    case 3:
      return 'bg-accent text-accent-foreground'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function LeaderboardRowComponent({ rank, address, points, tier, children }: LeaderboardRowProps) {
  const formattedPoints = points.toLocaleString()
  const accessibleLabel = `Rank ${rank}, address ${address}, ${formattedPoints} points, tier ${tier}`

  return (
    <div
      role="listitem"
      aria-label={accessibleLabel}
      className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent"
    >
      <div
        aria-label={`Rank ${rank}`}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${getRankColor(rank)}`}
      >
        #{rank}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">{address}</span>
          <TierBadge tier={tier} className="text-xs" />
        </div>
        {children}
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-primary">{formattedPoints}</div>
        <div className="text-xs text-muted-foreground">points</div>
      </div>
    </div>
  )
}

export const LeaderboardRow = memo(LeaderboardRowComponent)
LeaderboardRow.displayName = 'LeaderboardRow'
