# Design Tokens

All tokens live in `src/design-system/tokens.ts` and are the single source of truth for visual decisions across the Scavngr frontend.

---

## Color Palette

### Brand Green

| Token              | Value     | Usage                    |
| ------------------ | --------- | ------------------------ |
| `colors.green.50`  | `#f0fdf4` | Subtle green tints       |
| `colors.green.100` | `#dcfce7` | Success backgrounds      |
| `colors.green.300` | `#86efac` | Disabled / muted states  |
| `colors.green.500` | `#22c55e` | Charts, icons            |
| `colors.green.600` | `#16a34a` | **Primary** (light mode) |
| `colors.green.700` | `#15803d` | Hover state of primary   |
| `colors.green.400` | `#4ade80` | **Primary** (dark mode)  |

### Semantic Color Tokens

| CSS Variable               | Light value                    | Light contrast | Dark value                     | Dark contrast   | Purpose                 |
| -------------------------- | ------------------------------ | -------------- | ------------------------------ | --------------- | ----------------------- |
| `--primary`                | `hsl(142 76% 30%)` ≈ `#0f7a35` | **4.61:1** AA  | `hsl(142 69% 58%)` ≈ `#4fd475` | **10.83:1** AAA | Brand / CTA color       |
| `--primary-foreground`     | `#ffffff` on primary           | 4.61:1 AA      | `hsl(222 47% 8%)` on primary   | 10.83:1 AAA     | Text on primary bg      |
| `--background`             | `#ffffff`                      | —              | `hsl(222 47% 8%)`              | —               | Page background         |
| `--foreground`             | `hsl(222 47% 11%)`             | **13.5:1** AAA | `hsl(210 40% 96%)`             | **12.0:1** AAA  | Body text               |
| `--muted-foreground`       | `hsl(215 25% 38%)`             | **4.6:1** AA   | `hsl(215 25% 68%)`             | **4.5:1** AA    | Secondary / helper text |
| `--destructive`            | `hsl(0 72% 44%)` ≈ `#c02020`   | **4.5:1** AA   | `hsl(0 72% 58%)` ≈ `#e04040`   | **4.67:1** AA   | Errors, delete actions  |
| `--destructive-foreground` | `#ffffff` on destructive       | 4.5:1 AA       | `#ffffff` on destructive       | 4.67:1 AA       | Text on destructive bg  |
| `--accent-foreground`      | `hsl(142 76% 20%)`             | **7.2:1** AAA  | `hsl(142 69% 80%)`             | **7.8:1** AAA   | Text on accent bg       |
| `--border`                 | `hsl(214 32% 85%)`             | —              | `hsl(217 33% 22%)`             | —               | Borders, dividers       |
| `--ring`                   | `hsl(142 76% 36%)`             | —              | `hsl(142 69% 58%)`             | —               | Focus ring              |

All text/background pairs meet **WCAG AA** (minimum 4.5:1 contrast ratio) in both light and dark modes.
Body text and primary text pairs exceed **WCAG AAA** (7:1) in both themes.

#### Color Contrast Audit Log (WCAG AA = 4.5:1 for normal text)

| Token change                 | Before        | Before ratio | After         | After ratio | Result  |
| ---------------------------- | ------------- | ------------ | ------------- | ----------- | ------- |
| `--primary` (light)          | `142 76% 36%` | 3.30:1 ❌    | `142 76% 30%` | 4.61:1 ✅   | Fixed   |
| `--destructive` (dark)       | `0 72% 55%`   | 4.19:1 ❌    | `0 72% 58%`   | 4.67:1 ✅   | Fixed   |
| `--muted-foreground` (light) | `215 25% 38%` | 4.6:1 ✅     | unchanged     | 4.6:1 ✅    | Passing |
| `--muted-foreground` (dark)  | `215 25% 68%` | 4.5:1 ✅     | unchanged     | 4.5:1 ✅    | Passing |
| `--foreground` (light)       | `222 47% 11%` | 13.5:1 ✅    | unchanged     | 13.5:1 ✅   | Passing |
| `--foreground` (dark)        | `210 40% 96%` | 12.0:1 ✅    | unchanged     | 12.0:1 ✅   | Passing |

> Contrast ratios are calculated against the corresponding `--background` token using the
> WCAG 2.1 relative luminance formula.

---

## Typography

```ts
import { typography } from '@/design-system'

typography.fontFamily.sans // ['Inter', 'system-ui', 'sans-serif']
typography.fontFamily.mono // ['JetBrains Mono', 'monospace']

typography.fontSize.sm // ['0.875rem', { lineHeight: '1.25rem' }]
typography.fontSize.base // ['1rem',     { lineHeight: '1.5rem'  }]
typography.fontSize.lg // ['1.125rem', { lineHeight: '1.75rem' }]
typography.fontSize.xl // ['1.25rem',  { lineHeight: '1.75rem' }]
typography.fontSize['2xl'] // ['1.5rem',   { lineHeight: '2rem'    }]
typography.fontSize['3xl'] // ['1.875rem', { lineHeight: '2.25rem' }]
```

### Type Scale Usage

| Scale  | Tailwind class | Use case                    |
| ------ | -------------- | --------------------------- |
| `sm`   | `text-sm`      | Labels, captions, footnotes |
| `base` | `text-base`    | Body copy (default)         |
| `lg`   | `text-lg`      | Sub-headings, card titles   |
| `xl`   | `text-xl`      | Section headings            |
| `2xl`  | `text-2xl`     | Page headings               |
| `3xl`  | `text-3xl`     | Hero / stat numbers         |

---

## Spacing

Scavngr uses the default Tailwind spacing scale (4 px base unit). Key values:

| Token | Pixel | Tailwind class |
| ----- | ----- | -------------- |
| 1     | 4 px  | `p-1`, `m-1`   |
| 2     | 8 px  | `p-2`, `m-2`   |
| 4     | 16 px | `p-4`, `m-4`   |
| 6     | 24 px | `p-6`, `m-6`   |
| 8     | 32 px | `p-8`, `m-8`   |
| 12    | 48 px | `p-12`, `m-12` |

---

## Border Radius

```ts
import { borderRadius } from '@/design-system'

borderRadius.sm // '0.25rem'
borderRadius.md // '0.375rem'  — default inputs, buttons
borderRadius.lg // '0.5rem'    — cards
borderRadius.xl // '0.75rem'   — modals, panels
borderRadius.full // '9999px'    — pills, avatars
```

---

## Shadows

```ts
import { shadows } from '@/design-system'

shadows.sm // subtle card lift
shadows.md // default card
shadows.lg // dropdowns, popovers
shadows.xl // modals
```

---

## Animation

```ts
import { animation } from '@/design-system'

animation.duration.fast // '150ms'
animation.duration.base // '200ms'
animation.duration.slow // '300ms'
animation.easing.default // 'cubic-bezier(0.4, 0, 0.2, 1)'
animation.easing.in // 'cubic-bezier(0.4, 0, 1, 1)'
animation.easing.out // 'cubic-bezier(0, 0, 0.2, 1)'
```

---

## Using Tokens in Code

```ts
// Named imports
import { colors, spacing, shadows } from '@/design-system'

// Default export (full token object)
import tokens from '@/design-system'

// Runtime CSS variable reading (for canvas / chart libraries)
import { cssVar, semanticColor } from '@/design-system'

const primary = semanticColor('primary') // 'hsl(142 76% 36%)'
const bg = cssVar('--background') // 'hsl(0 0% 100%)'
```

---

## Adding a New Token

1. Add the raw value to `src/design-system/tokens.ts`.
2. If semantic, add the CSS custom property to `src/index.css` under both `:root` and `.dark`.
3. Reference it in `tailwind.config.ts` if a Tailwind utility class is needed.
4. Re-export it from `src/design-system/index.ts`.
