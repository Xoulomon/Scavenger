import { describe, it, expect, beforeEach } from 'vitest'
import {
  createProposal,
  getProposals,
  getProposal,
  castVote,
  vetoProposal,
  tallyVotes,
  finalizeProposal,
  getGovernanceStats,
  clearGovernanceData,
} from './governance'

beforeEach(() => clearGovernanceData())

describe('createProposal', () => {
  it('creates and persists a proposal', () => {
    const p = createProposal({ title: 'Test', description: 'Desc', category: 'community', authorAddress: 'G001' })
    expect(p.title).toBe('Test')
    expect(p.status).toBe('active')
    expect(getProposals()).toHaveLength(1)
  })

  it('defaults quorum to 5', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'protocol', authorAddress: 'G001' })
    expect(p.quorum).toBe(5)
  })

  it('respects custom quorum', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'treasury', authorAddress: 'G001', quorum: 10 })
    expect(p.quorum).toBe(10)
  })
})

describe('getProposals', () => {
  it('filters by status', () => {
    createProposal({ title: 'A', description: 'D', category: 'community', authorAddress: 'G001' })
    const active = getProposals('active')
    expect(active).toHaveLength(1)
    const passed = getProposals('passed')
    expect(passed).toHaveLength(0)
  })
})

describe('castVote', () => {
  it('records a vote', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'community', authorAddress: 'G001' })
    const vote = castVote(p.id, 'GVOTER', 'for')
    expect(vote.choice).toBe('for')
    const updated = getProposal(p.id)!
    expect(updated.votes).toHaveLength(1)
  })

  it('replaces existing vote from same voter', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'community', authorAddress: 'G001' })
    castVote(p.id, 'GVOTER', 'for')
    castVote(p.id, 'GVOTER', 'against')
    const updated = getProposal(p.id)!
    expect(updated.votes).toHaveLength(1)
    expect(updated.votes[0]!.choice).toBe('against')
  })

  it('throws for unknown proposal', () => {
    expect(() => castVote('bad-id', 'G001', 'for')).toThrow()
  })
})

describe('vetoProposal', () => {
  it('sets status to vetoed', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'community', authorAddress: 'G001' })
    vetoProposal(p.id, 'GADMIN', 'Bad idea')
    expect(getProposal(p.id)!.status).toBe('vetoed')
  })

  it('throws if already vetoed', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'community', authorAddress: 'G001' })
    vetoProposal(p.id, 'GADMIN', 'reason')
    expect(() => vetoProposal(p.id, 'GADMIN2', 'reason2')).toThrow()
  })
})

describe('tallyVotes', () => {
  it('counts votes correctly', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'community', authorAddress: 'G001', quorum: 2 })
    castVote(p.id, 'G1', 'for')
    castVote(p.id, 'G2', 'for')
    castVote(p.id, 'G3', 'against')
    const updated = getProposal(p.id)!
    const tally = tallyVotes(updated)
    expect(tally.for).toBe(2)
    expect(tally.against).toBe(1)
    expect(tally.total).toBe(3)
    expect(tally.quorumMet).toBe(true)
  })

  it('marks passed when majority for and quorum met', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'community', authorAddress: 'G001', quorum: 1 })
    castVote(p.id, 'G1', 'for')
    const tally = tallyVotes(getProposal(p.id)!)
    expect(tally.passed).toBe(true)
  })
})

describe('finalizeProposal', () => {
  it('marks passed when votes pass threshold and quorum met', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'community', authorAddress: 'G001', quorum: 1 })
    castVote(p.id, 'G1', 'for')
    const finalized = finalizeProposal(p.id)
    expect(finalized.status).toBe('passed')
  })

  it('marks rejected when quorum not met', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'community', authorAddress: 'G001', quorum: 10 })
    castVote(p.id, 'G1', 'for')
    const finalized = finalizeProposal(p.id)
    expect(finalized.status).toBe('rejected')
  })
})

describe('getGovernanceStats', () => {
  it('returns zero stats when empty', () => {
    const stats = getGovernanceStats()
    expect(stats.totalProposals).toBe(0)
    expect(stats.totalVotesCast).toBe(0)
  })

  it('counts proposals and votes correctly', () => {
    const p = createProposal({ title: 'T', description: 'D', category: 'community', authorAddress: 'G001' })
    castVote(p.id, 'G1', 'for')
    const stats = getGovernanceStats()
    expect(stats.totalProposals).toBe(1)
    expect(stats.activeProposals).toBe(1)
    expect(stats.totalVotesCast).toBe(1)
  })
})
