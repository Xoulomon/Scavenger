import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoginPage } from './LoginPage'

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}))

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => ({
    address: null,
    isConnected: false,
    connect: vi.fn(),
    isLoading: false,
    error: null,
  })),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ login: vi.fn() })),
}))

vi.mock('@/hooks/useRegisterParticipant', () => ({
  useRegisterParticipant: vi.fn(() => ({ mutate: vi.fn(), isError: false, isPending: false })),
}))

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/lib/contract', () => ({
  ScavengerClient: vi.fn(() => ({
    isParticipantRegistered: vi.fn(),
    getParticipant: vi.fn(),
  })),
}))

vi.mock('@/config', () => ({ config: { contractId: 'TEST' } }))
vi.mock('@/lib/stellar', () => ({
  networkConfig: { rpcUrl: '', networkPassphrase: '' },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the welcome heading when wallet is disconnected', () => {
    render(<LoginPage />)
    expect(screen.getByText('Welcome to Scavngr')).toBeInTheDocument()
  })

  it('renders a connect wallet button', () => {
    render(<LoginPage />)
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument()
  })
})
