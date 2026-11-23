/**
 * User preferences storage and management
 */

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: string
  notifications: {
    enabled: boolean
    email: boolean
    push: boolean
  }
  display: {
    compactView: boolean
    showMinimap: boolean
    animationsEnabled: boolean
  }
  accessibility: {
    highContrast: boolean
    reducedMotion: boolean
    fontSize: 'small' | 'medium' | 'large'
    keyboardNavigation: boolean
  }
  privacy: {
    shareLocation: boolean
    shareActivity: boolean
    publicProfile: boolean
  }
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  language: 'en',
  notifications: {
    enabled: true,
    email: true,
    push: false
  },
  display: {
    compactView: false,
    showMinimap: true,
    animationsEnabled: true
  },
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    fontSize: 'medium',
    keyboardNavigation: true
  },
  privacy: {
    shareLocation: true,
    shareActivity: true,
    publicProfile: false
  }
}

const STORAGE_KEY = 'userPreferences'

/**
 * Get user preferences from storage
 */
export function getUserPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFERENCES
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

/**
 * Save user preferences to storage
 */
export function saveUserPreferences(preferences: Partial<UserPreferences>): void {
  try {
    const current = getUserPreferences()
    const updated = { ...current, ...preferences }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to save preferences:', error)
  }
}

/**
 * Reset preferences to defaults
 */
export function resetUserPreferences(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Export preferences as JSON
 */
export function exportPreferences(): string {
  const preferences = getUserPreferences()
  return JSON.stringify(preferences, null, 2)
}

/**
 * Import preferences from JSON
 */
export function importPreferences(json: string): boolean {
  try {
    const preferences = JSON.parse(json)
    saveUserPreferences(preferences)
    return true
  } catch {
    return false
  }
}
