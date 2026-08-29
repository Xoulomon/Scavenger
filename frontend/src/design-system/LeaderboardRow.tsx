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
      return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
    case 2:
      return 'bg-gray-400/20 text-gray-600 dark:text-gray-400'
    case 3:
      return 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function LeaderboardRow({
  rank,
  address,
  points,
  tier,
  children,
}: LeaderboardRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${getRankColor(rank)}`}>
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
        <div className="text-lg font-bold text-primary">
          {points.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">points</div>
      </div>
    </div>
  )
}
