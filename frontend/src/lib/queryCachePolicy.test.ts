import { describe, it, expect } from 'vitest'
import { queryCachePolicy, DEFAULT_GC_TIME, DEFAULT_STALE_TIME } from './queryCachePolicy'

describe('queryCachePolicy', () => {
  it('uses a 5 minute stale time and a 24 hour gc time', () => {
    expect(queryCachePolicy.staleTime).toBe(5 * 60 * 1000)
    expect(queryCachePolicy.gcTime).toBe(24 * 60 * 60 * 1000)
  })

  it('exposes the same timings as named constants', () => {
    expect(DEFAULT_STALE_TIME).toBe(queryCachePolicy.staleTime)
    expect(DEFAULT_GC_TIME).toBe(queryCachePolicy.gcTime)
  })

  it('disables refetch on focus and retries once', () => {
    expect(queryCachePolicy.refetchOnWindowFocus).toBe(false)
    expect(queryCachePolicy.retry).toBe(1)
  })
})
