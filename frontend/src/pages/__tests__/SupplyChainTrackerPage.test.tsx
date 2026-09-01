import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SupplyChainTrackerPage } from '../SupplyChainTrackerPage'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: {
    waste_id: BigInt(1),
    waste_type: 0,
    weight: 500,
    recycled_timestamp: 1680000000,
    current_owner: 'GOWNER',
    latitude: 0,
    longitude: 0,
    is_active: true,
    is_confirmed: false,
    confirmer: null,
  }, isLoading: false, isError: false })),
}))

vi.mock('@/hooks/useTransferHistory', () => ({
  useTransferHistory: vi.fn(() => ({
    history: [
      { waste_id: BigInt(1), from: 'GFROM', to: 'GTO', transferred_at: 1680000100 }
    ],
    isLoading: false,
  })),
}))

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))
vi.mock('@/context/ContractContext', () => ({ useContract: vi.fn(() => ({ config: { rpcUrl: 'https://testnet', contractId: 'TEST_CONTRACT' } })) }))

describe('SupplyChainTrackerPage', () => {
  it('renders the journey visualization and participant summary', () => {
    render(<SupplyChainTrackerPage />)

    expect(screen.getByText(/Supply Chain Journey/i)).toBeInTheDocument()
    expect(screen.getByText(/Participant Summary/i)).toBeInTheDocument()
    expect(screen.getByLabelText('GFROM')).toBeInTheDocument()
    expect(screen.getByLabelText('GTO')).toBeInTheDocument()
    expect(screen.getByLabelText('GOWNER')).toBeInTheDocument()
  })
})
