import { useState, useEffect, useCallback } from 'react'
import {
  evaluateFlag,
  isEnabled,
  setFlagOverride,
  clearFlagOverride,
  clearAllOverrides,
  getAllFlagValues,
  getAllFlagOverrides,
  FLAGS,
  type FlagValue,
  type FlagOverride
} from '@/lib/featureFlags'

/** Returns the evaluated value of a single flag, re-renders on storage change. */
export function useFeatureFlag(flagKey: string): FlagValue {
  const [value, setValue] = useState<FlagValue>(() => evaluateFlag(flagKey))

  useEffect(() => {
    const handler = () => setValue(evaluateFlag(flagKey))
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [flagKey])

  return value
}

/** Returns true/false for a boolean flag. */
export function useFlag(flagKey: string): boolean {
  return Boolean(useFeatureFlag(flagKey))
}

/** Returns all flags, their current values, and management helpers. */
export function useFeatureFlags() {
  const [values, setValues] = useState<Record<string, FlagValue>>(() => getAllFlagValues())
  const [overrides, setOverrides] = useState<FlagOverride[]>(() => getAllFlagOverrides())

  const refresh = useCallback(() => {
    setValues(getAllFlagValues())
    setOverrides(getAllFlagOverrides())
  }, [])

  useEffect(() => {
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [refresh])

  const override = useCallback(
    (key: string, value: FlagValue, ttlMs?: number) => {
      setFlagOverride(key, value, ttlMs)
      refresh()
    },
    [refresh]
  )

  const clearOverride = useCallback(
    (key: string) => {
      clearFlagOverride(key)
      refresh()
    },
    [refresh]
  )

  const clearAll = useCallback(() => {
    clearAllOverrides()
    refresh()
  }, [refresh])

  return {
    flags: FLAGS,
    values,
    overrides,
    isEnabled: (key: string) => isEnabled(key),
    override,
    clearOverride,
    clearAll,
    refresh
  }
}
