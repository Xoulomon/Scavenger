/**
 * Community governance framework (Issue #782)
 *
 * Proposal lifecycle, voting system, veto mechanism, and
 * transparency reporting — all persisted in localStorage.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProposalStatus = 'draft' | 'active' | 'passed' | 'rejected' | 'vetoed'
export type ProposalCategory = 'protocol' | 'community' | 'treasury' | 'technical' | 'other'
export type VoteChoice = 'for' | 'against' | 'abstain'

export interface Proposal {
  id: string
  title: string
  description: string
  category: ProposalCategory
  status: ProposalStatus
  authorAddress: string
  createdAt: number
  votingEndsAt: number
  votes: Vote[]
  vetoes: Veto[]
  quorum: number       // minimum votes required
  passingThreshold: number // fraction (0–1) of non-abstain votes needed
}

export interface Vote {
  id: string
  proposalId: string
  voterAddress: string
  choice: VoteChoice
  weight: number
  timestamp: number
}

export interface Veto {
  id: string
  proposalId: string
  vetoerAddress: string
  reason: string
  timestamp: number
}

export interface GovernanceStats {
  totalProposals: number
  activeProposals: number
  passedProposals: number
  rejectedProposals: number
  totalVotesCast: number
  participationRate: number
}

// ── Storage ───────────────────────────────────────────────────────────────────

const PROPOSALS_KEY = 'scavngr_governance_proposals'

function loadProposals(): Proposal[] {
  try {
    const raw = localStorage.getItem(PROPOSALS_KEY)
    return raw ? (JSON.parse(raw) as Proposal[]) : []
  } catch {
    return []
  }
}

function saveProposals(proposals: Proposal[]): void {
  localStorage.setItem(PROPOSALS_KEY, JSON.stringify(proposals))
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── Proposal CRUD ─────────────────────────────────────────────────────────────

export function createProposal(params: {
  title: string
  description: string
  category: ProposalCategory
  authorAddress: string
  votingDurationMs?: number
  quorum?: number
  passingThreshold?: number
}): Proposal {
  const proposal: Proposal = {
    id: generateId(),
    title: params.title,
    description: params.description,
    category: params.category,
    status: 'active',
    authorAddress: params.authorAddress,
    createdAt: Date.now(),
    votingEndsAt: Date.now() + (params.votingDurationMs ?? 7 * 24 * 60 * 60 * 1000),
    votes: [],
    vetoes: [],
    quorum: params.quorum ?? 5,
    passingThreshold: params.passingThreshold ?? 0.5,
  }
  const proposals = loadProposals()
  proposals.push(proposal)
  saveProposals(proposals)
  return proposal
}

export function getProposals(status?: ProposalStatus): Proposal[] {
  const all = loadProposals()
  return status ? all.filter((p) => p.status === status) : all
}

export function getProposal(id: string): Proposal | undefined {
  return loadProposals().find((p) => p.id === id)
}

// ── Voting ────────────────────────────────────────────────────────────────────

export function castVote(proposalId: string, voterAddress: string, choice: VoteChoice, weight = 1): Vote {
  const proposals = loadProposals()
  const idx = proposals.findIndex((p) => p.id === proposalId)
  if (idx === -1) throw new Error(`Proposal ${proposalId} not found`)

  const proposal = proposals[idx]!
  if (proposal.status !== 'active') throw new Error('Proposal is not active.')
  if (Date.now() > proposal.votingEndsAt) throw new Error('Voting period has ended.')

  // Replace existing vote from same voter
  proposal.votes = proposal.votes.filter((v) => v.voterAddress !== voterAddress)

  const vote: Vote = {
    id: generateId(),
    proposalId,
    voterAddress,
    choice,
    weight,
    timestamp: Date.now(),
  }
  proposal.votes.push(vote)
  proposals[idx] = proposal
  saveProposals(proposals)
  return vote
}

// ── Veto ──────────────────────────────────────────────────────────────────────

export function vetoProposal(proposalId: string, vetoerAddress: string, reason: string): Veto {
  const proposals = loadProposals()
  const idx = proposals.findIndex((p) => p.id === proposalId)
  if (idx === -1) throw new Error(`Proposal ${proposalId} not found`)

  const proposal = proposals[idx]!
  if (proposal.status === 'vetoed') throw new Error('Already vetoed.')

  const veto: Veto = {
    id: generateId(),
    proposalId,
    vetoerAddress,
    reason,
    timestamp: Date.now(),
  }
  proposal.vetoes.push(veto)
  proposal.status = 'vetoed'
  proposals[idx] = proposal
  saveProposals(proposals)
  return veto
}

// ── Tallying ──────────────────────────────────────────────────────────────────

export interface VoteTally {
  for: number
  against: number
  abstain: number
  total: number
  quorumMet: boolean
  passed: boolean
}

export function tallyVotes(proposal: Proposal): VoteTally {
  const forVotes = proposal.votes.filter((v) => v.choice === 'for').reduce((s, v) => s + v.weight, 0)
  const againstVotes = proposal.votes.filter((v) => v.choice === 'against').reduce((s, v) => s + v.weight, 0)
  const abstainVotes = proposal.votes.filter((v) => v.choice === 'abstain').reduce((s, v) => s + v.weight, 0)
  const total = forVotes + againstVotes + abstainVotes
  const decisive = forVotes + againstVotes
  const quorumMet = total >= proposal.quorum
  const passed = quorumMet && decisive > 0 && forVotes / decisive >= proposal.passingThreshold

  return { for: forVotes, against: againstVotes, abstain: abstainVotes, total, quorumMet, passed }
}

/** Finalise an expired active proposal based on vote tally */
export function finalizeProposal(proposalId: string): Proposal {
  const proposals = loadProposals()
  const idx = proposals.findIndex((p) => p.id === proposalId)
  if (idx === -1) throw new Error(`Proposal ${proposalId} not found`)

  const proposal = proposals[idx]!
  if (proposal.status !== 'active') return proposal

  const tally = tallyVotes(proposal)
  proposal.status = tally.passed ? 'passed' : 'rejected'
  proposals[idx] = proposal
  saveProposals(proposals)
  return proposal
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getGovernanceStats(knownParticipants = 100): GovernanceStats {
  const proposals = loadProposals()
  const totalVotesCast = proposals.reduce((s, p) => s + p.votes.length, 0)
  const uniqueVoters = new Set(proposals.flatMap((p) => p.votes.map((v) => v.voterAddress))).size
  return {
    totalProposals: proposals.length,
    activeProposals: proposals.filter((p) => p.status === 'active').length,
    passedProposals: proposals.filter((p) => p.status === 'passed').length,
    rejectedProposals: proposals.filter((p) => p.status === 'rejected').length,
    totalVotesCast,
    participationRate: knownParticipants > 0 ? Math.min(1, uniqueVoters / knownParticipants) : 0,
  }
}

export function clearGovernanceData(): void {
  localStorage.removeItem(PROPOSALS_KEY)
}
