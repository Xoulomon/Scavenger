import { describe, it, expect } from 'vitest'
import { evaluateBadges, newlyEarnedBadges } from './badges'
import { UserStats } from './types'

const empty: UserStats = { materialsSubmitted: 0, transfersCount: 0, totalEarned: 0n }

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

  it('earns fifty_submits at 50 materials', () => {
    const badges = evaluateBadges({ ...empty, materialsSubmitted: 50 })
    expect(badges.find((b) => b.id === 'fifty_submits')?.earned).toBe(true)
  })

  it('earns hundred_submits at 100 materials', () => {
    const badges = evaluateBadges({ ...empty, materialsSubmitted: 100 })
    expect(badges.find((b) => b.id === 'hundred_submits')?.earned).toBe(true)
  })

  it('earns first_transfer badge at 1 transfer', () => {
    const badges = evaluateBadges({ ...empty, transfersCount: 1 })
    expect(badges.find((b) => b.id === 'first_transfer')?.earned).toBe(true)
  })

  it('earns ten_transfers at 10 transfers', () => {
    const badges = evaluateBadges({ ...empty, transfersCount: 10 })
    expect(badges.find((b) => b.id === 'ten_transfers')?.earned).toBe(true)
  })

  it('earns earner badge when totalEarned > 0', () => {
    const badges = evaluateBadges({ ...empty, totalEarned: 1n })
    expect(badges.find((b) => b.id === 'earner')?.earned).toBe(true)
  })

  it('earns big_earner at 10,000 tokens', () => {
    const badges = evaluateBadges({ ...empty, totalEarned: 10_000n })
    expect(badges.find((b) => b.id === 'big_earner')?.earned).toBe(true)
  })

  it('earns overachiever only when both conditions met', () => {
    const partial = evaluateBadges({ ...empty, materialsSubmitted: 50, transfersCount: 9 })
    expect(partial.find((b) => b.id === 'overachiever')?.earned).toBe(false)
    const full = evaluateBadges({ ...empty, materialsSubmitted: 50, transfersCount: 10 })
    expect(full.find((b) => b.id === 'overachiever')?.earned).toBe(true)
  })

  it('returns all badge definitions with structure', () => {
    const badges = evaluateBadges(empty)
    expect(badges.length).toBe(9)
    badges.forEach((b) => {
      expect(b.id).toBeTruthy()
      expect(b.name).toBeTruthy()
      expect(b.description).toBeTruthy()
      expect(b.icon).toBeTruthy()
      expect(typeof b.earned).toBe('boolean')
    })
  })
})

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

  it('reports multiple newly earned badges', () => {
    const prev = empty
    const next = { ...empty, materialsSubmitted: 50, transfersCount: 10 }
    const earned = newlyEarnedBadges(prev, next)
    const ids = earned.map((b) => b.id)
    expect(ids).toContain('first_submit')
    expect(ids).toContain('fifty_submits')
    expect(ids).toContain('first_transfer')
    expect(ids).toContain('overachiever')
  })

  it('preserves badge metadata on newly earned badges', () => {
    const earned = newlyEarnedBadges(empty, { ...empty, materialsSubmitted: 1 })
    const badge = earned.find((b) => b.id === 'first_submit')
    expect(badge?.name).toBe('First Step')
    expect(badge?.earned).toBe(true)
  })
})
