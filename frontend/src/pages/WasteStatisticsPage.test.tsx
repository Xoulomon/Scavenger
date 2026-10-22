import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WasteStatisticsPage } from './WasteStatisticsPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/hooks/useParticipantWastes', () => ({
  useParticipantWastes: vi.fn(() => ({ wastes: [], isLoading: false })),
}))

vi.mock('@/hooks/useSupplyChainStats', () => ({
  useSupplyChainStats: vi.fn(() => ({ stats: null, isLoading: false })),
}))

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => ({ address: 'GTEST' })),
}))

describe('WasteStatisticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Waste Statistics heading', () => {
    render(<WasteStatisticsPage />)
    expect(screen.getByText('Waste Statistics')).toBeInTheDocument()
  })

  it('renders the Export button', () => {
    render(<WasteStatisticsPage />)
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('shows "No waste data available" when no wastes are present', () => {
    render(<WasteStatisticsPage />)
    expect(screen.getByText('No waste data available')).toBeInTheDocument()
  })
})
