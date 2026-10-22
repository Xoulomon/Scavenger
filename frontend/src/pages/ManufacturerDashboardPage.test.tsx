import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ManufacturerDashboardPage } from './ManufacturerDashboardPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/hooks/useManufacturerDashboard', () => ({
  useManufacturerDashboard: vi.fn(() => ({
    materials: [],
    incentives: [],
    stats: { received_count: 0, active_incentives: 0, total_distributed: 0n },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

vi.mock('@/hooks/useDistributeRewards', () => ({
  useDistributeRewards: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock('@/hooks/useSupplyChainStats', () => ({
  useSupplyChainStats: vi.fn(() => ({ stats: null, isLoading: false })),
}))

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => ({ address: 'GTEST' })),
}))

describe('ManufacturerDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Manufacturer Dashboard heading', async () => {
    render(<ManufacturerDashboardPage />)
    await waitFor(() => {
      expect(screen.getByText('Manufacturer Dashboard')).toBeInTheDocument()
    })
  })
})
