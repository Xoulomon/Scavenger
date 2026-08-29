import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useParticipantStats } from '../useParticipantStats'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/context/ContractContext', () => ({
  useContract: () => ({
    config: {
      contractId: 'CTEST123',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      network: 'TESTNET',
    },
  }),
}))

vi.mock('@/lib/stellar', () => ({
  getNetworkPassphrase: () => 'Test SDF Network ; September 2015',
}))

vi.mock('@/lib/cacheKeys', () => ({
  cacheKeys: {
    participantStats: (address: string) => ['participantStats', address],
  },
}))

const mockGetStats = vi.fn()

vi.mock('@/api/client', () => ({
  ScavengerClient: vi.fn().mockImplementation(() => ({
    getStats: mockGetStats,
  })),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useParticipantStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch participant stats when address is provided', async () => {
    const mockStats = {
      total_materials: 5n,
      total_weight: 1000n,
      total_tokens: 500n,
    }
    mockGetStats.mockResolvedValue(mockStats)

    const { result } = renderHook(
      () => useParticipantStats('G1234567890ABCDEF'),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockStats)
    expect(mockGetStats).toHaveBeenCalledWith('G1234567890ABCDEF')
  })

  it('should not fetch when address is undefined', () => {
    mockGetStats.mockResolvedValue({})

    renderHook(
      () => useParticipantStats(undefined),
      { wrapper: makeWrapper() }
    )

    expect(mockGetStats).not.toHaveBeenCalled()
  })

  it('should handle errors gracefully', async () => {
    const error = new Error('Network error')
    mockGetStats.mockRejectedValue(error)

    const { result } = renderHook(
      () => useParticipantStats('G1234567890ABCDEF'),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })
})
