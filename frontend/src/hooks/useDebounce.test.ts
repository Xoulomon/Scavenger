import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDebounce } from './useSearch'

describe('useDebounce hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('returns initial value immediately on first render', () => {
    const { result } = renderHook(() => useDebounce('test', 500))
    expect(result.current).toBe('test')
  })

  it('delays updates by specified delay time', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    expect(result.current).toBe('initial')

    rerender({ value: 'updated', delay: 500 })
    expect(result.current).toBe('initial')

    vi.advanceTimersByTime(499)
    expect(result.current).toBe('initial')

    vi.advanceTimersByTime(1)
    expect(result.current).toBe('updated')
  })

  it('resets timer when value changes before delay completes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 500 } }
    )

    rerender({ value: 'second', delay: 500 })
    vi.advanceTimersByTime(300)

    rerender({ value: 'third', delay: 500 })
    vi.advanceTimersByTime(300)

    expect(result.current).toBe('first')

    vi.advanceTimersByTime(200)
    expect(result.current).toBe('third')
  })

  it('works with different delay times', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 1000 } }
    )

    rerender({ value: 'updated', delay: 1000 })
    vi.advanceTimersByTime(1000)
    expect(result.current).toBe('updated')

    rerender({ value: 'next', delay: 300 })
    vi.advanceTimersByTime(300)
    expect(result.current).toBe('next')
  })

  it('debounces multiple rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: '', delay: 500 } }
    )

    rerender({ value: 'a', delay: 500 })
    rerender({ value: 'ab', delay: 500 })
    rerender({ value: 'abc', delay: 500 })
    rerender({ value: 'abcd', delay: 500 })

    expect(result.current).toBe('')
    vi.advanceTimersByTime(500)
    expect(result.current).toBe('abcd')
  })

  it('works with string values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'search term', delay: 300 } }
    )

    expect(result.current).toBe('search term')

    rerender({ value: 'new search', delay: 300 })
    vi.advanceTimersByTime(300)
    expect(result.current).toBe('new search')
  })

  it('works with number values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 200 } }
    )

    expect(result.current).toBe(0)

    rerender({ value: 100, delay: 200 })
    vi.advanceTimersByTime(200)
    expect(result.current).toBe(100)
  })

  it('works with boolean values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: false, delay: 250 } }
    )

    expect(result.current).toBe(false)

    rerender({ value: true, delay: 250 })
    vi.advanceTimersByTime(250)
    expect(result.current).toBe(true)
  })

  it('works with object values', () => {
    const obj1 = { query: 'test' }
    const obj2 = { query: 'updated' }

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: obj1, delay: 400 } }
    )

    expect(result.current).toBe(obj1)

    rerender({ value: obj2, delay: 400 })
    vi.advanceTimersByTime(400)
    expect(result.current).toBe(obj2)
  })

  it('works with array values', () => {
    const arr1 = ['a', 'b']
    const arr2 = ['x', 'y', 'z']

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: arr1, delay: 350 } }
    )

    expect(result.current).toBe(arr1)

    rerender({ value: arr2, delay: 350 })
    vi.advanceTimersByTime(350)
    expect(result.current).toBe(arr2)
  })

  it('handles zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 0 } }
    )

    rerender({ value: 'updated', delay: 0 })
    vi.advanceTimersByTime(0)
    expect(result.current).toBe('updated')
  })

  it('cleans up timer on unmount', () => {
    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'test', delay: 500 } }
    )

    rerender({ value: 'updated', delay: 500 })
    unmount()

    vi.advanceTimersByTime(500)
  })

  it('maintains debounce across multiple re-renders', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 200 } }
    )

    for (let i = 0; i < 5; i++) {
      rerender({ value: `value${i}`, delay: 200 })
      vi.advanceTimersByTime(100)
    }

    expect(result.current).toBe('a')
    vi.advanceTimersByTime(100)
    expect(result.current).toBe('value4')
  })

  it('handles null values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: null, delay: 300 } }
    )

    expect(result.current).toBe(null)

    rerender({ value: 'not null', delay: 300 })
    vi.advanceTimersByTime(300)
    expect(result.current).toBe('not null')
  })

  it('handles undefined values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: undefined, delay: 250 } }
    )

    expect(result.current).toBe(undefined)

    rerender({ value: 'defined', delay: 250 })
    vi.advanceTimersByTime(250)
    expect(result.current).toBe('defined')
  })

  it('supports changing delay time between renders', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'test', delay: 500 } }
    )

    rerender({ value: 'updated', delay: 1000 })
    vi.advanceTimersByTime(500)
    expect(result.current).toBe('test')

    vi.advanceTimersByTime(500)
    expect(result.current).toBe('updated')
  })

  it('debounces search input efficiently', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: '', delay: 300 } }
    )

    const searchTerms = ['p', 'py', 'pyt', 'pyth', 'pytho', 'python']
    for (const term of searchTerms) {
      rerender({ value: term, delay: 300 })
      vi.advanceTimersByTime(100)
    }

    expect(result.current).toBe('')
    vi.advanceTimersByTime(200)
    expect(result.current).toBe('python')
  })

  it('debounces filter changes efficiently', () => {
    const filter1 = { type: 'all', status: 'active' }
    const filter2 = { type: 'paper', status: 'active' }
    const filter3 = { type: 'paper', status: 'completed' }

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: filter1, delay: 500 } }
    )

    rerender({ value: filter2, delay: 500 })
    vi.advanceTimersByTime(250)
    rerender({ value: filter3, delay: 500 })
    vi.advanceTimersByTime(500)

    expect(result.current).toBe(filter3)
  })
})
