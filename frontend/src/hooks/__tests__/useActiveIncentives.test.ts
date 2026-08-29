import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useActiveIncentives } from '../useActiveIncentives'

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
    activeIncentives: () => ['activeIncentives'],
  },
}))

const mockGetActiveIncentives = vi.fn()

vi.mock('@/api/client', () => ({
  ScavengerClient: vi.fn().mockImplementation(() => ({
    getActiveIncentives: mockGetActiveIncentives,
  })),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useActiveIncentives', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch active incentives', async () => {
    const mockIncentives = [
      {
        id: 1n,
        waste_type: 'Paper',
        reward_points: 100n,
        budget: 1000n,
        active: true,
      },
      {
        id: 2n,
        waste_type: 'Plastic',
        reward_points: 150n,
        budget: 1500n,
        active: true,
      },
    ]
    mockGetActiveIncentives.mockResolvedValue(mockIncentives)

    const { result } = renderHook(
      () => useActiveIncentives(),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockIncentives)
    expect(mockGetActiveIncentives).toHaveBeenCalled()
  })

  it('should handle empty incentives list', async () => {
    mockGetActiveIncentives.mockResolvedValue([])

    const { result } = renderHook(
      () => useActiveIncentives(),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })

  it('should handle errors gracefully', async () => {
    const error = new Error('Failed to fetch incentives')
    mockGetActiveIncentives.mockRejectedValue(error)

    const { result } = renderHook(
      () => useActiveIncentives(),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })
})
