import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCollectorDashboard } from '../useCollectorDashboard'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWallet = { address: 'G1234567890ABCDEF' }
const mockConfig = {
  contractId: 'CTEST123',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  network: 'TESTNET' as const,
}

const mockGetStats = vi.fn()
const mockGetMetrics = vi.fn()
const mockGetMaterial = vi.fn()

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => mockWallet,
}))

vi.mock('@/context/ContractContext', () => ({
  useContract: () => ({ config: mockConfig }),
}))

vi.mock('@/lib/stellar', () => ({
  NETWORK_CONFIGS: {
    TESTNET: { networkPassphrase: 'Test SDF Network ; September 2015' },
  },
}))

vi.mock('@/api/client', () => ({
  ScavengerClient: vi.fn().mockImplementation(() => ({
    getStats: mockGetStats,
    getMetrics: mockGetMetrics,
    getMaterial: mockGetMaterial,
  })),
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCollectorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should start with loading state', () => {
    mockGetStats.mockImplementation(() => new Promise(() => {})) // Never resolves
    mockGetMetrics.mockImplementation(() => new Promise(() => {})) // Never resolves

    const { result } = renderHook(() => useCollectorDashboard())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('should successfully load collector dashboard data', async () => {
    const mockStats = {
      materials_submitted: 5n,
      total_weight: 1000n,
      total_earned: 500n,
    }

    const mockMetrics = {
      total_tokens_earned: 1000n,
      total_waste_weight: 5000n,
    }

    mockGetStats.mockResolvedValue(mockStats)
    mockGetMetrics.mockResolvedValue(mockMetrics)
    mockGetMaterial.mockResolvedValue(null)

    const { result } = renderHook(() => useCollectorDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.stats).toEqual(mockStats)
    expect(result.current.tokenBalance).toBe(1000n)
    expect(result.current.error).toBeNull()
  })

  it('should handle loading errors gracefully', async () => {
    const errorMessage = 'Failed to fetch stats'
    mockGetStats.mockRejectedValue(new Error(errorMessage))
    mockGetMetrics.mockResolvedValue({ total_tokens_earned: 0n })

    const { result } = renderHook(() => useCollectorDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe(errorMessage)
    expect(result.current.stats).toBeNull()
  })

  it('should not fetch data when wallet address is missing', () => {
    mockWallet.address = undefined as any

    renderHook(() => useCollectorDashboard())

    expect(mockGetStats).not.toHaveBeenCalled()
    expect(mockGetMetrics).not.toHaveBeenCalled()
  })

  it('should provide a refetch function', async () => {
    const mockStats = { materials_submitted: 1n }
    mockGetStats.mockResolvedValue(mockStats)
    mockGetMetrics.mockResolvedValue({ total_tokens_earned: 100n })
    mockGetMaterial.mockResolvedValue(null)

    const { result } = renderHook(() => useCollectorDashboard())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(typeof result.current.refetch).toBe('function')
    mockGetStats.mockClear()

    result.current.refetch()
    await waitFor(() => {
      expect(mockGetStats).toHaveBeenCalled()
    })
  })

  it('should categorize materials by waste type', async () => {
    mockGetStats.mockResolvedValue({ materials_submitted: 2n })
    mockGetMetrics.mockResolvedValue({ total_tokens_earned: 0n })

    const mockMaterial1 = {
      id: 1,
      waste_type: 'Paper',
      weight: 100,
      is_active: true,
      is_confirmed: true,
      current_owner: mockWallet.address,
    }
    const mockMaterial2 = {
      id: 2,
      waste_type: 'Plastic',
      weight: 200,
      is_active: true,
      is_confirmed: true,
      current_owner: mockWallet.address,
    }

    mockGetMaterial.mockResolvedValueOnce(mockMaterial1).mockResolvedValueOnce(mockMaterial2)

    const { result } = renderHook(() => useCollectorDashboard())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.statsByWasteType.Paper).toBe(1)
    expect(result.current.statsByWasteType.Plastic).toBe(1)
  })
})
