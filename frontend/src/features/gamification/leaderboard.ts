import { UserStats, LeaderboardEntry } from './types'
import { computeXP, computeLevel } from './levels'

export function buildLeaderboard(
  entries: { address: string; stats: UserStats }[],
  currentAddress?: string
): LeaderboardEntry[] {
  return entries
    .map(({ address, stats }) => ({
      address,
      displayName:
        address === currentAddress ? 'You' : `${address.slice(0, 4)}…${address.slice(-4)}`,
      xp: computeXP(stats),
      level: computeLevel(stats).level
    }))
    .sort((a, b) => b.xp - a.xp)
    .map((e, i) => ({ ...e, rank: i + 1 }))
}
