import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommunityPage } from './CommunityPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/design-system', () => ({
  LeaderboardRow: ({ rank }: { rank: number }) => <div data-testid={`row-${rank}`} />,
}))

vi.mock('@/components/community/ContributorRecognition', () => ({
  ContributorRecognition: () => <div data-testid="contributor-recognition" />,
}))

describe('CommunityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Community Hub heading', () => {
    render(<CommunityPage />)
    expect(screen.getByText('Community Hub')).toBeInTheDocument()
  })

  it('renders the Leaderboard section', () => {
    render(<CommunityPage />)
    expect(screen.getByText('Leaderboard')).toBeInTheDocument()
  })

  it('renders the Achievements section', () => {
    render(<CommunityPage />)
    expect(screen.getByText('Achievements')).toBeInTheDocument()
  })

  it('renders the Contributor Recognition section', () => {
    render(<CommunityPage />)
    expect(
      screen.getByText('Contributor Recognition Program')
    ).toBeInTheDocument()
  })
})
