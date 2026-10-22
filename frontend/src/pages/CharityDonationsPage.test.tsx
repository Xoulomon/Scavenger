import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CharityDonationsPage } from './CharityDonationsPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/hooks/useCharityDonations', () => ({
  useCharityDonations: vi.fn(() => ({
    charities: [],
    donations: [],
    totalDonated: 0n,
    balance: 0n,
    donate: vi.fn(),
    downloadReceipt: vi.fn(),
    isPending: false,
    error: null,
  })),
}))

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => ({ address: 'GTEST' })),
}))

describe('CharityDonationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Charity Donations heading', () => {
    render(<CharityDonationsPage />)
    expect(screen.getByText('Charity Donations')).toBeInTheDocument()
  })

  it('renders the charities tab', () => {
    render(<CharityDonationsPage />)
    expect(screen.getByText('charities')).toBeInTheDocument()
  })

  it('renders the history tab', () => {
    render(<CharityDonationsPage />)
    expect(screen.getByText('history')).toBeInTheDocument()
  })
})
