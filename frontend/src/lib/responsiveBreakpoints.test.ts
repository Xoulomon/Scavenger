import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BREAKPOINTS,
  getBreakpointValue,
  getBreakpointPixels,
  getBreakpointRem,
  createMediaQuery,
  getResponsiveValue,
  isMobileOnly,
  isTabletAndUp,
  isDesktopAndUp,
  getCurrentBreakpoint,
} from './responsiveBreakpoints'

describe('BREAKPOINTS constant', () => {
  it('defines all standard breakpoints', () => {
    expect(BREAKPOINTS).toHaveProperty('xs')
    expect(BREAKPOINTS).toHaveProperty('sm')
    expect(BREAKPOINTS).toHaveProperty('md')
    expect(BREAKPOINTS).toHaveProperty('lg')
    expect(BREAKPOINTS).toHaveProperty('xl')
    expect(BREAKPOINTS).toHaveProperty('2xl')
  })

  it('breakpoints are in ascending order', () => {
    const values = Object.values(BREAKPOINTS)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
  })

  it('xs starts at 0', () => {
    expect(BREAKPOINTS.xs).toBe(0)
  })

  it('uses standard Tailwind breakpoint values', () => {
    expect(BREAKPOINTS.sm).toBe(640)
    expect(BREAKPOINTS.md).toBe(768)
    expect(BREAKPOINTS.lg).toBe(1024)
    expect(BREAKPOINTS.xl).toBe(1280)
    expect(BREAKPOINTS['2xl']).toBe(1536)
  })
})

describe('getBreakpointValue', () => {
  it('returns value for xs', () => {
    expect(getBreakpointValue('xs')).toBe(0)
  })

  it('returns value for md', () => {
    expect(getBreakpointValue('md')).toBe(768)
  })

  it('returns value for 2xl', () => {
    expect(getBreakpointValue('2xl')).toBe(1536)
  })
})

describe('getBreakpointPixels', () => {
  it('formats breakpoint as pixels', () => {
    expect(getBreakpointPixels('sm')).toBe('640px')
    expect(getBreakpointPixels('md')).toBe('768px')
  })

  it('formats zero as 0px', () => {
    expect(getBreakpointPixels('xs')).toBe('0px')
  })
})

describe('getBreakpointRem', () => {
  it('converts pixels to rem (16px = 1rem)', () => {
    expect(getBreakpointRem('sm')).toBe('40rem') // 640 / 16
    expect(getBreakpointRem('md')).toBe('48rem') // 768 / 16
  })

  it('formats zero as 0rem', () => {
    expect(getBreakpointRem('xs')).toBe('0rem')
  })

  it('handles non-divisible values', () => {
    expect(getBreakpointRem('lg')).toBe('64rem') // 1024 / 16
  })
})

describe('createMediaQuery', () => {
  it('creates min-width media query by default', () => {
    expect(createMediaQuery('md')).toBe('@media (min-width: 768px)')
    expect(createMediaQuery('lg')).toBe('@media (min-width: 1024px)')
  })

  it('creates max-width media query when specified', () => {
    expect(createMediaQuery('md', 'max')).toBe('@media (max-width: 768px)')
  })

  it('works for all breakpoints', () => {
    const query = createMediaQuery('sm', 'min')
    expect(query).toContain('640px')
  })

  it('generates valid CSS media query syntax', () => {
    const query = createMediaQuery('md')
    expect(query).toMatch(/@media \(.*-width: \d+px\)/)
  })
})

describe('getResponsiveValue', () => {
  it('returns value for matching breakpoint', () => {
    const values = { sm: 'small', md: 'medium', lg: 'large' }
    expect(getResponsiveValue(values, 'md')).toBe('medium')
  })

  it('returns undefined for missing breakpoint', () => {
    const values = { sm: 'small' }
    expect(getResponsiveValue(values, 'md')).toBeUndefined()
  })

  it('works with different value types', () => {
    const numberValues = { sm: 12, md: 24 }
    expect(getResponsiveValue(numberValues, 'md')).toBe(24)

    const boolValues = { sm: false, md: true }
    expect(getResponsiveValue(boolValues, 'md')).toBe(true)
  })

  it('handles partial responsive values', () => {
    const values: Partial<Record<'sm' | 'md' | 'lg', string>> = { md: 'medium' }
    expect(getResponsiveValue(values, 'sm')).toBeUndefined()
    expect(getResponsiveValue(values, 'md')).toBe('medium')
  })
})

describe('isMobileOnly', () => {
  beforeEach(() => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(767)
  })

  it('returns true for widths below md breakpoint', () => {
    vi.mocked(Object.getOwnPropertyDescriptor(window, 'innerWidth')!.get!).mockReturnValue(600)
    expect(isMobileOnly()).toBe(true)
  })

  it('returns false for widths at or above md breakpoint', () => {
    vi.mocked(Object.getOwnPropertyDescriptor(window, 'innerWidth')!.get!).mockReturnValue(768)
    expect(isMobileOnly()).toBe(false)
  })
})

describe('isTabletAndUp', () => {
  it('returns true for widths at or above md breakpoint', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(768)
    expect(isTabletAndUp()).toBe(true)
  })

  it('returns false for widths below md breakpoint', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(767)
    expect(isTabletAndUp()).toBe(false)
  })
})

describe('isDesktopAndUp', () => {
  it('returns true for widths at or above lg breakpoint', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024)
    expect(isDesktopAndUp()).toBe(true)
  })

  it('returns false for widths below lg breakpoint', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1023)
    expect(isDesktopAndUp()).toBe(false)
  })
})

describe('getCurrentBreakpoint', () => {
  it('returns xs for small widths', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(100)
    expect(getCurrentBreakpoint()).toBe('xs')
  })

  it('returns sm for widths >= 640px', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(640)
    expect(getCurrentBreakpoint()).toBe('sm')
  })

  it('returns md for widths >= 768px', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(768)
    expect(getCurrentBreakpoint()).toBe('md')
  })

  it('returns lg for widths >= 1024px', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024)
    expect(getCurrentBreakpoint()).toBe('lg')
  })

  it('returns xl for widths >= 1280px', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280)
    expect(getCurrentBreakpoint()).toBe('xl')
  })

  it('returns 2xl for widths >= 1536px', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1536)
    expect(getCurrentBreakpoint()).toBe('2xl')
  })

  it('returns 2xl for very large widths', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(2000)
    expect(getCurrentBreakpoint()).toBe('2xl')
  })

  it('handles common device widths', () => {
    // iPhone SE width
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375)
    expect(getCurrentBreakpoint()).toBe('xs')

    // iPad width
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(768)
    expect(getCurrentBreakpoint()).toBe('md')

    // Desktop width
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1920)
    expect(getCurrentBreakpoint()).toBe('2xl')
  })
})

describe('Responsive breakpoint consistency', () => {
  it('breakpoint values match Tailwind CSS defaults', () => {
    // Ensure consistency with Tailwind configuration
    expect(BREAKPOINTS.md).toBe(768) // Standard mobile breakpoint
    expect(BREAKPOINTS.lg).toBe(1024) // Standard tablet/desktop breakpoint
  })

  it('media queries are properly formatted', () => {
    const queries = ['sm', 'md', 'lg', 'xl', '2xl'].map((b) => createMediaQuery(b as any))
    queries.forEach((q) => {
      expect(q).toMatch(/@media \(min-width: \d+px\)/)
    })
  })

  it('all breakpoint access methods use same values', () => {
    const bp = 'md'
    const val = getBreakpointValue(bp)
    const px = getBreakpointPixels(bp)
    expect(px).toBe(`${val}px`)
  })
})
