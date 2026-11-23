import { UserStats, Badge } from './types'

interface BadgeDef {
  id: string
  name: string
  description: string
  icon: string
  check: (s: UserStats) => boolean
}

const BADGE_DEFS: BadgeDef[] = [
  {
    id: 'first_submit',
    name: 'First Step',
    description: 'Submit your first waste item',
    icon: '🌱',
    check: (s) => s.materialsSubmitted >= 1
  },
  {
    id: 'ten_submits',
    name: 'Getting Started',
    description: 'Submit 10 waste items',
    icon: '♻️',
    check: (s) => s.materialsSubmitted >= 10
  },
  {
    id: 'fifty_submits',
    name: 'Recycling Pro',
    description: 'Submit 50 waste items',
    icon: '🏅',
    check: (s) => s.materialsSubmitted >= 50
  },
  {
    id: 'hundred_submits',
    name: 'Century Club',
    description: 'Submit 100 waste items',
    icon: '💯',
    check: (s) => s.materialsSubmitted >= 100
  },
  {
    id: 'first_transfer',
    name: 'On the Move',
    description: 'Complete your first transfer',
    icon: '🚚',
    check: (s) => s.transfersCount >= 1
  },
  {
    id: 'ten_transfers',
    name: 'Supply Chain Hero',
    description: 'Complete 10 transfers',
    icon: '⛓️',
    check: (s) => s.transfersCount >= 10
  },
  {
    id: 'earner',
    name: 'Token Earner',
    description: 'Earn your first tokens',
    icon: '🪙',
    check: (s) => s.totalEarned > 0n
  },
  {
    id: 'big_earner',
    name: 'Token Hoarder',
    description: 'Earn 10,000 tokens',
    icon: '💰',
    check: (s) => s.totalEarned >= 10_000n
  },
  {
    id: 'overachiever',
    name: 'Overachiever',
    description: 'Submit 50 items AND complete 10 transfers',
    icon: '🏆',
    check: (s) => s.materialsSubmitted >= 50 && s.transfersCount >= 10
  }
]

export function evaluateBadges(stats: UserStats): Badge[] {
  return BADGE_DEFS.map(({ id, name, description, icon, check }) => ({
    id,
    name,
    description,
    icon,
    earned: check(stats)
  }))
}

export function newlyEarnedBadges(prev: UserStats, next: UserStats): Badge[] {
  const before = evaluateBadges(prev)
  const after = evaluateBadges(next)
  return after.filter((b, i) => b.earned && !before[i].earned)
}
