import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTier,
  getPointsToNextTier,
  computeBadges,
  addNomination,
  getNominations,
  generateTransparencyReport,
  TIER_THRESHOLDS,
} from './contributorRecognition'

beforeEach(() => {
  localStorage.removeItem('scavngr_nominations')
})

describe('getTier', () => {
  it('returns bronze for 0 points', () => expect(getTier(0)).toBe('bronze'))
  it('returns silver at threshold', () => expect(getTier(TIER_THRESHOLDS.silver)).toBe('silver'))
  it('returns gold at threshold', () => expect(getTier(TIER_THRESHOLDS.gold)).toBe('gold'))
  it('returns platinum at threshold', () => expect(getTier(TIER_THRESHOLDS.platinum)).toBe('platinum'))
  it('returns legend at threshold', () => expect(getTier(TIER_THRESHOLDS.legend)).toBe('legend'))
  it('returns bronze below silver', () => expect(getTier(999)).toBe('bronze'))
})

describe('getPointsToNextTier', () => {
  it('returns silver as next tier for bronze', () => {
    const { next, needed } = getPointsToNextTier(0)
    expect(next).toBe('silver')
    expect(needed).toBe(TIER_THRESHOLDS.silver)
  })

  it('returns null at legend tier', () => {
    const { next, needed } = getPointsToNextTier(TIER_THRESHOLDS.legend)
    expect(next).toBeNull()
    expect(needed).toBe(0)
  })

  it('calculates correct needed points mid-tier', () => {
    const { needed } = getPointsToNextTier(500)
    expect(needed).toBe(TIER_THRESHOLDS.silver - 500)
  })
})

describe('computeBadges', () => {
  it('returns no badges for 0 waste', () => {
    expect(computeBadges(0, 0)).toHaveLength(0)
  })

  it('earns first_recycle badge at 1 item', () => {
    const badges = computeBadges(1, 0)
    expect(badges.some((b) => b.id === 'first_recycle')).toBe(true)
  })

  it('earns eco_warrior badge at 50 items', () => {
    const badges = computeBadges(50, 0)
    expect(badges.some((b) => b.id === 'fifty_items')).toBe(true)
  })

  it('earns streak badge at 7 days', () => {
    const badges = computeBadges(5, 7)
    expect(badges.some((b) => b.id === 'streak_7')).toBe(true)
  })

  it('earns top_10 badge when rank <= 10', () => {
    const badges = computeBadges(10, 0, 5)
    expect(badges.some((b) => b.id === 'top_10')).toBe(true)
  })

  it('does not earn top_10 badge when rank > 10', () => {
    const badges = computeBadges(10, 0, 11)
    expect(badges.some((b) => b.id === 'top_10')).toBe(false)
  })
})

describe('nominations', () => {
  it('adds a nomination and retrieves it', () => {
    addNomination('GABC', 'GXYZ', 'Great contributor')
    const nominations = getNominations()
    expect(nominations).toHaveLength(1)
    expect(nominations[0].nomineeAddress).toBe('GABC')
    expect(nominations[0].reason).toBe('Great contributor')
  })

  it('accumulates multiple nominations', () => {
    addNomination('GABC', 'G001', 'reason 1')
    addNomination('GDEF', 'G002', 'reason 2')
    expect(getNominations()).toHaveLength(2)
  })
})

describe('generateTransparencyReport', () => {
  it('counts contributors correctly', () => {
    const contributors = [
      { address: 'G1', points: 100, wasteCount: 5, tier: getTier(100), badges: computeBadges(5, 0), joinedAt: Date.now(), streak: 0, name: undefined },
      { address: 'G2', points: 2000, wasteCount: 30, tier: getTier(2000), badges: computeBadges(30, 0), joinedAt: Date.now(), streak: 0, name: undefined },
    ]
    const report = generateTransparencyReport(contributors)
    expect(report.totalContributors).toBe(2)
    expect(report.tierBreakdown.bronze).toBe(1)
    expect(report.tierBreakdown.silver).toBe(1)
  })

  it('includes nomination count', () => {
    addNomination('G1', 'G2', 'good work')
    const report = generateTransparencyReport([])
    expect(report.totalNominations).toBe(1)
  })
})
