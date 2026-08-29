import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useImpactCalculator } from '../useImpactCalculator'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWastes = [
  {
    id: 1,
    waste_type: 'Paper',
    weight: 100,
    is_active: true,
  },
  {
    id: 2,
    waste_type: 'Plastic',
    weight: 50,
    is_active: true,
  },
]

vi.mock('@/hooks/useParticipantWastes', () => ({
  useParticipantWastes: () => ({
    wastes: mockWastes,
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/lib/impactCalculator', () => ({
  calculateImpact: () => ({
    co2Kg: 250,
    energyKwh: 50,
    waterLitres: 200,
    treesEquivalent: 2,
  }),
  calculateEquivalents: () => ({
    carsKm: 1000,
    smartphones: 5,
    showers: 10,
    lightbulbDays: 50,
  }),
  buildShareText: () => 'I saved 250kg of CO2 through recycling!',
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useImpactCalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should calculate impact from participant wastes', async () => {
    const { result } = renderHook(() => useImpactCalculator())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.impact).toEqual({
      co2Kg: 250,
      energyKwh: 50,
      waterLitres: 200,
      treesEquivalent: 2,
    })
  })

  it('should calculate equivalents', async () => {
    const { result } = renderHook(() => useImpactCalculator())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.equivalents).toEqual({
      carsKm: 1000,
      smartphones: 5,
      showers: 10,
      lightbulbDays: 50,
    })
  })

  it('should build share text', async () => {
    const { result } = renderHook(() => useImpactCalculator())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.shareText).toBe('I saved 250kg of CO2 through recycling!')
  })

  it('should propagate loading state from useParticipantWastes', () => {
    vi.mocked(require('@/hooks/useParticipantWastes').useParticipantWastes).mockReturnValueOnce({
      wastes: [],
      isLoading: true,
      isError: false,
    })

    const { result } = renderHook(() => useImpactCalculator())

    expect(result.current.isLoading).toBe(true)
  })

  it('should propagate error state from useParticipantWastes', () => {
    vi.mocked(require('@/hooks/useParticipantWastes').useParticipantWastes).mockReturnValueOnce({
      wastes: [],
      isLoading: false,
      isError: true,
    })

    const { result } = renderHook(() => useImpactCalculator())

    expect(result.current.isError).toBe(true)
  })

  it('should handle empty wastes list', () => {
    vi.mocked(require('@/hooks/useParticipantWastes').useParticipantWastes).mockReturnValueOnce({
      wastes: [],
      isLoading: false,
      isError: false,
    })

    const { result } = renderHook(() => useImpactCalculator())

    expect(result.current.impact).toEqual({
      co2Kg: 250,
      energyKwh: 50,
      waterLitres: 200,
      treesEquivalent: 2,
    })
  })

  it('should recalculate impact when wastes change', () => {
    const { rerender } = renderHook(() => useImpactCalculator())

    const newWastes = [
      {
        id: 3,
        waste_type: 'Metal',
        weight: 200,
        is_active: true,
      },
    ]

    vi.mocked(require('@/hooks/useParticipantWastes').useParticipantWastes).mockReturnValueOnce({
      wastes: newWastes,
      isLoading: false,
      isError: false,
    })

    rerender()

    // Impact should be recalculated
    expect(require('@/lib/impactCalculator').calculateImpact).toHaveBeenCalled()
  })
})
