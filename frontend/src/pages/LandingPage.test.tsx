import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LandingPage } from './LandingPage'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/hooks/useStats', () => ({
  useStats: vi.fn(() => ({
    totalWastes: 0n,
    totalWeight: 0n,
    totalTokens: 0n,
    isLoading: false,
  })),
}))

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the hero heading', () => {
    render(<LandingPage />)
    expect(
      screen.getByText('Recycling, rewarded on-chain.')
    ).toBeInTheDocument()
  })

  it('renders the Get Started button', () => {
    render(<LandingPage />)
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('renders the How it works section', () => {
    render(<LandingPage />)
    expect(screen.getByText('How it works')).toBeInTheDocument()
  })

  it('renders all three step descriptions', () => {
    render(<LandingPage />)
    expect(
      screen.getByText(/Recyclers submit waste materials on-chain/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Collectors pick up verified materials/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Manufacturers claim materials/)
    ).toBeInTheDocument()
  })
})
