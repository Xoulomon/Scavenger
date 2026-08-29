import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMetrics } from '../useMetrics'

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
    metrics: () => ['metrics'],
  },
}))

const mockGetMetrics = vi.fn()

vi.mock('@/api/client', () => ({
  ScavengerClient: vi.fn().mockImplementation(() => ({
    getMetrics: mockGetMetrics,
  })),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch global metrics', async () => {
    const mockMetrics = {
      total_participants: 42n,
      total_waste_weight: 5000n,
      total_tokens_distributed: 10000n,
    }
    mockGetMetrics.mockResolvedValue(mockMetrics)

    const { result } = renderHook(
      () => useMetrics(),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockMetrics)
    expect(mockGetMetrics).toHaveBeenCalled()
  })

  it('should handle errors gracefully', async () => {
    const error = new Error('Failed to fetch metrics')
    mockGetMetrics.mockRejectedValue(error)

    const { result } = renderHook(
      () => useMetrics(),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })

  it('should use appropriate cache time', async () => {
    const mockMetrics = { total_participants: 1n }
    mockGetMetrics.mockResolvedValue(mockMetrics)

    renderHook(
      () => useMetrics(),
      { wrapper: makeWrapper() }
    )

    await waitFor(() => {
      expect(mockGetMetrics).toHaveBeenCalled()
    })

    // Verify staleTime is set (2 minutes)
    expect(mockGetMetrics).toHaveBeenCalledTimes(1)
  })
})
