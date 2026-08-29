import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAdminTabs } from '../useAdminTabs'

describe('useAdminTabs', () => {
  it('defaults to overview tab and filters non-admin tabs for regular users', () => {
    const { result } = renderHook(() => useAdminTabs({ isAdmin: false }))
    expect(result.current.activeTab).toBe('overview')
    expect(result.current.visibleTabs.some((t) => t.id === 'config')).toBe(false)
  })

  it('includes config tab when isAdmin is true', () => {
    const { result } = renderHook(() => useAdminTabs({ isAdmin: true }))
    expect(result.current.visibleTabs.some((t) => t.id === 'config')).toBe(true)
  })

  it('allows changing active tab', () => {
    const { result } = renderHook(() => useAdminTabs({ isAdmin: true }))
    act(() => {
      result.current.setActiveTab('wastes')
    })
    expect(result.current.activeTab).toBe('wastes')
  })
})
