import { describe, it, expect } from 'vitest'
import {
  evaluateBadges,
  newlyEarnedBadges,
  computeXP,
  computeLevel,
  generateChallenges,
  buildLeaderboard,
  UserStats
} from '@/lib/gamification'

const empty: UserStats = { materialsSubmitted: 0, transfersCount: 0, totalEarned: 0n }

// ── evaluateBadges ────────────────────────────────────────────────────────────

describe('evaluateBadges', () => {
  it('no badges earned for empty stats', () => {
    const badges = evaluateBadges(empty)
    expect(badges.every((b) => !b.earned)).toBe(true)
  })

  it('earns first_submit badge at 1 material', () => {
    const badges = evaluateBadges({ ...empty, materialsSubmitted: 1 })
    expect(badges.find((b) => b.id === 'first_submit')?.earned).toBe(true)
  })

  it('does not earn ten_submits at 9 materials', () => {
    const badges = evaluateBadges({ ...empty, materialsSubmitted: 9 })
    expect(badges.find((b) => b.id === 'ten_submits')?.earned).toBe(false)
  })

  it('earns ten_submits at exactly 10 materials', () => {
    const badges = evaluateBadges({ ...empty, materialsSubmitted: 10 })
    expect(badges.find((b) => b.id === 'ten_submits')?.earned).toBe(true)
  })

  it('earns earner badge when totalEarned > 0', () => {
    const badges = evaluateBadges({ ...empty, totalEarned: 1n })
    expect(badges.find((b) => b.id === 'earner')?.earned).toBe(true)
  })

  it('earns overachiever only when both conditions met', () => {
    const partial = evaluateBadges({ ...empty, materialsSubmitted: 50, transfersCount: 9 })
    expect(partial.find((b) => b.id === 'overachiever')?.earned).toBe(false)
    const full = evaluateBadges({ ...empty, materialsSubmitted: 50, transfersCount: 10 })
    expect(full.find((b) => b.id === 'overachiever')?.earned).toBe(true)
  })
})

// ── newlyEarnedBadges ─────────────────────────────────────────────────────────

describe('newlyEarnedBadges', () => {
  it('returns empty when nothing changed', () => {
    expect(newlyEarnedBadges(empty, empty)).toHaveLength(0)
  })

  it('detects first_submit as newly earned', () => {
    const earned = newlyEarnedBadges(empty, { ...empty, materialsSubmitted: 1 })
    expect(earned.map((b) => b.id)).toContain('first_submit')
  })

  it('does not re-report already earned badges', () => {
    const prev = { ...empty, materialsSubmitted: 1 }
    const next = { ...empty, materialsSubmitted: 2 }
    const earned = newlyEarnedBadges(prev, next)
    expect(earned.map((b) => b.id)).not.toContain('first_submit')
  })
})

// ── computeXP / computeLevel ──────────────────────────────────────────────────

describe('computeXP', () => {
  it('returns 0 for empty stats', () => {
    expect(computeXP(empty)).toBe(0)
  })

  it('counts 10 XP per material submitted', () => {
    expect(computeXP({ ...empty, materialsSubmitted: 5 })).toBe(50)
  })

  it('counts 20 XP per transfer', () => {
    expect(computeXP({ ...empty, transfersCount: 3 })).toBe(60)
  })

  it('adds floor(totalEarned / 100) XP', () => {
    expect(computeXP({ ...empty, totalEarned: 250n })).toBe(2)
  })
})

describe('computeLevel', () => {
  it('level 1 for 0 XP', () => {
    expect(computeLevel(empty).level).toBe(1)
  })

  it('level 2 at 50 XP', () => {
    expect(computeLevel({ ...empty, materialsSubmitted: 5 }).level).toBe(2)
  })

  it('progressPct is between 0 and 100', () => {
    const { progressPct } = computeLevel({ ...empty, materialsSubmitted: 7 })
    expect(progressPct).toBeGreaterThanOrEqual(0)
    expect(progressPct).toBeLessThanOrEqual(100)
  })

  it('title is defined for every level', () => {
    const { title } = computeLevel({ ...empty, materialsSubmitted: 1 })
    expect(title).toBeTruthy()
  })
})

// ── generateChallenges ────────────────────────────────────────────────────────

describe('generateChallenges', () => {
  it('returns 2 daily and 3 weekly challenges', () => {
    const challenges = generateChallenges(empty)
    expect(challenges.filter((c) => c.type === 'daily')).toHaveLength(2)
    expect(challenges.filter((c) => c.type === 'weekly')).toHaveLength(3)
  })

  it('marks challenge completed when target met', () => {
    const challenges = generateChallenges({ ...empty, materialsSubmitted: 100 })
    const submit3 = challenges.find((c) => c.id === 'daily_submit_3')!
    expect(submit3.completed).toBe(true)
    expect(submit3.progressPct).toBe(100)
  })

  it('progressPct is 0 for empty stats', () => {
    const challenges = generateChallenges(empty)
    challenges.forEach((c) => expect(c.progressPct).toBe(0))
  })
})

// ── buildLeaderboard ──────────────────────────────────────────────────────────

describe('buildLeaderboard', () => {
  it('sorts by XP descending', () => {
    const entries = [
      { address: 'A', stats: { ...empty, materialsSubmitted: 5 } },
      { address: 'B', stats: { ...empty, materialsSubmitted: 10 } }
    ]
    const lb = buildLeaderboard(entries)
    expect(lb[0].address).toBe('B')
    expect(lb[1].address).toBe('A')
  })

  it('labels current user as "You"', () => {
    const entries = [{ address: 'GSELF', stats: empty }]
    const lb = buildLeaderboard(entries, 'GSELF')
    expect(lb[0].displayName).toBe('You')
  })

  it('assigns rank starting at 1', () => {
    const entries = [{ address: 'X', stats: empty }]
    expect(buildLeaderboard(entries)[0].rank).toBe(1)
  })
})
