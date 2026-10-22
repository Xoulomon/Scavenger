import { describe, it, expect } from 'vitest'
import { generateChallenges } from './challenges'
import { UserStats } from './types'

const empty: UserStats = { materialsSubmitted: 0, transfersCount: 0, totalEarned: 0n }

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

  it('daily_submit_3 requires 3 materials', () => {
    const challenges = generateChallenges({ ...empty, materialsSubmitted: 3 })
    const challenge = challenges.find((c) => c.id === 'daily_submit_3')!
    expect(challenge.completed).toBe(true)
    expect(challenge.current).toBe(3)
  })

  it('daily_transfer_1 requires 1 transfer', () => {
    const challenges = generateChallenges({ ...empty, transfersCount: 1 })
    const challenge = challenges.find((c) => c.id === 'daily_transfer_1')!
    expect(challenge.completed).toBe(true)
  })

  it('weekly_submit_15 requires 15 materials', () => {
    const challenges = generateChallenges({ ...empty, materialsSubmitted: 15 })
    const challenge = challenges.find((c) => c.id === 'weekly_submit_15')!
    expect(challenge.completed).toBe(true)
  })

  it('weekly_transfer_5 requires 5 transfers', () => {
    const challenges = generateChallenges({ ...empty, transfersCount: 5 })
    const challenge = challenges.find((c) => c.id === 'weekly_transfer_5')!
    expect(challenge.completed).toBe(true)
  })

  it('weekly_earn_500 requires 500 tokens', () => {
    const challenges = generateChallenges({ ...empty, totalEarned: 500n })
    const challenge = challenges.find((c) => c.id === 'weekly_earn_500')!
    expect(challenge.completed).toBe(true)
  })

  it('progressPct reflects partial progress', () => {
    const challenges = generateChallenges({ ...empty, materialsSubmitted: 1 })
    const submit3 = challenges.find((c) => c.id === 'daily_submit_3')!
    expect(submit3.progressPct).toBe(Math.round((1 / 3) * 100))
    expect(submit3.completed).toBe(false)
  })

  it('expiresAt is set for all challenges', () => {
    const challenges = generateChallenges(empty)
    challenges.forEach((c) => {
      expect(c.expiresAt).toBeDefined()
      expect(c.expiresAt).toBeGreaterThan(0)
    })
  })

  it('daily challenges expire tomorrow', () => {
    const now = new Date('2024-01-15T10:00:00Z').getTime()
    const challenges = generateChallenges(empty, now)
    const daily = challenges.filter((c) => c.type === 'daily')
    daily.forEach((c) => {
      // Should expire approximately 24 hours from now
      expect(c.expiresAt).toBeGreaterThanOrEqual(now + 86_400_000 - 1000)
      expect(c.expiresAt).toBeLessThanOrEqual(now + 86_400_000 + 1000)
    })
  })

  it('weekly challenges expire in 7 days', () => {
    const now = new Date('2024-01-15T10:00:00Z').getTime()
    const challenges = generateChallenges(empty, now)
    const weekly = challenges.filter((c) => c.type === 'weekly')
    weekly.forEach((c) => {
      // Should expire approximately 7 days from start of week
      expect(c.expiresAt).toBeDefined()
    })
  })

  it('returns challenges with required fields', () => {
    const challenges = generateChallenges(empty)
    challenges.forEach((c) => {
      expect(c.id).toBeDefined()
      expect(c.title).toBeDefined()
      expect(c.description).toBeDefined()
      expect(c.target).toBeDefined()
      expect(c.current).toBeDefined()
      expect(c.progressPct).toBeDefined()
      expect(typeof c.completed).toBe('boolean')
      expect(c.type).toMatch(/daily|weekly/)
      expect(c.expiresAt).toBeDefined()
    })
  })

  it('caps current progress at target', () => {
    const challenges = generateChallenges({ ...empty, materialsSubmitted: 100 })
    const submit3 = challenges.find((c) => c.id === 'daily_submit_3')!
    expect(submit3.current).toBeLessThanOrEqual(submit3.target)
  })
})
