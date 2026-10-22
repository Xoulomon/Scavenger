import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => ({ address: 'GTEST_ADDRESS', disconnect: vi.fn() })),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ logout: vi.fn() })),
}))

vi.mock('@/context/ContractContext', () => ({
  useContract: vi.fn(() => ({
    config: { network: 'TESTNET', rpcUrl: 'https://testnet', contractId: 'TEST_CONTRACT' },
    updateConfig: vi.fn(),
  })),
}))

vi.mock('@/context/ThemeProvider', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
    isDark: false,
    isReady: true,
    setTheme: vi.fn(),
  })),
}))

vi.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: vi.fn(() => ({ resetOnboarding: vi.fn() })),
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders notification preference toggles', () => {
    render(<SettingsPage />)

    expect(screen.getByLabelText(/Toggle transfer notifications/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Toggle confirmation notifications/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Toggle reward notifications/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Toggle system notifications/i)).toBeInTheDocument()
  })

  it('persists notification preference changes to localStorage', () => {
    render(<SettingsPage />)
    const transferToggle = screen.getByLabelText(/Toggle transfer notifications/i)

    fireEvent.click(transferToggle)

    const raw = localStorage.getItem('scavngr_notif_prefs')
    expect(raw).toBeTruthy()
    const prefs = raw ? JSON.parse(raw) : null
    expect(prefs).toEqual(expect.objectContaining({ transfer: false }))
  })
})
