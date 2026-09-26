/**
 * Issue #1299: Unit tests for useResource hook.
 *
 * useResource wraps useAsync to auto-fetch on mount (and deps change)
 * and expose a reload() for manual refresh.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useResource } from '../useResource'

describe('useResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Auto-fetch on mount ───────────────────────────────────────────────────

  it('starts as loading (not idle) before first fetch settles', () => {
    let resolve!: (v: string) => void
    const fetcher = vi.fn(() => new Promise<string>((r) => { resolve = r }))

    const { result } = renderHook(() => useResource(fetcher))
    expect(result.current.isLoading).toBe(true)
    act(() => resolve('data'))
  })

  it('fetches on mount and populates data on success', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 })
    const { result } = renderHook(() => useResource(fetcher))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual({ id: 1 })
    expect(result.current.isLoading).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('transitions to error state when fetcher rejects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useResource(fetcher))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.message).toBe('network error')
    expect(result.current.data).toBeNull()
  })

  // ── reload() ─────────────────────────────────────────────────────────────

  it('reload() triggers a new fetch and updates data', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce('initial')
      .mockResolvedValueOnce('reloaded')

    const { result } = renderHook(() => useResource(fetcher))
    await waitFor(() => expect(result.current.data).toBe('initial'))

    await act(async () => { await result.current.reload() })

    expect(result.current.data).toBe('reloaded')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('reload() recovers from an error state', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce('recovered')

    const { result } = renderHook(() => useResource(fetcher))
    await waitFor(() => expect(result.current.status).toBe('error'))

    await act(async () => { await result.current.reload() })

    expect(result.current.status).toBe('success')
    expect(result.current.data).toBe('recovered')
    expect(result.current.error).toBeNull()
  })

  // ── Deps array ────────────────────────────────────────────────────────────

  it('re-fetches when deps change', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second')

    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useResource(fetcher, [id]),
      { initialProps: { id: 1 } }
    )
    await waitFor(() => expect(result.current.data).toBe('first'))

    rerender({ id: 2 })
    await waitFor(() => expect(result.current.data).toBe('second'))

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does NOT re-fetch when deps stay the same', async () => {
    const fetcher = vi.fn().mockResolvedValue('stable')

    const { rerender } = renderHook(
      ({ id }: { id: number }) => useResource(fetcher, [id]),
      { initialProps: { id: 5 } }
    )
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

    // Rerender with same id
    rerender({ id: 5 })
    // Allow any extra renders to settle
    await new Promise((r) => setTimeout(r, 10))

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  // ── isLoading during reload ───────────────────────────────────────────────

  it('isLoading is true while reload() is in-flight', async () => {
    let resolveReload!: (v: string) => void
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce('initial')
      .mockImplementationOnce(() => new Promise<string>((r) => { resolveReload = r }))

    const { result } = renderHook(() => useResource(fetcher))
    await waitFor(() => expect(result.current.data).toBe('initial'))

    act(() => { void result.current.reload() })
    expect(result.current.isLoading).toBe(true)

    act(() => resolveReload('done'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })
})
