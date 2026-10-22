import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OfflinePage } from './OfflinePage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => true),
}))

const mockGetPendingMutations = vi.fn().mockResolvedValue([])
const mockUpdateMutationStatus = vi.fn().mockResolvedValue(undefined)
const mockRemoveMutationFromQueue = vi.fn().mockResolvedValue(undefined)
const mockClearOldMutations = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/indexedDB', () => ({
  getPendingMutations: (...args: unknown[]) => mockGetPendingMutations(...args),
  updateMutationStatus: (...args: unknown[]) => mockUpdateMutationStatus(...args),
  removeMutationFromQueue: (...args: unknown[]) => mockRemoveMutationFromQueue(...args),
  clearOldMutations: (...args: unknown[]) => mockClearOldMutations(...args),
}))

describe('OfflinePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPendingMutations.mockResolvedValue([])
  })

  it('renders the Offline Support heading', async () => {
    render(<OfflinePage />)
    expect(screen.getByText('Offline Support')).toBeInTheDocument()
    await waitFor(() => {})
  })

  it('shows the empty queue message when there are no queued actions', async () => {
    render(<OfflinePage />)
    await waitFor(() => {
      expect(screen.getByText('No queued actions')).toBeInTheDocument()
    })
  })
})
