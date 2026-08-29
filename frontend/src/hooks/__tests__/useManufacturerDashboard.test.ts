import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useManufacturerDashboard } from '../useManufacturerDashboard'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWallet = { address: 'G1234567890ABCDEF' }
const mockConfig = {
  contractId: 'CTEST123',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  network: 'TESTNET' as const,
}

const mockGetActiveMfrIncentive = vi.fn()
const mockGetIncentives = vi.fn()
const mockGetMaterial = vi.fn()
const mockGetStats = vi.fn()
const mockCreateIncentive = vi.fn()
const mockConfirmWasteDetails = vi.fn()

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => mockWallet,
}))

vi.mock('@/context/ContractContext', () => ({
  useContract: () => ({ config: mockConfig }),
}))

vi.mock('@/lib/stellar', () => ({
  getNetworkPassphrase: () => 'Test SDF Network ; September 2015',
}))

vi.mock('@/api/client', () => ({
  ScavengerClient: vi.fn().mockImplementation(() => ({
    getActiveMfrIncentive: mockGetActiveMfrIncentive,
    getIncentives: mockGetIncentives,
    getMaterial: mockGetMaterial,
    getStats: mockGetStats,
    createIncentive: mockCreateIncentive,
    confirmWasteDetails: mockConfirmWasteDetails,
  })),
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useManufacturerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetActiveMfrIncentive.mockResolvedValue(null)
    mockGetIncentives.mockResolvedValue([])
    mockGetMaterial.mockResolvedValue(null)
    mockGetStats.mockResolvedValue({ total_earned: 0n })
  })

  it('should start with loading state', () => {
    mockGetStats.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useManufacturerDashboard())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('should successfully load manufacturer dashboard data', async () => {
    const mockIncentive = {
      id: 1n,
      waste_type: 'Paper',
      reward_points: 100n,
      budget: 1000n,
    }

    mockGetActiveMfrIncentive.mockResolvedValue(mockIncentive)
    mockGetIncentives.mockResolvedValue([mockIncentive])
    mockGetMaterial.mockResolvedValue(null)
    mockGetStats.mockResolvedValue({ total_earned: 500n })

    const { result } = renderHook(() => useManufacturerDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.incentives).toContain(mockIncentive)
    expect(result.current.error).toBeNull()
  })

  it('should handle loading errors gracefully', async () => {
    const errorMessage = 'Failed to fetch incentives'
    mockGetActiveMfrIncentive.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useManufacturerDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe(errorMessage)
    expect(result.current.incentives).toEqual([])
  })

  it('should not fetch data when wallet address is missing', () => {
    mockWallet.address = undefined as any
    mockGetStats.mockResolvedValue({ total_earned: 0n })

    renderHook(() => useManufacturerDashboard())

    expect(mockGetActiveMfrIncentive).not.toHaveBeenCalled()
  })

  it('should call createIncentive with correct parameters', async () => {
    mockGetStats.mockResolvedValue({ total_earned: 0n })
    mockGetActiveMfrIncentive.mockResolvedValue(null)
    mockGetIncentives.mockResolvedValue([])
    mockGetMaterial.mockResolvedValue(null)
    mockCreateIncentive.mockResolvedValue({ id: 1n })

    const { result } = renderHook(() => useManufacturerDashboard())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.createIncentive(1 as any, 100n, 1000n)
    })

    expect(mockCreateIncentive).toHaveBeenCalledWith(mockWallet.address, 1, 100n, 1000n, mockWallet.address)
  })

  it('should call confirmWaste with correct parameters', async () => {
    mockGetStats.mockResolvedValue({ total_earned: 0n })
    mockGetActiveMfrIncentive.mockResolvedValue(null)
    mockGetIncentives.mockResolvedValue([])
    mockGetMaterial.mockResolvedValue(null)
    mockConfirmWasteDetails.mockResolvedValue(true)

    const { result } = renderHook(() => useManufacturerDashboard())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.confirmWaste(123)
    })

    expect(mockConfirmWasteDetails).toHaveBeenCalledWith(123n, mockWallet.address, mockWallet.address)
  })

  it('should track reward history', async () => {
    mockGetStats.mockResolvedValue({ total_earned: 500n })
    mockGetActiveMfrIncentive.mockResolvedValue(null)
    mockGetIncentives.mockResolvedValue([])
    mockGetMaterial.mockResolvedValue(null)

    const { result } = renderHook(() => useManufacturerDashboard())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.rewardHistory.length).toBeGreaterThan(0)
    expect(result.current.rewardHistory[0].amount).toBe(500n)
  })

  it('should provide a reload function', async () => {
    mockGetStats.mockResolvedValue({ total_earned: 0n })
    mockGetActiveMfrIncentive.mockResolvedValue(null)
    mockGetIncentives.mockResolvedValue([])

    const { result } = renderHook(() => useManufacturerDashboard())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(typeof result.current.reload).toBe('function')
    mockGetStats.mockClear()

    await act(async () => {
      await result.current.reload()
    })

    expect(mockGetStats).toHaveBeenCalled()
  })
})
