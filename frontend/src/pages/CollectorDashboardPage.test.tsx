import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollectorDashboardPage } from './CollectorDashboardPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}))

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => ({ address: 'GTEST' })),
}))

vi.mock('@/hooks/useCollectorDashboard', () => ({
  useCollectorDashboard: vi.fn(() => ({
    tokenBalance: 0n,
    pendingTransfers: [],
    collectedWastes: [],
    stats: { transfers_count: 0 },
    statsByWasteType: {},
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

describe('CollectorDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Collector Dashboard heading', () => {
    render(<CollectorDashboardPage />)
    expect(screen.getByText('Collector Dashboard')).toBeInTheDocument()
  })

  it('shows empty state for pending transfers', () => {
    render(<CollectorDashboardPage />)
    expect(screen.getByText('No pending transfers')).toBeInTheDocument()
  })
})
