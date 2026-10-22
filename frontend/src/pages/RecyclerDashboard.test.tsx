import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecyclerDashboard } from './RecyclerDashboard'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { address: 'GTEST', name: 'Tester', role: 'Recycler' } })),
}))

vi.mock('@/hooks/useResource', () => ({
  useResource: vi.fn(() => ({
    data: null,
    isLoading: false,
    reload: vi.fn(),
  })),
}))

vi.mock('@/api/client', () => ({
  ScavengerClient: vi.fn(() => ({})),
}))

vi.mock('@/config', () => ({ config: { contractId: 'TEST' } }))
vi.mock('@/lib/stellar', () => ({
  networkConfig: { rpcUrl: '', networkPassphrase: '' },
}))

vi.mock('@/components/modals/RegisterWasteModal', () => ({
  RegisterWasteModal: () => null,
}))

vi.mock('@/components/modals/TransferWasteModal', () => ({
  TransferWasteModal: () => null,
}))

describe('RecyclerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Dashboard heading', () => {
    render(<RecyclerDashboard />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders the Register Waste button', () => {
    render(<RecyclerDashboard />)
    expect(screen.getByText('Register Waste')).toBeInTheDocument()
  })
})
