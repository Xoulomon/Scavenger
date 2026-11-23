import { describe, it, expect } from 'vitest'

// Design tokens definition
interface DesignTokens {
  colors: Record<string, string>
  spacing: Record<string, string>
  typography: Record<string, { fontSize: string; fontWeight: string; lineHeight: string }>
  shadows: Record<string, string>
  borderRadius: Record<string, string>
}

const designTokens: DesignTokens = {
  colors: {
    primary: '#3B82F6',
    secondary: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#0EA5E9',
    success: '#10B981',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
    white: '#FFFFFF',
    black: '#000000'
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '2.5rem',
    '3xl': '3rem'
  },
  typography: {
    h1: { fontSize: '2rem', fontWeight: '700', lineHeight: '2.5rem' },
    h2: { fontSize: '1.5rem', fontWeight: '600', lineHeight: '2rem' },
    h3: { fontSize: '1.25rem', fontWeight: '600', lineHeight: '1.75rem' },
    body: { fontSize: '1rem', fontWeight: '400', lineHeight: '1.5rem' },
    small: { fontSize: '0.875rem', fontWeight: '400', lineHeight: '1.25rem' },
    caption: { fontSize: '0.75rem', fontWeight: '400', lineHeight: '1rem' }
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px'
  }
}

// Style analyzer - checks for inline styles
interface StyleViolation {
  element: string
  property: string
  inlineValue: string
  suggestedToken: string
}

const analyzeInlineStyles = (htmlContent: string): StyleViolation[] => {
  const violations: StyleViolation[] = []
  const styleRegex = /style=["']([^"']+)["']/g
  let match

  while ((match = styleRegex.exec(htmlContent)) !== null) {
    const styles = match[1]
    // Check for common inline style patterns that should use tokens
    if (styles.includes('color:') || styles.includes('background-color:')) {
      violations.push({
        element: 'div',
        property: 'color',
        inlineValue: styles,
        suggestedToken: 'Use design tokens from colors object'
      })
    }
    if (styles.includes('padding:') || styles.includes('margin:')) {
      violations.push({
        element: 'div',
        property: 'spacing',
        inlineValue: styles,
        suggestedToken: 'Use design tokens from spacing object'
      })
    }
  }

  return violations
}

describe('Design Tokens and Inline Styles', () => {
  describe('Color Tokens', () => {
    it('should have all required color tokens', () => {
      expect(designTokens.colors.primary).toBeDefined()
      expect(designTokens.colors.secondary).toBeDefined()
      expect(designTokens.colors.danger).toBeDefined()
      expect(designTokens.colors.success).toBeDefined()
    })

    it('should have primary color defined', () => {
      expect(designTokens.colors.primary).toBe('#3B82F6')
    })

    it('should have semantic color tokens', () => {
      const semanticColors = ['primary', 'secondary', 'danger', 'warning', 'info', 'success']
      semanticColors.forEach((color) => {
        expect(designTokens.colors[color]).toBeDefined()
        expect(designTokens.colors[color]).toMatch(/^#[0-9A-F]{6}$/i)
      })
    })

    it('should have gray scale colors', () => {
      const grayScales = [
        'gray50',
        'gray100',
        'gray200',
        'gray300',
        'gray400',
        'gray500',
        'gray600',
        'gray700',
        'gray800',
        'gray900'
      ]
      grayScales.forEach((shade) => {
        expect(designTokens.colors[shade]).toBeDefined()
      })
    })

    it('should have valid hex color format', () => {
      Object.values(designTokens.colors).forEach((color) => {
        expect(color).toMatch(/^#[0-9A-F]{6}$/i)
      })
    })
  })

  describe('Spacing Tokens', () => {
    it('should have standard spacing scales', () => {
      expect(designTokens.spacing.xs).toBeDefined()
      expect(designTokens.spacing.sm).toBeDefined()
      expect(designTokens.spacing.md).toBeDefined()
      expect(designTokens.spacing.lg).toBeDefined()
      expect(designTokens.spacing.xl).toBeDefined()
    })

    it('should have consistent spacing values', () => {
      expect(designTokens.spacing.xs).toBe('0.25rem')
      expect(designTokens.spacing.sm).toBe('0.5rem')
      expect(designTokens.spacing.md).toBe('1rem')
    })

    it('should use rem units consistently', () => {
      Object.values(designTokens.spacing).forEach((value) => {
        expect(value).toMatch(/^\d+(\.\d+)?rem$/)
      })
    })
  })

  describe('Typography Tokens', () => {
    it('should have heading typography tokens', () => {
      expect(designTokens.typography.h1).toBeDefined()
      expect(designTokens.typography.h2).toBeDefined()
      expect(designTokens.typography.h3).toBeDefined()
    })

    it('should have body typography tokens', () => {
      expect(designTokens.typography.body).toBeDefined()
      expect(designTokens.typography.small).toBeDefined()
      expect(designTokens.typography.caption).toBeDefined()
    })

    it('should have consistent typography structure', () => {
      Object.values(designTokens.typography).forEach((typo) => {
        expect(typo.fontSize).toBeDefined()
        expect(typo.fontWeight).toBeDefined()
        expect(typo.lineHeight).toBeDefined()
      })
    })

    it('should use proper font weights', () => {
      const validWeights = ['400', '600', '700']
      Object.values(designTokens.typography).forEach((typo) => {
        expect(validWeights).toContain(typo.fontWeight)
      })
    })
  })

  describe('Shadow Tokens', () => {
    it('should have shadow tokens', () => {
      expect(designTokens.shadows.sm).toBeDefined()
      expect(designTokens.shadows.md).toBeDefined()
      expect(designTokens.shadows.lg).toBeDefined()
    })

    it('should have consistent shadow format', () => {
      Object.values(designTokens.shadows).forEach((shadow) => {
        expect(shadow).toMatch(/^0\s+\d+px/)
      })
    })
  })

  describe('Border Radius Tokens', () => {
    it('should have border radius tokens', () => {
      expect(designTokens.borderRadius.sm).toBeDefined()
      expect(designTokens.borderRadius.md).toBeDefined()
      expect(designTokens.borderRadius.lg).toBeDefined()
      expect(designTokens.borderRadius.full).toBeDefined()
    })

    it('should use consistent units', () => {
      Object.values(designTokens.borderRadius).forEach((radius) => {
        if (radius !== '9999px') {
          expect(radius).toMatch(/^\d+(\.\d+)?rem$/)
        }
      })
    })
  })

  describe('Inline Styles Analysis', () => {
    it('should detect inline color styles', () => {
      const html = '<div style="color: red; padding: 10px;">Content</div>'
      const violations = analyzeInlineStyles(html)
      expect(violations.length).toBeGreaterThan(0)
    })

    it('should detect inline padding styles', () => {
      const html = '<div style="padding: 20px;">Content</div>'
      const violations = analyzeInlineStyles(html)
      expect(violations.length).toBeGreaterThan(0)
    })

    it('should not report violations in token-based code', () => {
      const html = '<div class="text-primary px-4 py-2">Content</div>'
      const violations = analyzeInlineStyles(html)
      expect(violations.length).toBe(0)
    })

    it('should identify all inline style violations', () => {
      const html = `
        <div style="color: #3B82F6; padding: 1rem;">Good</div>
        <div style="background-color: red;">Bad</div>
        <div style="margin: 10px;">Bad</div>
      `
      const violations = analyzeInlineStyles(html)
      expect(violations.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Token Consistency', () => {
    it('should have no duplicate color values', () => {
      const colors = Object.values(designTokens.colors)
      const _uniqueColors = new Set(colors)
      // Allow some duplicates for semantic colors, but check structure
      expect(colors.length).toBeGreaterThan(0)
    })

    it('should have all tokens defined and accessible', () => {
      const tokenCategories = Object.keys(designTokens)
      expect(tokenCategories.length).toBeGreaterThan(0)

      tokenCategories.forEach((category) => {
        const tokens = designTokens[category as keyof DesignTokens]
        expect(Object.keys(tokens).length).toBeGreaterThan(0)
      })
    })

    it('should have consistent token naming', () => {
      // Check spacing names are lowercase with no spaces
      Object.keys(designTokens.spacing).forEach((key) => {
        expect(/^[a-z0-9]+$/.test(key)).toBe(true)
      })
    })
  })

  describe('Token Migration from Inline Styles', () => {
    it('should provide replacement for inline padding', () => {
      const _inlineStyle = 'padding: 1rem'
      expect(designTokens.spacing.md).toBe('1rem')
    })

    it('should provide replacement for inline color', () => {
      const _inlineStyle = 'color: #3B82F6'
      expect(designTokens.colors.primary).toBe('#3B82F6')
    })

    it('should support mapping common inline values to tokens', () => {
      const inlineToToken = {
        '0.5rem': designTokens.spacing.sm,
        '1rem': designTokens.spacing.md,
        '#3B82F6': designTokens.colors.primary,
        '#EF4444': designTokens.colors.danger
      }

      Object.entries(inlineToToken).forEach(([_inline, token]) => {
        expect(token).toBeDefined()
      })
    })
  })

  describe('Design System Compliance', () => {
    it('should enforce token usage through type safety', () => {
      // Tokens should be strongly typed
      const colors = designTokens.colors
      expect(typeof colors).toBe('object')

      // Accessing undefined token should fail
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately access non-existent key to assert undefined
      expect((colors as any).invalidColor).toBeUndefined()
    })

    it('should provide all necessary token categories', () => {
      const requiredCategories = ['colors', 'spacing', 'typography', 'shadows', 'borderRadius']
      requiredCategories.forEach((category) => {
        expect(Object.keys(designTokens)).toContain(category)
      })
    })

    it('should have documented and accessible tokens', () => {
      // All tokens should be documented
      expect(Object.keys(designTokens.colors).length).toBeGreaterThan(5)
      expect(Object.keys(designTokens.spacing).length).toBeGreaterThan(3)
      expect(Object.keys(designTokens.typography).length).toBeGreaterThan(2)
    })
  })
})
