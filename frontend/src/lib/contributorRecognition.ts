/**
 * Contributor recognition program (Issue #781)
 *
 * Defines contributor tiers, badge criteria, leaderboard logic,
 * and a nomination system with localStorage persistence.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContributorTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'legend'

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  earnedAt?: number
}

export interface Contributor {
  address: string
  name?: string
  points: number
  wasteCount: number
  tier: ContributorTier
  badges: Badge[]
  joinedAt: number
  streak: number
}

export interface Nomination {
  id: string
  nomineeAddress: string
  nominatorAddress: string
  reason: string
  createdAt: number
}

// ── Tier thresholds ───────────────────────────────────────────────────────────

export const TIER_THRESHOLDS: Record<ContributorTier, number> = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 15000,
  legend: 50000
}

export const TIER_COLORS: Record<ContributorTier, string> = {
  bronze: 'text-orange-600',
  silver: 'text-gray-500',
  gold: 'text-yellow-500',
  platinum: 'text-cyan-500',
  legend: 'text-purple-500'
}

export const TIER_BG: Record<ContributorTier, string> = {
  bronze: 'bg-orange-500/10',
  silver: 'bg-gray-400/10',
  gold: 'bg-yellow-500/10',
  platinum: 'bg-cyan-500/10',
  legend: 'bg-purple-500/10'
}

// ── Badge definitions ─────────────────────────────────────────────────────────

export const BADGE_DEFINITIONS: Badge[] = [
  {
    id: 'first_recycle',
    name: 'First Recycler',
    description: 'Submit your first waste item',
    icon: '♻️'
  },
  { id: 'ten_items', name: 'Eco Starter', description: 'Recycle 10 items', icon: '🌱' },
  { id: 'fifty_items', name: 'Eco Warrior', description: 'Recycle 50 items', icon: '⚔️' },
  { id: 'hundred_items', name: 'Century Club', description: 'Recycle 100 items', icon: '💯' },
  { id: 'streak_7', name: '7-Day Streak', description: 'Active for 7 days in a row', icon: '🔥' },
  { id: 'streak_30', name: 'Monthly Champion', description: '30-day activity streak', icon: '🏆' },
  {
    id: 'top_10',
    name: 'Community Leader',
    description: 'Reach top 10 on the leaderboard',
    icon: '🥇'
  },
  {
    id: 'nominated',
    name: 'Community Favorite',
    description: 'Received a community nomination',
    icon: '⭐'
  }
]

// ── Tier calculation ──────────────────────────────────────────────────────────

export function getTier(points: number): ContributorTier {
  if (points >= TIER_THRESHOLDS.legend) return 'legend'
  if (points >= TIER_THRESHOLDS.platinum) return 'platinum'
  if (points >= TIER_THRESHOLDS.gold) return 'gold'
  if (points >= TIER_THRESHOLDS.silver) return 'silver'
  return 'bronze'
}

export function getPointsToNextTier(points: number): {
  next: ContributorTier | null
  needed: number
} {
  const tiers: ContributorTier[] = ['bronze', 'silver', 'gold', 'platinum', 'legend']
  for (const tier of tiers) {
    if (points < TIER_THRESHOLDS[tier]) {
      return { next: tier, needed: TIER_THRESHOLDS[tier] - points }
    }
  }
  return { next: null, needed: 0 }
}

/** Compute earned badges for a contributor based on their stats */
export function computeBadges(wasteCount: number, streak: number, rank?: number): Badge[] {
  const earned: Badge[] = []
  const now = Date.now()
  if (wasteCount >= 1) earned.push({ ...BADGE_DEFINITIONS[0], earnedAt: now })
  if (wasteCount >= 10) earned.push({ ...BADGE_DEFINITIONS[1], earnedAt: now })
  if (wasteCount >= 50) earned.push({ ...BADGE_DEFINITIONS[2], earnedAt: now })
  if (wasteCount >= 100) earned.push({ ...BADGE_DEFINITIONS[3], earnedAt: now })
  if (streak >= 7) earned.push({ ...BADGE_DEFINITIONS[4], earnedAt: now })
  if (streak >= 30) earned.push({ ...BADGE_DEFINITIONS[5], earnedAt: now })
  if (rank !== undefined && rank <= 10) earned.push({ ...BADGE_DEFINITIONS[6], earnedAt: now })
  return earned
}

// ── Nominations ───────────────────────────────────────────────────────────────

const NOMINATIONS_KEY = 'scavngr_nominations'

export function getNominations(): Nomination[] {
  try {
    const raw = localStorage.getItem(NOMINATIONS_KEY)
    return raw ? (JSON.parse(raw) as Nomination[]) : []
  } catch {
    return []
  }
}

export function addNomination(
  nomineeAddress: string,
  nominatorAddress: string,
  reason: string
): Nomination {
  const nomination: Nomination = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nomineeAddress,
    nominatorAddress,
    reason,
    createdAt: Date.now()
  }
  const nominations = getNominations()
  nominations.push(nomination)
  localStorage.setItem(NOMINATIONS_KEY, JSON.stringify(nominations))
  return nomination
}

// ── Transparency report ───────────────────────────────────────────────────────

export interface TransparencyReport {
  generatedAt: number
  totalContributors: number
  tierBreakdown: Record<ContributorTier, number>
  topBadges: { badgeId: string; count: number }[]
  totalNominations: number
}

export function generateTransparencyReport(contributors: Contributor[]): TransparencyReport {
  const tierBreakdown: Record<ContributorTier, number> = {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
    legend: 0
  }
  const badgeCounts: Record<string, number> = {}

  for (const c of contributors) {
    tierBreakdown[c.tier] = (tierBreakdown[c.tier] ?? 0) + 1
    for (const b of c.badges) {
      badgeCounts[b.id] = (badgeCounts[b.id] ?? 0) + 1
    }
  }

  const topBadges = Object.entries(badgeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([badgeId, count]) => ({ badgeId, count }))

  return {
    generatedAt: Date.now(),
    totalContributors: contributors.length,
    tierBreakdown,
    topBadges,
    totalNominations: getNominations().length
  }
}
