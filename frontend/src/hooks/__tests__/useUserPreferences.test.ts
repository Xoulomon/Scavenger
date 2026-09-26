/**
 * Issue #1299: Unit tests for useUserPreferences hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Mock the userPreferences lib ─────────────────────────────────────────────

const mockPreferences = {
  theme: 'light',
  language: 'en',
  notifications: true,
  compactMode: false,
}

const libMock = {
  getUserPreferences: vi.fn(() => ({ ...mockPreferences })),
  saveUserPreferences: vi.fn(),
  resetUserPreferences: vi.fn(),
  exportPreferences: vi.fn(() => JSON.stringify(mockPreferences)),
  importPreferences: vi.fn((_json: string) => true),
}

vi.mock('../lib/userPreferences', () => libMock)

describe('useUserPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    libMock.getUserPreferences.mockReturnValue({ ...mockPreferences })
    libMock.importPreferences.mockReturnValue(true)
    libMock.exportPreferences.mockReturnValue(JSON.stringify(mockPreferences))
  })

  const loadHook = async () => {
    // Dynamic import ensures the vi.mock is applied
    const { useUserPreferences } = await import('../useUserPreferences')
    return renderHook(() => useUserPreferences())
  }

  it('returns preferences from getUserPreferences on mount', async () => {
    const { result } = await loadHook()
    expect(result.current.preferences).toEqual(mockPreferences)
    expect(libMock.getUserPreferences).toHaveBeenCalled()
  })

  it('updatePreferences calls saveUserPreferences and refreshes state', async () => {
    const updated = { theme: 'dark' as const }
    libMock.getUserPreferences
      .mockReturnValueOnce({ ...mockPreferences }) // initial
      .mockReturnValueOnce({ ...mockPreferences }) // useEffect
      .mockReturnValue({ ...mockPreferences, theme: 'dark' }) // after save

    const { result } = await loadHook()

    act(() => result.current.updatePreferences(updated))

    expect(libMock.saveUserPreferences).toHaveBeenCalledWith(updated)
    expect(libMock.getUserPreferences).toHaveBeenCalled()
  })

  it('reset() calls resetUserPreferences and refreshes state', async () => {
    const { result } = await loadHook()
    act(() => result.current.reset())
    expect(libMock.resetUserPreferences).toHaveBeenCalled()
    expect(libMock.getUserPreferences).toHaveBeenCalled()
  })

  it('exportToJson() calls exportPreferences and returns its value', async () => {
    const { result } = await loadHook()
    const json = result.current.exportToJson()
    expect(libMock.exportPreferences).toHaveBeenCalled()
    expect(json).toBe(JSON.stringify(mockPreferences))
  })

  it('importFromJson() calls importPreferences and refreshes on success', async () => {
    libMock.importPreferences.mockReturnValue(true)
    const { result } = await loadHook()
    const success = result.current.importFromJson('{"theme":"dark"}')
    expect(libMock.importPreferences).toHaveBeenCalledWith('{"theme":"dark"}')
    expect(success).toBe(true)
    expect(libMock.getUserPreferences).toHaveBeenCalled()
  })

  it('importFromJson() does not refresh when importPreferences returns false', async () => {
    libMock.importPreferences.mockReturnValue(false)
    libMock.getUserPreferences.mockClear()
    const { result } = await loadHook()
    const initialCallCount = libMock.getUserPreferences.mock.calls.length

    result.current.importFromJson('invalid')

    // No additional getUserPreferences call beyond initialization
    expect(libMock.getUserPreferences.mock.calls.length).toBe(initialCallCount)
    expect(result.current.importFromJson('invalid')).toBe(false)
  })
})
