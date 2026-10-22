import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GovernancePage } from './GovernancePage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/design-system', () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}))

vi.mock('@/lib/governance', () => ({
  createProposal: vi.fn(),
  getProposals: vi.fn(() => []),
  castVote: vi.fn(),
  vetoProposal: vi.fn(),
  tallyVotes: vi.fn(() => ({ for: 0, against: 0, abstain: 0, total: 0, quorumMet: false })),
  getGovernanceStats: vi.fn(() => ({
    totalProposals: 0,
    activeProposals: 0,
    passedProposals: 0,
    rejectedProposals: 0,
    participationRate: 0,
  })),
}))

describe('GovernancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Community Governance heading', () => {
    render(<GovernancePage />)
    expect(screen.getByText('Community Governance')).toBeInTheDocument()
  })

  it('renders the New Proposal button', () => {
    render(<GovernancePage />)
    expect(screen.getByText('New Proposal')).toBeInTheDocument()
  })

  it('renders the Governance Model section', () => {
    render(<GovernancePage />)
    expect(screen.getByText('Governance Model')).toBeInTheDocument()
  })

  it('renders the filter buttons', () => {
    render(<GovernancePage />)
    expect(screen.getByText('all')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('passed')).toBeInTheDocument()
    expect(screen.getByText('rejected')).toBeInTheDocument()
  })
})
