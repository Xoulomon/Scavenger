import { useState, useEffect, useCallback } from 'react'
import {
  getUserPreferences,
  saveUserPreferences,
  resetUserPreferences,
  exportPreferences,
  importPreferences,
  type UserPreferences
} from '../lib/userPreferences'

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(getUserPreferences())

  useEffect(() => {
    const stored = getUserPreferences()
    setPreferences(stored)
  }, [])

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    saveUserPreferences(updates)
    setPreferences(getUserPreferences())
  }, [])

  const reset = useCallback(() => {
    resetUserPreferences()
    setPreferences(getUserPreferences())
  }, [])

  const exportToJson = useCallback(() => {
    return exportPreferences()
  }, [])

  const importFromJson = useCallback((json: string) => {
    const success = importPreferences(json)
    if (success) {
      setPreferences(getUserPreferences())
    }
    return success
  }, [])

  return {
    preferences,
    updatePreferences,
    reset,
    exportToJson,
    importFromJson
  }
}
