// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserStats {
  materialsSubmitted: number
  transfersCount: number
  totalEarned: bigint
  /** ISO date string of first activity, used for streak/challenge seeding */
  joinedAt?: number
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
}

export interface Level {
  level: number
  title: string
  xp: number
  xpForNext: number
  progressPct: number
}

export interface Challenge {
  id: string
  title: string
  description: string
  target: number
  current: number
  progressPct: number
  completed: boolean
  type: 'daily' | 'weekly'
  expiresAt: number
}

// ── Badge definitions ─────────────────────────────────────────────────────────

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

// ── Level calculation ─────────────────────────────────────────────────────────
// XP = materialsSubmitted * 10 + transfersCount * 20 + floor(totalEarned / 100)

const LEVEL_THRESHOLDS = [0, 50, 150, 350, 700, 1200, 2000, 3200, 5000, 8000, 12000]

export function computeXP(stats: UserStats): number {
  return (
    stats.materialsSubmitted * 10 +
    stats.transfersCount * 20 +
    Math.floor(Number(stats.totalEarned) / 100)
  )
}

export function computeLevel(stats: UserStats): Level {
  const xp = computeXP(stats)
  let level = 1
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
      break
    }
  }
  const xpForCurrent = LEVEL_THRESHOLDS[level - 1] ?? 0
  const xpForNext = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  const range = xpForNext - xpForCurrent
  const progressPct =
    range > 0 ? Math.min(100, Math.round(((xp - xpForCurrent) / range) * 100)) : 100

  const TITLES = [
    'Newcomer',
    'Collector',
    'Recycler',
    'Eco Warrior',
    'Green Champion',
    'Sustainability Hero',
    'Planet Guardian',
    'Eco Legend',
    'Master Recycler',
    'Grand Eco Master',
    'Immortal'
  ]
  return { level, title: TITLES[level - 1] ?? 'Immortal', xp, xpForNext, progressPct }
}

// ── Challenges ────────────────────────────────────────────────────────────────
// Seeded by the current week/day so they reset automatically

function startOfDay(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfWeek(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.getTime()
}

export function generateChallenges(stats: UserStats, now = Date.now()): Challenge[] {
  const dayStart = startOfDay(now)
  const weekStart = startOfWeek(now)

  const daily: Omit<Challenge, 'current' | 'progressPct' | 'completed'>[] = [
    {
      id: 'daily_submit_3',
      title: 'Daily Submitter',
      description: 'Submit 3 waste items today',
      target: 3,
      type: 'daily',
      expiresAt: dayStart + 86_400_000
    },
    {
      id: 'daily_transfer_1',
      title: 'Daily Mover',
      description: 'Complete 1 transfer today',
      target: 1,
      type: 'daily',
      expiresAt: dayStart + 86_400_000
    }
  ]

  const weekly: Omit<Challenge, 'current' | 'progressPct' | 'completed'>[] = [
    {
      id: 'weekly_submit_15',
      title: 'Weekly Recycler',
      description: 'Submit 15 waste items this week',
      target: 15,
      type: 'weekly',
      expiresAt: weekStart + 7 * 86_400_000
    },
    {
      id: 'weekly_transfer_5',
      title: 'Weekly Mover',
      description: 'Complete 5 transfers this week',
      target: 5,
      type: 'weekly',
      expiresAt: weekStart + 7 * 86_400_000
    },
    {
      id: 'weekly_earn_500',
      title: 'Token Grinder',
      description: 'Earn 500 tokens this week',
      target: 500,
      type: 'weekly',
      expiresAt: weekStart + 7 * 86_400_000
    }
  ]

  // For simplicity, current progress uses cumulative stats (no per-period tracking)
  const resolve = (c: Omit<Challenge, 'current' | 'progressPct' | 'completed'>): Challenge => {
    let current = 0
    if (c.id.includes('submit')) current = Math.min(c.target, stats.materialsSubmitted)
    else if (c.id.includes('transfer')) current = Math.min(c.target, stats.transfersCount)
    else if (c.id.includes('earn')) current = Math.min(c.target, Number(stats.totalEarned))
    const progressPct = Math.round((current / c.target) * 100)
    return { ...c, current, progressPct, completed: current >= c.target }
  }

  return [...daily, ...weekly].map(resolve)
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number
  address: string
  displayName: string
  xp: number
  level: number
}

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
