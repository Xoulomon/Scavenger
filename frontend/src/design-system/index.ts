/**
 * Design System — public export surface
 *
 * Usage:
 *   import tokens from '@/design-system'
 *   import { colors, spacing, cssVar } from '@/design-system'
 */

export {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  semanticTokens,
  tokens as default
} from './tokens'

// ── Components ────────────────────────────────────────────────────────────────
// These components are memoized (React.memo) to avoid unnecessary re-renders
// of expensive list rows and badges. The public export surface is unchanged;
// consumers receive the memoized versions transparently.

export { StatusBadge } from './StatusBadge'
export { TierBadge } from './TierBadge'
export { LeaderboardRow } from './LeaderboardRow'
export { LoadingState } from './LoadingState'
export type { LoadingStateProps } from './LoadingState'
export { EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read a CSS custom property value at runtime.
 * Useful for passing theme-aware values to canvas/chart libraries.
 *
 * @example
 * const bg = cssVar('--background') // 'hsl(0 0% 100%)'
 */
export function cssVar(name: string, element: Element = document.documentElement): string {
  return getComputedStyle(element).getPropertyValue(name).trim()
}

/**
 * Resolve a semantic color to its current `hsl(…)` string.
 *
 * @example
 * const primary = semanticColor('primary') // 'hsl(142 76% 36%)'
 */
export function semanticColor(token: string): string {
  const raw = cssVar(`--${token}`)
  return raw ? `hsl(${raw})` : ''
}
