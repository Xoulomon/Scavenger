/**
 * Feature Flag System
 * Supports gradual rollouts, A/B testing, and environment-specific flags.
 * Flags are persisted in localStorage with remote override support.
 *
 * FLAG LIFECYCLE:
 * 1. Add: Create new flag with rolloutPercentage=0 and environments=['development']
 * 2. Test: Increase rolloutPercentage gradually in development/staging
 * 3. Ship: Set rolloutPercentage=100 when fully stable and ready for production
 * 4. Retire: Remove flag and all UI branches gated by it after shipping (typically after 1-2 releases)
 *
 * To add a new flag:
 *   - Define in FLAGS object below with rolloutPercentage: 0 initially
 *   - Use useFlag(flagKey) in components to gate the feature
 *   - Run tests: npm test
 *
 * To ship a flag:
 *   - Remove rolloutPercentage limits (set to 100 or undefined)
 *   - Ensure UI branches are present
 *   - Deploy and monitor metrics
 *
 * To retire a flag:
 *   - Remove all useFlag() checks and branches from UI
 *   - Remove flag definition from FLAGS
 *   - Run tests to ensure no references remain
 */

export type FlagValue = boolean | string | number
export type FlagEnvironment = 'development' | 'staging' | 'production' | 'all'

export interface FeatureFlag {
  key: string
  description: string
  defaultValue: FlagValue
  /** Percentage of users (0-100) who get this flag enabled */
  rolloutPercentage?: number
  environments?: FlagEnvironment[]
  /** Optional analytics tracking ID */
  analyticsId?: string
}

export interface FlagOverride {
  key: string
  value: FlagValue
  expiresAt?: number // unix timestamp
}

export interface FlagAnalyticsEvent {
  flagKey: string
  value: FlagValue
  timestamp: number
  userId?: string
}

// ─── Built-in flag definitions ───────────────────────────────────────────────

export const FLAGS: Record<string, FeatureFlag> = {
  healthDashboard: {
    key: 'healthDashboard',
    description: 'Platform health & status dashboard',
    defaultValue: true,
    environments: ['all'],
    analyticsId: 'flag_health_dashboard',
  },
  performanceSLAs: {
    key: 'performanceSLAs',
    description: 'Performance SLA monitoring and reporting',
    defaultValue: true,
    environments: ['all'],
    analyticsId: 'flag_performance_slas',
  },
  multiLanguageSupport: {
    key: 'multiLanguageSupport',
    description: 'Full multi-language (i18n) support',
    defaultValue: true,
    environments: ['all'],
    analyticsId: 'flag_i18n',
  },
}

// ─── Storage key ─────────────────────────────────────────────────────────────

const OVERRIDES_KEY = 'scavngr_flag_overrides'
const ANALYTICS_KEY = 'scavngr_flag_analytics'

// ─── Environment detection ────────────────────────────────────────────────────

function getCurrentEnvironment(): FlagEnvironment {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (host === 'localhost' || host === '127.0.0.1') return 'development'
  if (host.includes('staging')) return 'staging'
  return 'production'
}

// ─── Rollout evaluation ───────────────────────────────────────────────────────

function isInRollout(percentage: number, userId?: string): boolean {
  if (percentage >= 100) return true
  if (percentage <= 0) return false
  // Deterministic hash of userId for consistent rollout
  const seed = userId ?? localStorage.getItem('scavngr_user_id') ?? 'anonymous'
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return (hash % 100) < percentage
}

// ─── Core evaluation ─────────────────────────────────────────────────────────

export function evaluateFlag(flagKey: string, userId?: string): FlagValue {
  const flag = FLAGS[flagKey]
  if (!flag) return false

  // Check environment
  const env = getCurrentEnvironment()
  if (flag.environments && !flag.environments.includes('all') && !flag.environments.includes(env)) {
    return false
  }

  // Check for user override
  const overrides = getOverrides()
  const override = overrides.find((o) => o.key === flagKey)
  if (override) {
    if (override.expiresAt && Date.now() > override.expiresAt) {
      // Expired override – remove it
      setOverrides(overrides.filter((o) => o.key !== flagKey))
    } else {
      return override.value
    }
  }

  // Rollout check
  if (flag.rolloutPercentage !== undefined) {
    return isInRollout(flag.rolloutPercentage, userId) ? flag.defaultValue : false
  }

  return flag.defaultValue
}

export function isEnabled(flagKey: string, userId?: string): boolean {
  return Boolean(evaluateFlag(flagKey, userId))
}

// ─── Override management ──────────────────────────────────────────────────────

function getOverrides(): FlagOverride[] {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '[]')
  } catch {
    return []
  }
}

function setOverrides(overrides: FlagOverride[]): void {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
}

export function setFlagOverride(key: string, value: FlagValue, ttlMs?: number): void {
  const overrides = getOverrides().filter((o) => o.key !== key)
  overrides.push({ key, value, expiresAt: ttlMs ? Date.now() + ttlMs : undefined })
  setOverrides(overrides)
  trackFlagEvaluation(key, value)
}

export function clearFlagOverride(key: string): void {
  setOverrides(getOverrides().filter((o) => o.key !== key))
}

export function clearAllOverrides(): void {
  localStorage.removeItem(OVERRIDES_KEY)
}

export function getAllFlagOverrides(): FlagOverride[] {
  return getOverrides().filter((o) => !o.expiresAt || Date.now() <= o.expiresAt)
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function trackFlagEvaluation(flagKey: string, value: FlagValue): void {
  try {
    const events: FlagAnalyticsEvent[] = JSON.parse(
      localStorage.getItem(ANALYTICS_KEY) ?? '[]'
    )
    events.push({ flagKey, value, timestamp: Date.now() })
    // Keep only the last 500 events
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-500)))
  } catch {
    // non-critical
  }
}

export function getFlagAnalytics(): FlagAnalyticsEvent[] {
  try {
    return JSON.parse(localStorage.getItem(ANALYTICS_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function clearFlagAnalytics(): void {
  localStorage.removeItem(ANALYTICS_KEY)
}

// ─── Snapshot of all current values ──────────────────────────────────────────

export function getAllFlagValues(userId?: string): Record<string, FlagValue> {
  return Object.fromEntries(
    Object.keys(FLAGS).map((key) => [key, evaluateFlag(key, userId)])
  )
}
