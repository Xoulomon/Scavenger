/**
 * Issue #1299: Unit tests for useAnalytics hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAnalytics } from '../useAnalytics'

const mockTrack = vi.fn()
const mockPageView = vi.fn()

vi.mock('@/lib/analyticsService', () => ({
  analytics: {
    track: mockTrack,
    pageView: mockPageView,
  },
}))

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns track and pageView functions', () => {
    const { result } = renderHook(() => useAnalytics())
    expect(typeof result.current.track).toBe('function')
    expect(typeof result.current.pageView).toBe('function')
  })

  it('track() forwards category, action, and options to analytics.track', () => {
    const { result } = renderHook(() => useAnalytics('user-123'))
    result.current.track('user', 'click', { label: 'button', value: 1 })
    expect(mockTrack).toHaveBeenCalledWith('user', 'click', {
      label: 'button',
      value: 1,
      userId: 'user-123',
    })
  })

  it('track() works without userId', () => {
    const { result } = renderHook(() => useAnalytics())
    result.current.track('contract', 'submit_waste')
    expect(mockTrack).toHaveBeenCalledWith('contract', 'submit_waste', {
      userId: undefined,
    })
  })

  it('track() merges metadata with userId', () => {
    const { result } = renderHook(() => useAnalytics('u1'))
    result.current.track('user', 'view', { metadata: { page: 'home' } })
    expect(mockTrack).toHaveBeenCalledWith('user', 'view', {
      metadata: { page: 'home' },
      userId: 'u1',
    })
  })

  it('pageView() calls analytics.pageView with page and userId', () => {
    const { result } = renderHook(() => useAnalytics('u2'))
    result.current.pageView('/dashboard')
    expect(mockPageView).toHaveBeenCalledWith('/dashboard', 'u2')
  })

  it('pageView() passes undefined userId when no userId given', () => {
    const { result } = renderHook(() => useAnalytics())
    result.current.pageView('/home')
    expect(mockPageView).toHaveBeenCalledWith('/home', undefined)
  })

  it('track and pageView are stable between renders (no new fn reference)', () => {
    const { result, rerender } = renderHook(({ userId }) => useAnalytics(userId), {
      initialProps: { userId: 'u1' },
    })
    const track1 = result.current.track
    const pv1 = result.current.pageView

    rerender({ userId: 'u1' }) // same userId — functions must be stable
    expect(result.current.track).toBe(track1)
    expect(result.current.pageView).toBe(pv1)
  })

  it('track and pageView update when userId changes', () => {
    const { result, rerender } = renderHook(({ userId }) => useAnalytics(userId), {
      initialProps: { userId: 'u1' },
    })
    const track1 = result.current.track

    rerender({ userId: 'u2' })
    expect(result.current.track).not.toBe(track1)
  })
})
