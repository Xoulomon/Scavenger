import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GamificationPage } from './GamificationPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/hooks/useGamification', () => ({
  useGamification: vi.fn(() => ({
    badges: [],
    level: { level: 1, title: 'Beginner', minPoints: 0, maxPoints: 100 },
    challenges: [],
    leaderboard: [],
    newBadges: [],
    clearNewBadges: vi.fn(),
    isLoading: false,
  })),
}))

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => ({ address: 'GTEST' })),
}))

describe('GamificationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Achievements heading', () => {
    render(<GamificationPage />)
    expect(
      screen.getByRole('heading', { name: /achievements/i })
    ).toBeInTheDocument()
  })
})
