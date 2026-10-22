import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OfflineSettings } from './OfflineSettings'

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock('@/hooks/useAsync', () => ({
  useAsync: vi.fn((fn) => ({
    run: vi.fn(),
    isLoading: false,
  })),
}))

vi.mock('@/hooks/useResource', () => ({
  useResource: vi.fn(() => ({
    data: { bytes: 0, formatted: '0 B' },
    reload: vi.fn(),
  })),
}))

vi.mock('@/lib/offline/storage', () => ({
  getDatabaseSize: vi.fn().mockResolvedValue({ bytes: 0, formatted: '0 B' }),
  clearAllData: vi.fn().mockResolvedValue(undefined),
  getPendingMutations: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/offline/syncManager', () => ({
  syncManager: { syncPendingMutations: vi.fn().mockResolvedValue({ success: 0, failed: 0 }) },
}))

describe('OfflineSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Offline Mode Settings heading', () => {
    render(<OfflineSettings />)
    expect(screen.getByText('Offline Mode Settings')).toBeInTheDocument()
  })

  it('renders the Connection Status section', () => {
    render(<OfflineSettings />)
    expect(screen.getByText('Connection Status')).toBeInTheDocument()
  })

  it('shows online status when online', async () => {
    render(<OfflineSettings />)
    await waitFor(() => {
      expect(screen.getByText('Online')).toBeInTheDocument()
    })
  })
})
