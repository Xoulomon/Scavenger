/**
 * Issue #1299: Unit tests for useAppTitle hook.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAppTitle } from '../useAppTitle'

describe('useAppTitle', () => {
  afterEach(() => {
    document.title = ''
    vi.clearAllMocks()
  })

  it('sets document.title to the provided title on mount', () => {
    renderHook(() => useAppTitle('Scavenger – Dashboard'))
    expect(document.title).toBe('Scavenger – Dashboard')
  })

  it('updates document.title when the title prop changes', () => {
    const { rerender } = renderHook(({ title }: { title: string }) => useAppTitle(title), {
      initialProps: { title: 'Page A' },
    })
    expect(document.title).toBe('Page A')

    rerender({ title: 'Page B' })
    expect(document.title).toBe('Page B')
  })

  it('handles an empty string title', () => {
    renderHook(() => useAppTitle(''))
    expect(document.title).toBe('')
  })

  it('handles a long title string', () => {
    const longTitle = 'A'.repeat(300)
    renderHook(() => useAppTitle(longTitle))
    expect(document.title).toBe(longTitle)
  })

  it('handles special characters in title', () => {
    renderHook(() => useAppTitle('Status: 100% ✓ | Scavenger'))
    expect(document.title).toBe('Status: 100% ✓ | Scavenger')
  })

  it('updates when rerendered with a new title', () => {
    const { rerender } = renderHook(({ t }: { t: string }) => useAppTitle(t), {
      initialProps: { t: 'First' },
    })
    rerender({ t: 'Second' })
    rerender({ t: 'Third' })
    expect(document.title).toBe('Third')
  })
})
