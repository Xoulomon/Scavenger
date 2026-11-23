import type { Config } from 'tailwindcss'
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation
} from './src/design-system/tokens'

/**
 * WCAG AA contrast notes (issue #1680)
 * ------------------------------------
 * Semantic tokens (`primary`, `secondary`, `muted`, `accent`, `destructive`,
 * `card`, `popover`, `border`, `input`, `ring`, `background`, `foreground`)
 * are wired to CSS custom properties defined in `src/styles`. Their
 * foreground/background pairings are tuned to meet the 4.5:1 ratio for normal
 * text (and 3:1 for large text / non-text UI). Do NOT hard-code literal colors
 * for these tokens here — that would bypass the AA-corrected values.
 *
 * Raw palette entries (`green`, `blue`, `amber`, `red`, `neutral`) are exposed
 * for non-text usage (borders, icons, charts, backgrounds). When used for text,
 * pair them with an AA-safe counterpart, e.g.:
 *   - `text-green-700` on `bg-green-50` / white
 *   - `text-blue-700` on `bg-blue-50` / white
 *   - `text-amber-800` on `bg-amber-50` / white
 *   - `text-red-700` on `bg-red-50` / white
 *   - `text-neutral-700` on `bg-neutral-50` / white
 * The lighter shades (e.g. `*-400`/`*-500`) are intended for large text,
 * icons, and decorative fills only.
 *
 * Backwards compatibility: token names and CSS variable names are unchanged;
 * only the underlying color values were adjusted to pass AA. Consumers that
 * relied on exact hex values (e.g. visual snapshots) may need updates.
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' }
    },
    screens: {
      // Extra-small breakpoint for narrow phones (<360px)
      xs: '360px',
      sm: '640px',
      md: '768px',
      // Tablet breakpoint (portrait/landscape tablets)
      tablet: '834px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    extend: {
      colors: {
        // Raw palette — available as e.g. `text-green-500`.
        // See WCAG AA notes above for AA-safe text pairings.
        green: colors.green,
        blue: colors.blue,
        amber: colors.amber,
        red: colors.red,
        neutral: colors.neutral,
        // Semantic tokens — wired to CSS custom properties.
        // These resolve to the AA-corrected values in `src/styles`.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        // Semantic surface tokens — use these instead of hard-coded colors
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          foreground: 'hsl(var(--surface-foreground))',
          muted: 'hsl(var(--surface-muted))',
          raised: 'hsl(var(--surface-raised))'
        },
        // Semantic text tokens
        text: {
          DEFAULT: 'hsl(var(--text))',
          muted: 'hsl(var(--text-muted))',
          subtle: 'hsl(var(--text-subtle))',
          inverted: 'hsl(var(--text-inverted))'
        },
        // Semantic status tokens
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))'
        }
      },
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      letterSpacing: typography.letterSpacing,
      spacing,
      borderRadius: {
        ...borderRadius,
        // Keep shadcn/ui aliases
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: shadows,
      transitionDuration: animation.duration,
      transitionTimingFunction: animation.easing,
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.15s ease-in'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
} satisfies Config
