import { describe, it, expect } from 'vitest'
import { computeXP, computeLevel } from './levels'
import { UserStats } from './types'

const empty: UserStats = { materialsSubmitted: 0, transfersCount: 0, totalEarned: 0n }

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

  it('combines all XP sources correctly', () => {
    const stats: UserStats = {
      materialsSubmitted: 10,
      transfersCount: 5,
      totalEarned: 1000n,
    }
    // 10 * 10 + 5 * 20 + floor(1000 / 100) = 100 + 100 + 10 = 210
    expect(computeXP(stats)).toBe(210)
  })

  it('handles large token values', () => {
    expect(computeXP({ ...empty, totalEarned: 10_000n })).toBe(100)
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

  it('level 1 has Newcomer title', () => {
    expect(computeLevel(empty).title).toBe('Newcomer')
  })

  it('progressPct reflects progress toward next level', () => {
    const level2Start = { ...empty, materialsSubmitted: 5 } // 50 XP at level 2
    const level2Half = { ...empty, materialsSubmitted: 10 } // 100 XP (halfway to level 3 at 150)
    const level2Near = { ...empty, materialsSubmitted: 14 } // 140 XP (near level 3)

    const p1 = computeLevel(level2Start).progressPct
    const p2 = computeLevel(level2Half).progressPct
    const p3 = computeLevel(level2Near).progressPct

    expect(p1).toBeLessThan(p2)
    expect(p2).toBeLessThan(p3)
  })

  it('xpForNext is consistent with level', () => {
    const result = computeLevel({ ...empty, materialsSubmitted: 5 })
    expect(result.xpForNext).toBeGreaterThan(result.xp)
  })

  it('returns correct structure', () => {
    const result = computeLevel(empty)
    expect(result.level).toBeDefined()
    expect(result.title).toBeDefined()
    expect(result.xp).toBeDefined()
    expect(result.xpForNext).toBeDefined()
    expect(result.progressPct).toBeDefined()
  })
})
