export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

/**
 * Upper bound (exclusive) for the extra-small tier. Screens narrower than
 * this value are considered "xs" (<360px) and need compact layouts.
 */
export const XS_MAX_WIDTH = 360

/**
 * Tablet tier boundaries. Tablets start at the `md` breakpoint (768px) and
 * end just below the `lg` breakpoint (1024px).
 */
export const TABLET_MIN_WIDTH = BREAKPOINTS.md
export const TABLET_MAX_WIDTH = BREAKPOINTS.lg

export type DeviceTier = 'xs' | 'mobile' | 'tablet' | 'desktop'

/**
 * Resolves the device tier for a given viewport width.
 * - `xs`: width < 360px (compact phones)
 * - `mobile`: 360px <= width < 768px
 * - `tablet`: 768px <= width < 1024px
 * - `desktop`: width >= 1024px
 */
export function getDeviceTier(width: number): DeviceTier {
  if (width < XS_MAX_WIDTH) return 'xs'
  if (width < TABLET_MIN_WIDTH) return 'mobile'
  if (width < TABLET_MAX_WIDTH) return 'tablet'
  return 'desktop'
}

/**
 * Returns true when the viewport is narrower than 360px.
 */
export function isXsViewport(width?: number): boolean {
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : undefined)
  if (w === undefined) return false
  return w < XS_MAX_WIDTH
}

/**
 * Returns true when the viewport falls within the tablet tier
 * (768px <= width < 1024px).
 */
export function isTabletViewport(width?: number): boolean {
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : undefined)
  if (w === undefined) return false
  return w >= TABLET_MIN_WIDTH && w < TABLET_MAX_WIDTH
}

export function getBreakpointValue(breakpoint: Breakpoint): number {
  return BREAKPOINTS[breakpoint]
}

export function getBreakpointPixels(breakpoint: Breakpoint): string {
  return `${getBreakpointValue(breakpoint)}px`
}

export function getBreakpointRem(breakpoint: Breakpoint): string {
  return `${getBreakpointValue(breakpoint) / 16}rem`
}

export function createMediaQuery(breakpoint: Breakpoint, direction: 'min' | 'max' = 'min'): string {
  const value = getBreakpointPixels(breakpoint)
  return `@media (${direction}-width: ${value})`
}

export function getResponsiveValue<T>(
  values: Partial<Record<Breakpoint, T>>,
  currentBreakpoint: Breakpoint
): T | undefined {
  return values[currentBreakpoint]
}

export function isMobileOnly(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < getBreakpointValue('md')
}

export function isTabletAndUp(): boolean {
  return typeof window !== 'undefined' && window.innerWidth >= getBreakpointValue('md')
}

export function isDesktopAndUp(): boolean {
  return typeof window !== 'undefined' && window.innerWidth >= getBreakpointValue('lg')
}

export function getCurrentBreakpoint(width?: number): Breakpoint {
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : undefined)
  if (w === undefined) return 'xs'

  if (w >= BREAKPOINTS['2xl']) return '2xl'
  if (w >= BREAKPOINTS.xl) return 'xl'
  if (w >= BREAKPOINTS.lg) return 'lg'
  if (w >= BREAKPOINTS.md) return 'md'
  if (w >= BREAKPOINTS.sm) return 'sm'
  return 'xs'
}

/**
 * Resolves the current device tier. Accepts an optional explicit width so it
 * can be used in tests and SSR contexts; falls back to `window.innerWidth`.
 */
export function getCurrentDeviceTier(width?: number): DeviceTier {
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : undefined)
  if (w === undefined) return 'xs'
  return getDeviceTier(w)
}
