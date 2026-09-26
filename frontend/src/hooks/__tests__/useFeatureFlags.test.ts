/**
 * Issue #1299: Unit tests for useFeatureFlag, useFlag, and useFeatureFlags hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Mock the featureFlags lib ──────────────────────────────────────────────

const flagValues: Record<string, boolean | string | number> = {
  healthDashboard: true,
  newWasteFlow: false,
}
const flagOverrides: Array<{ key: string; value: boolean | string | number; expiresAt?: number }> = []

const flagsMock = {
  evaluateFlag: vi.fn((key: string) => flagValues[key] ?? false),
  isEnabled: vi.fn((key: string) => Boolean(flagValues[key])),
  setFlagOverride: vi.fn((key: string, value: boolean | string | number) => {
    flagValues[key] = value
    flagOverrides.push({ key, value })
  }),
  clearFlagOverride: vi.fn((key: string) => {
    delete flagValues[key]
    const idx = flagOverrides.findIndex((o) => o.key === key)
    if (idx >= 0) { flagOverrides.splice(idx, 1) }
  }),
  clearAllOverrides: vi.fn(() => {
    flagOverrides.length = 0
  }),
  getAllFlagValues: vi.fn(() => ({ ...flagValues })),
  getAllFlagOverrides: vi.fn(() => [...flagOverrides]),
  FLAGS: { healthDashboard: { key: 'healthDashboard' }, newWasteFlow: { key: 'newWasteFlow' } },
}

vi.mock('@/lib/featureFlags', () => flagsMock)

describe('useFeatureFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagValues['healthDashboard'] = true
    flagValues['newWasteFlow'] = false
    flagOverrides.length = 0
    flagsMock.evaluateFlag.mockImplementation((key: string) => flagValues[key] ?? false)
    flagsMock.getAllFlagValues.mockImplementation(() => ({ ...flagValues }))
    flagsMock.getAllFlagOverrides.mockImplementation(() => [...flagOverrides])
  })

  const loadHook = async () => {
    const { useFeatureFlag, useFlag, useFeatureFlags } = await import('../useFeatureFlags')
    return { useFeatureFlag, useFlag, useFeatureFlags }
  }

  it('returns the evaluated flag value', async () => {
    const { useFeatureFlag } = await loadHook()
    const { result } = renderHook(() => useFeatureFlag('healthDashboard'))
    expect(result.current).toBe(true)
    expect(flagsMock.evaluateFlag).toHaveBeenCalledWith('healthDashboard')
  })

  it('returns false for a disabled flag', async () => {
    const { useFeatureFlag } = await loadHook()
    const { result } = renderHook(() => useFeatureFlag('newWasteFlow'))
    expect(result.current).toBe(false)
  })

  it('returns false for an unknown flag key', async () => {
    flagsMock.evaluateFlag.mockImplementation((key: string) => flagValues[key] ?? false)
    const { useFeatureFlag } = await loadHook()
    const { result } = renderHook(() => useFeatureFlag('unknownFlag'))
    expect(result.current).toBe(false)
  })

  it('re-evaluates when the storage event fires', async () => {
    flagsMock.evaluateFlag
      .mockImplementationOnce((_key: string) => false)
      .mockImplementation((_key: string) => true)

    const { useFeatureFlag } = await loadHook()
    const { result } = renderHook(() => useFeatureFlag('healthDashboard'))
    expect(result.current).toBe(false)

    act(() => { window.dispatchEvent(new Event('storage')) })

    expect(result.current).toBe(true)
  })
})

describe('useFlag', () => {
  it('coerces flag value to boolean (truthy)', async () => {
    flagsMock.evaluateFlag.mockReturnValue(1) // numeric truthy
    const { useFlag } = await import('../useFeatureFlags')
    const { result } = renderHook(() => useFlag('someFlag'))
    expect(result.current).toBe(true)
  })

  it('coerces flag value to boolean (falsy)', async () => {
    flagsMock.evaluateFlag.mockReturnValue(0)
    const { useFlag } = await import('../useFeatureFlags')
    const { result } = renderHook(() => useFlag('someFlag'))
    expect(result.current).toBe(false)
  })
})

describe('useFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagValues['healthDashboard'] = true
    flagValues['newWasteFlow'] = false
    flagOverrides.length = 0
    flagsMock.getAllFlagValues.mockImplementation(() => ({ ...flagValues }))
    flagsMock.getAllFlagOverrides.mockImplementation(() => [...flagOverrides])
    flagsMock.isEnabled.mockImplementation((key: string) => Boolean(flagValues[key]))
  })

  it('returns flags, values and overrides', async () => {
    const { useFeatureFlags } = await import('../useFeatureFlags')
    const { result } = renderHook(() => useFeatureFlags())
    expect(result.current.flags).toBeDefined()
    expect(result.current.values).toHaveProperty('healthDashboard', true)
    expect(result.current.overrides).toEqual([])
  })

  it('isEnabled() returns correct boolean for a known flag', async () => {
    const { useFeatureFlags } = await import('../useFeatureFlags')
    const { result } = renderHook(() => useFeatureFlags())
    expect(result.current.isEnabled('healthDashboard')).toBe(true)
    expect(result.current.isEnabled('newWasteFlow')).toBe(false)
  })

  it('override() calls setFlagOverride and triggers refresh', async () => {
    flagsMock.getAllFlagValues
      .mockImplementationOnce(() => ({ healthDashboard: true, newWasteFlow: false }))
      .mockImplementation(() => ({ healthDashboard: true, newWasteFlow: true }))

    const { useFeatureFlags } = await import('../useFeatureFlags')
    const { result } = renderHook(() => useFeatureFlags())

    act(() => result.current.override('newWasteFlow', true))

    expect(flagsMock.setFlagOverride).toHaveBeenCalledWith('newWasteFlow', true, undefined)
    // After refresh, values should reflect new state
    expect(result.current.values).toHaveProperty('newWasteFlow', true)
  })

  it('clearOverride() calls clearFlagOverride and triggers refresh', async () => {
    flagsMock.getAllFlagValues.mockImplementation(() => ({ ...flagValues }))
    const { useFeatureFlags } = await import('../useFeatureFlags')
    const { result } = renderHook(() => useFeatureFlags())

    act(() => result.current.clearOverride('healthDashboard'))

    expect(flagsMock.clearFlagOverride).toHaveBeenCalledWith('healthDashboard')
  })

  it('clearAll() calls clearAllOverrides and triggers refresh', async () => {
    const { useFeatureFlags } = await import('../useFeatureFlags')
    const { result } = renderHook(() => useFeatureFlags())

    act(() => result.current.clearAll())

    expect(flagsMock.clearAllOverrides).toHaveBeenCalled()
  })

  it('refresh() updates values from getAllFlagValues', async () => {
    flagsMock.getAllFlagValues
      .mockImplementationOnce(() => ({ healthDashboard: true }))
      .mockImplementation(() => ({ healthDashboard: false }))

    const { useFeatureFlags } = await import('../useFeatureFlags')
    const { result } = renderHook(() => useFeatureFlags())
    expect(result.current.values['healthDashboard']).toBe(true)

    act(() => result.current.refresh())

    expect(result.current.values['healthDashboard']).toBe(false)
  })

  it('removes storage event listener on unmount', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { useFeatureFlags } = await import('../useFeatureFlags')
    const { unmount } = renderHook(() => useFeatureFlags())
    unmount()
    const removedStorage = removeSpy.mock.calls.filter(([ev]) => ev === 'storage')
    expect(removedStorage.length).toBeGreaterThanOrEqual(1)
  })
})
