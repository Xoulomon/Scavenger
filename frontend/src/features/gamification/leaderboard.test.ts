import { describe, it, expect } from 'vitest'
import { buildLeaderboard } from './leaderboard'
import { UserStats } from './types'

const empty: UserStats = { materialsSubmitted: 0, transfersCount: 0, totalEarned: 0n }

describe('buildLeaderboard', () => {
  it('sorts by XP descending', () => {
    const entries = [
      { address: 'A', stats: { ...empty, materialsSubmitted: 5 } },
      { address: 'B', stats: { ...empty, materialsSubmitted: 10 } },
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

  it('truncates other addresses', () => {
    const entries = [{ address: 'GABCDEF1234567890', stats: empty }]
    const lb = buildLeaderboard(entries)
    expect(lb[0].displayName).toMatch(/^GABC…7890$/)
  })

  it('assigns rank starting at 1', () => {
    const entries = [{ address: 'X', stats: empty }]
    expect(buildLeaderboard(entries)[0].rank).toBe(1)
  })

  it('assigns sequential ranks', () => {
    const entries = [
      { address: 'A', stats: { ...empty, materialsSubmitted: 1 } },
      { address: 'B', stats: { ...empty, materialsSubmitted: 2 } },
      { address: 'C', stats: { ...empty, materialsSubmitted: 3 } },
    ]
    const lb = buildLeaderboard(entries)
    expect(lb[0].rank).toBe(1)
    expect(lb[1].rank).toBe(2)
    expect(lb[2].rank).toBe(3)
  })

  it('includes XP in result', () => {
    const entries = [
      { address: 'A', stats: { ...empty, materialsSubmitted: 5 } },
    ]
    const lb = buildLeaderboard(entries)
    expect(lb[0].xp).toBe(50) // 5 * 10
  })

  it('includes level in result', () => {
    const entries = [
      { address: 'A', stats: { ...empty, materialsSubmitted: 5 } },
    ]
    const lb = buildLeaderboard(entries)
    expect(lb[0].level).toBeDefined()
    expect(lb[0].level).toBeGreaterThan(0)
  })

  it('handles empty leaderboard', () => {
    const lb = buildLeaderboard([])
    expect(lb).toHaveLength(0)
  })

  it('handles ties in XP', () => {
    const entries = [
      { address: 'A', stats: { ...empty, materialsSubmitted: 5 } },
      { address: 'B', stats: { ...empty, materialsSubmitted: 5 } },
      { address: 'C', stats: { ...empty, materialsSubmitted: 5 } },
    ]
    const lb = buildLeaderboard(entries)
    // All should have XP of 50, but order might vary
    expect(lb[0].xp).toBe(50)
    expect(lb[1].xp).toBe(50)
    expect(lb[2].xp).toBe(50)
  })

  it('returns leaderboard entries with required fields', () => {
    const entries = [
      { address: 'ADDR1', stats: { ...empty, materialsSubmitted: 1 } },
    ]
    const lb = buildLeaderboard(entries)
    const entry = lb[0]
    expect(entry.rank).toBeDefined()
    expect(entry.address).toBeDefined()
    expect(entry.displayName).toBeDefined()
    expect(entry.xp).toBeDefined()
    expect(entry.level).toBeDefined()
  })

  it('preserves address in result', () => {
    const entries = [
      { address: 'TESTADDR123456', stats: empty },
    ]
    const lb = buildLeaderboard(entries)
    expect(lb[0].address).toBe('TESTADDR123456')
  })

  it('calculates correct level for each entry', () => {
    const entries = [
      { address: 'A', stats: { ...empty, materialsSubmitted: 0 } }, // Level 1
      { address: 'B', stats: { ...empty, materialsSubmitted: 5 } }, // Level 2
      { address: 'C', stats: { ...empty, materialsSubmitted: 15 } }, // Level 3
    ]
    const lb = buildLeaderboard(entries)
    const sorted = lb.sort((a, b) => a.xp - b.xp)
    expect(sorted[0].level).toBe(1)
    expect(sorted[1].level).toBe(2)
    expect(sorted[2].level).toBe(3)
  })
})
