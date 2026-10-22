import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RewardTrackingPage } from './RewardTrackingPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/hooks/useRewards', () => ({
  useRewards: vi.fn(() => ({
    stats: null,
    wastes: [],
    isLoading: false,
  })),
}))

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => ({ address: 'GTEST' })),
}))

describe('RewardTrackingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Reward Tracking heading', () => {
    render(<RewardTrackingPage />)
    expect(screen.getByText('Reward Tracking')).toBeInTheDocument()
  })

  it('renders the Export button', () => {
    render(<RewardTrackingPage />)
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('shows "No rewards found" when there are no wastes', () => {
    render(<RewardTrackingPage />)
    expect(screen.getByText('No rewards found')).toBeInTheDocument()
  })
})
