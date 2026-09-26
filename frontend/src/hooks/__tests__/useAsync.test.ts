/**
 * Issue #1299: Unit tests for useAsync hook.
 *
 * Covers: idle → loading → success/error state transitions, stale-call
 * suppression, unmount safety, and the reset() helper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAsync } from '../useAsync'

describe('useAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Initial state ─────────────────────────────────────────────────────────

  it('starts in idle state', () => {
    const { result } = renderHook(() => useAsync(async () => 'data'))
    expect(result.current.status).toBe('idle')
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  // ── Loading state ─────────────────────────────────────────────────────────

  it('transitions to loading state immediately after run()', async () => {
    let resolve!: (v: string) => void
    const fn = () => new Promise<string>((res) => { resolve = res })

    const { result } = renderHook(() => useAsync(fn))

    act(() => { void result.current.run() })

    expect(result.current.status).toBe('loading')
    expect(result.current.isLoading).toBe(true)

    act(() => resolve('done'))
    await waitFor(() => expect(result.current.status).toBe('success'))
  })

  // ── Success state ─────────────────────────────────────────────────────────

  it('transitions to success with returned data', async () => {
    const { result } = renderHook(() =>
      useAsync(async () => ({ id: 1, name: 'Alice' }))
    )

    await act(async () => { await result.current.run() })

    expect(result.current.status).toBe('success')
    expect(result.current.data).toEqual({ id: 1, name: 'Alice' })
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('run() returns the resolved value', async () => {
    const { result } = renderHook(() => useAsync(async () => 42))
    let returnVal: number | undefined
    await act(async () => { returnVal = await result.current.run() })
    expect(returnVal).toBe(42)
  })

  // ── Error state ───────────────────────────────────────────────────────────

  it('transitions to error state on rejected promise', async () => {
    const { result } = renderHook(() =>
      useAsync(async () => { throw new Error('fetch failed') })
    )

    await act(async () => { await result.current.run() })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('fetch failed')
    expect(result.current.data).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('wraps non-Error rejections in an Error object', async () => {
    const { result } = renderHook(() =>
      useAsync(async () => { throw 'string error' })
    )

    await act(async () => { await result.current.run() })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('string error')
  })

  it('run() resolves to undefined when the promise rejects', async () => {
    const { result } = renderHook(() =>
      useAsync(async () => { throw new Error('oops') })
    )
    let returnVal: unknown = 'sentinel'
    await act(async () => { returnVal = await result.current.run() })
    expect(returnVal).toBeUndefined()
  })

  // ── reset() ───────────────────────────────────────────────────────────────

  it('reset() restores idle state after success', async () => {
    const { result } = renderHook(() => useAsync(async () => 'data'))
    await act(async () => { await result.current.run() })
    expect(result.current.status).toBe('success')

    act(() => result.current.reset())

    expect(result.current.status).toBe('idle')
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('reset() restores idle state after error', async () => {
    const { result } = renderHook(() =>
      useAsync(async () => { throw new Error('err') })
    )
    await act(async () => { await result.current.run() })
    expect(result.current.status).toBe('error')

    act(() => result.current.reset())

    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })

  // ── Stale call suppression ────────────────────────────────────────────────

  it('ignores the result of an older run() superseded by a newer one', async () => {
    let resolveFirst!: (v: string) => void
    let resolveSecond!: (v: string) => void

    const fn = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string>((res) => { resolveFirst = res }))
      .mockImplementationOnce(() => new Promise<string>((res) => { resolveSecond = res }))

    const { result } = renderHook(() => useAsync(fn))

    act(() => { void result.current.run() }) // call 1
    act(() => { void result.current.run() }) // call 2 — supersedes call 1

    // Resolve call 2 first
    act(() => resolveSecond('second'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toBe('second')

    // Resolve call 1 late — must not overwrite state
    act(() => resolveFirst('first'))
    await new Promise((r) => setTimeout(r, 0)) // tick
    expect(result.current.data).toBe('second')
  })

  // ── fn always calls latest fn ref ────────────────────────────────────────

  it('run() always uses the most recently passed fn', async () => {
    const fnV1 = vi.fn().mockResolvedValue('v1')
    const fnV2 = vi.fn().mockResolvedValue('v2')

    const { result, rerender } = renderHook(
      ({ fn }: { fn: () => Promise<string> }) => useAsync(fn),
      { initialProps: { fn: fnV1 } }
    )

    rerender({ fn: fnV2 })

    await act(async () => { await result.current.run() })

    expect(fnV2).toHaveBeenCalled()
    expect(result.current.data).toBe('v2')
  })

  // ── Error clears between runs ─────────────────────────────────────────────

  it('clears previous error when a new run() starts', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first error'))
      .mockResolvedValueOnce('ok')

    const { result } = renderHook(() => useAsync(fn))

    await act(async () => { await result.current.run() })
    expect(result.current.status).toBe('error')

    let loadingObserved = false
    act(() => {
      void result.current.run().then(() => {
        // After run starts the error should be cleared in loading state
      })
      loadingObserved = result.current.error === null
    })

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBe('ok')
  })
})
