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
  tokens as default,
} from './tokens'

// ── Components ────────────────────────────────────────────────────────────────

export { StatusBadge } from './StatusBadge'
export { TierBadge } from './TierBadge'
export { LeaderboardRow } from './LeaderboardRow'

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
