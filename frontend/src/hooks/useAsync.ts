import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Lifecycle status shared with the transaction-status module so async state
 * (including polling hooks) can be mapped onto the same pending/success/failed
 * UI without translation layers.
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  status: AsyncStatus
  data: T | null
  error: Error | null
  isLoading: boolean
}

export interface UseAsyncReturn<T, Args extends unknown[]> extends AsyncState<T> {
  run: (...args: Args) => Promise<T | undefined>
  reset: () => void
}

/**
 * Manages the lifecycle of an on-demand async operation (loading / error /
 * success) so pages don't hand-roll `isLoading` + `error` state for every
 * action. The wrapped function is only invoked when `run` is called.
 *
 * Contract:
 * - Input: `fn` is the async operation. It is read through a ref, so passing a
 *   new `fn` identity on every render does not invalidate `run`/`reset`.
 * - Output: `{ status, data, error, isLoading, run, reset }`. `isLoading` is
 *   derived from `status === 'loading'` and is always consistent with it.
 * - `run(...args)` sets `status` to `'loading'` (clearing `error`), then
 *   resolves to the operation's value on success (`status: 'success'`) or to
 *   `undefined` on failure (`status: 'error'`, error exposed via `error`).
 * - `reset()` returns to the initial `idle` state and invalidates in-flight
 *   calls.
 *
 * Stale-response semantics: only the most recent `run` call may update state;
 * completions from superseded calls are ignored. Unmount semantics: state is
 * never updated after unmount (no "setState on unmounted component" warnings).
 *
 * @deprecated For **server state** (fetching data from the API) use TanStack
 * Query instead — see `frontend/src/lib/queryClient.ts` and the hooks in
 * `frontend/src/hooks/queries/`. Query provides caching, retries,
 * invalidation and request de-duplication out of the box.
 *
 * This hook remains supported only for **non-server, imperative side effects**
 * (e.g. submitting a form, triggering a one-off mutation-like action) where
 * there is no cacheable resource to key on. Do not use it to read API data.
 *
 * Prefer the consolidated generic async hook exported from
 * `frontend/src/hooks` (see `useAsyncOperation`). This hook remains as a thin
 * backwards-compatible re-export with identical behaviour; existing imports
 * keep working and will be migrated incrementally.
 */
export function useAsync<T, Args extends unknown[] = []>(
  fn: (...args: Args) => Promise<T>
): UseAsyncReturn<T, Args> {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      '[useAsync] Deprecated for server state. Use TanStack Query ' +
        '(hooks/queries) for API reads; reserve useAsync for imperative, ' +
        'non-cacheable actions.'
    )
  }
  const [state, setState] = useState<Omit<AsyncState<T>, 'isLoading'>>({
    status: 'idle',
    data: null,
    error: null
  })

  // Always call the latest fn without invalidating `run`'s identity
  const fnRef = useRef(fn)
  fnRef.current = fn

  const mountedRef = useRef(true)
  const callIdRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Backwards-compatibility: `status` values are unchanged ('idle' | 'loading'
  // | 'success' | 'error') and `isLoading` is still derived from `status`, so
  // existing callers keep working. New consumers (e.g. the transaction-status
  // polling hook) can map `status` directly onto pending/success/failed.

  const run = useCallback(async (...args: Args): Promise<T | undefined> => {
    const callId = ++callIdRef.current
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    try {
      const data = await fnRef.current(...args)
      if (mountedRef.current && callId === callIdRef.current) {
        setState({ status: 'success', data, error: null })
      }
      return data
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (mountedRef.current && callId === callIdRef.current) {
        setState((prev) => ({ ...prev, status: 'error', error }))
      }
      return undefined
    }
  }, [])

  const reset = useCallback(() => {
    callIdRef.current++
    setState({ status: 'idle', data: null, error: null })
  }, [])

  // No console.* calls or commented-out code here: failures are surfaced via
  // `error` in the returned state for callers to render.

  return { ...state, isLoading: state.status === 'loading', run, reset }
}

/**
 * Backwards-compatible alias for the consolidated generic async hook.
 * @deprecated Use `useAsync` (or the consolidated `useAsyncOperation`).
 */
export const useAsyncOperation = useAsync
