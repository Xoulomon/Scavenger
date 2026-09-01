# Scavngr Design System

A token-driven design system built on Tailwind CSS and Radix UI primitives, optimised for the Scavngr recycling platform.

---

## Quick Start

```bash
# Run Storybook
npm run storybook

# Build Storybook static site
npm run build-storybook
```

---

## Design Tokens

All tokens live in `src/design-system/tokens.ts` and are the single source of truth consumed by:

- `tailwind.config.ts` — Tailwind utility classes
- `src/index.css` — CSS custom properties (`--primary`, `--background`, …)
- `src/design-system/index.ts` — JS/TS token exports for runtime use

### Color Palette

| Scale | Token | Light value | Dark value |
|-------|-------|-------------|------------|
| Primary | `--primary` | green-600 `#16a34a` | green-400 `#4ade80` |
| Background | `--background` | `#ffffff` | `hsl(222 47% 8%)` |
| Foreground | `--foreground` | `hsl(222 47% 11%)` | `hsl(210 40% 96%)` |
| Muted | `--muted-foreground` | `hsl(215 25% 38%)` | `hsl(215 25% 68%)` |
| Destructive | `--destructive` | red-600 `#dc2626` | red-500 `#ef4444` |

All semantic color pairs meet **WCAG AA** (4.5:1 contrast ratio) in both light and dark modes.

Raw palette tokens (`green`, `blue`, `amber`, `red`, `neutral`) are also available as Tailwind utilities:

```tsx
<span className="text-green-600 dark:text-green-400">Recycled</span>
<div className="bg-amber-100 dark:bg-amber-900">Warning</div>
```

### Typography

| Token | Value |
|-------|-------|
| `font-sans` | Inter, ui-sans-serif, system-ui |
| `font-mono` | JetBrains Mono, ui-monospace |
| `text-xs` | 0.75rem / 1rem |
| `text-sm` | 0.875rem / 1.25rem |
| `text-base` | 1rem / 1.5rem |
| `text-lg` | 1.125rem / 1.75rem |
| `text-xl` | 1.25rem / 1.75rem |
| `text-2xl` | 1.5rem / 2rem |
| `text-3xl` | 1.875rem / 2.25rem |
| `text-4xl` | 2.25rem / 2.5rem |

### Spacing

Uses the standard Tailwind 4px grid (`spacing-1` = 4px, `spacing-4` = 16px, …). Extended tokens up to `spacing-64` (256px).

### Border Radius

| Token | Value |
|-------|-------|
| `rounded-sm` | 4px |
| `rounded` | 6px |
| `rounded-md` | 8px |
| `rounded-lg` | 12px |
| `rounded-xl` | 16px |
| `rounded-2xl` | 24px |
| `rounded-full` | 9999px |

The `--radius` CSS variable (default `0.5rem`) drives the shadcn/ui `rounded-lg/md/sm` aliases.

### Shadows

| Token | Usage |
|-------|-------|
| `shadow-sm` | Subtle card lift |
| `shadow` | Default card |
| `shadow-md` | Dropdowns, popovers |
| `shadow-lg` | Modals |
| `shadow-xl` | Floating panels |

---

## Component Library

All components are in `src/components/ui/` and built on Radix UI primitives with Tailwind styling via `class-variance-authority`.

### Button

```tsx
import { Button } from '@/components/ui/Button'

<Button variant="primary">Submit Waste</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="destructive">Delete</Button>
```

**Variants:** `primary` | `secondary` | `outline` | `ghost` | `destructive` | `link`
**Sizes:** `default` (h-11) | `sm` (h-11 px-3) | `lg` (h-12 px-8) | `icon` (h-10 w-10)

### Badge

```tsx
import { Badge } from '@/components/ui/Badge'

<Badge variant="default">Verified</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Rejected</Badge>
<Badge variant="outline">Draft</Badge>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

<Card>
  <CardHeader>
    <CardTitle>Waste Submission</CardTitle>
    <CardDescription>Submit recyclable materials.</CardDescription>
  </CardHeader>
  <CardContent>…</CardContent>
  <CardFooter>…</CardFooter>
</Card>
```

### Input

```tsx
import { Input } from '@/components/ui/Input'

<Input placeholder="Enter wallet address…" />
<Input type="number" placeholder="Weight (kg)" min={0} step={0.1} />
```

### Select

```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'

<Select>
  <SelectTrigger><SelectValue placeholder="Waste type" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="plastic">Plastic</SelectItem>
    <SelectItem value="metal">Metal</SelectItem>
  </SelectContent>
</Select>
```

### Dialog

```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'

<Dialog>
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Transfer</DialogTitle>
      <DialogDescription>This cannot be undone.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Switch

```tsx
import { Switch } from '@/components/ui/Switch'

<Switch id="notifications" defaultChecked />
```

### Checkbox

```tsx
import { Checkbox } from '@/components/ui/Checkbox'

<Checkbox id="terms" />
```

---

## Component File Structure

Every component lives in its own folder named after the component, rather than as a loose file alongside unrelated siblings:

```
ComponentName/
  index.tsx                    # implementation + export(s) — this is the component
  ComponentName.test.tsx        # colocated unit test (if the component has one)
  ComponentName.stories.tsx     # colocated Storybook story (if the component has one)
  ComponentName.types.ts        # extracted prop/domain types — only when they're too
                                 # large to inline comfortably in index.tsx
```

Rules:

- **`index.tsx` is the component.** This keeps import paths unchanged — `@/components/ui/Badge` still resolves whether `Badge` is a file or a folder with an `index.tsx`, so consumers never need to update imports when a component migrates.
- **Tests and stories are colocated in the component's folder**, not in a separate `__tests__/` subfolder or a top-level `tests/` directory. A story imports its component via `./index`; a colocated test does the same.
- **No CSS module or styled-components file** — this project styles exclusively with Tailwind utility classes, so there's no separate stylesheet to colocate.
- **Types stay inline in `index.tsx` by default.** Only pull them into `ComponentName.types.ts` when the component is complex enough that a separate file measurably helps readability (see `ApiPlayground/types.ts` for a precedent).

This convention has been applied to `components/ui/Badge/`, `components/ui/EmptyState/`, `components/ui/StatCard/`, `components/ui/Checkbox/`, `components/ui/Switch/`, `components/ui/VerificationBadge/`, `components/ui/SearchBar/`, `components/OfflineIndicator/`, `components/analytics/CarbonImpactCard/`, and `components/qr/QRGenerator/`. Older components not yet migrated keep their existing flat-file or `__tests__/`-subfolder layout until they're next touched — there's no wholesale rewrite planned; components move to this structure incrementally as they're edited.

---

## Dark Mode

Dark mode is driven by the `.dark` class on `<html>`. The `ThemeProvider` in `src/context/ThemeProvider.tsx` manages this via `next-themes`.

```tsx
// Toggle dark mode
import { useTheme } from 'next-themes'
const { setTheme } = useTheme()
setTheme('dark')   // or 'light' | 'system'
```

Smooth transitions are applied once the `html.theme-ready` class is set (prevents flash on initial load).

---

## Token Export Utility

Import tokens directly in TypeScript for runtime use (e.g. chart colours, dynamic styles):

```ts
import tokens from '@/design-system'
// or named imports:
import { colors, spacing, shadows } from '@/design-system'

// Example: pass brand green to a chart library
const chartColor = tokens.colors.green[500]  // '#22c55e'
```

See `src/design-system/index.ts` for the full export surface.

---

## Accessibility

- All interactive components expose correct ARIA roles via Radix UI primitives.
- Focus rings use `ring-ring` (matches `--primary`) with a 2px offset.
- Colour contrast meets WCAG AA in both light and dark modes.
- Storybook has `@storybook/addon-a11y` installed — run accessibility checks from the **Accessibility** panel.

---

## Adding New Tokens

1. Add the value to `src/design-system/tokens.ts`.
2. If it's a semantic token, add the CSS custom property to `src/index.css` (both `:root` and `.dark`).
3. Reference it in `tailwind.config.ts` if a Tailwind utility is needed.
4. Re-export it from `src/design-system/index.ts`.
