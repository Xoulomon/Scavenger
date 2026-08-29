import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  evaluateFlag,
  isEnabled,
  setFlagOverride,
  clearFlagOverride,
  clearAllOverrides,
  getAllFlagValues,
  getAllFlagOverrides,
  getFlagAnalytics,
  clearFlagAnalytics,
  FLAGS,
} from '@/lib/featureFlags'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })
Object.defineProperty(globalThis, 'window', { value: { location: { hostname: 'localhost' } }, writable: true })

describe('featureFlags', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('evaluates a flag with defaultValue=true', () => {
    expect(evaluateFlag('healthDashboard')).toBe(true)
  })

  it('evaluates a flag with defaultValue=true', () => {
    expect(evaluateFlag('multiLanguageSupport')).toBe(true)
  })

  it('returns false for unknown flag', () => {
    expect(evaluateFlag('unknownFlag')).toBe(false)
  })

  it('isEnabled wraps evaluateFlag as boolean', () => {
    expect(isEnabled('healthDashboard')).toBe(true)
    expect(isEnabled('unknownFlag')).toBe(false)
  })

  it('setFlagOverride overrides default value', () => {
    setFlagOverride('performanceSLAs', false)
    expect(isEnabled('performanceSLAs')).toBe(false)
  })

  it('clearFlagOverride restores default', () => {
    setFlagOverride('performanceSLAs', false)
    clearFlagOverride('performanceSLAs')
    expect(isEnabled('performanceSLAs')).toBe(true)
  })

  it('clearAllOverrides removes all overrides', () => {
    setFlagOverride('healthDashboard', false)
    setFlagOverride('multiLanguageSupport', false)
    clearAllOverrides()
    expect(getAllFlagOverrides()).toHaveLength(0)
  })

  it('expired overrides are ignored', () => {
    setFlagOverride('performanceSLAs', false, -1000) // already expired
    expect(isEnabled('performanceSLAs')).toBe(true)
  })

  it('getAllFlagValues returns all flags', () => {
    const all = getAllFlagValues()
    expect(Object.keys(all)).toEqual(expect.arrayContaining(Object.keys(FLAGS)))
  })

  it('setFlagOverride records analytics event', () => {
    clearFlagAnalytics()
    setFlagOverride('multiLanguageSupport', false)
    const events = getFlagAnalytics()
    expect(events.some((e) => e.flagKey === 'multiLanguageSupport' && e.value === false)).toBe(true)
  })

  it('getAllFlagOverrides lists active overrides', () => {
    setFlagOverride('healthDashboard', false)
    const overrides = getAllFlagOverrides()
    expect(overrides.some((o) => o.key === 'healthDashboard')).toBe(true)
  })
})
