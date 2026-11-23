# Accessibility Guidelines

Scavngr targets **WCAG 2.1 Level AA** compliance. All new components and features must meet the requirements below.

---

## Colour Contrast

- **Normal text** (below 18 pt / 14 pt bold): minimum 4.5 : 1 contrast ratio.
- **Large text** (18 pt+ / 14 pt+ bold): minimum 3 : 1.
- **UI components and graphical objects**: minimum 3 : 1 against adjacent colours.

All semantic token pairs (`--foreground` / `--background`, `--primary` / button text, etc.) have been pre-validated in both light and dark modes. Do not override these with arbitrary colour values.

To verify a new colour pair, use the [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

---

## Keyboard Navigation

Every interactive element must be reachable and operable by keyboard alone.

### Requirements

- All interactive elements receive focus via `Tab` / `Shift+Tab`.
- Focus is always visible — never suppress `outline` without a replacement. Use `ring-ring ring-2 ring-offset-2` (already applied by Radix primitives).
- `Enter` or `Space` activates buttons, checkboxes, and toggles.
- `Escape` closes dialogs, popovers, and dropdowns.
- Arrow keys navigate between items inside menus, radio groups, and tab lists.

### Focus management in modals

When a dialog opens, move focus to the first interactive element inside it. When it closes, return focus to the trigger. Radix UI `Dialog` does this automatically — do not fight it.

```tsx
// ✅ Radix Dialog handles focus trap and restoration automatically
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>…</DialogContent>
</Dialog>
```

---

## Semantic HTML

Use the correct HTML element for the job before reaching for ARIA attributes.

| Need              | Use                                      |
| ----------------- | ---------------------------------------- |
| Page landmark     | `<main>`, `<nav>`, `<aside>`, `<footer>` |
| Heading hierarchy | `<h1>` → `<h2>` → `<h3>` (no skipping)   |
| Button            | `<button>` (not `<div onClick>`)         |
| Navigation link   | `<a href="…">` via `<Link>`              |
| Form field        | `<input>`, `<select>`, `<textarea>`      |
| Data table        | `<table>` with `<th scope="col/row">`    |
| List of items     | `<ul>` / `<ol>` / `<dl>`                 |

---

## ARIA

Add ARIA only when semantic HTML is insufficient.

```tsx
// Label an icon-only button
<Button size="icon" aria-label="Delete item">
  <TrashIcon aria-hidden="true" />
</Button>

// Describe a busy/loading region
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? <Skeleton /> : <DataTable rows={rows} />}
</div>

// Associate error messages with their inputs
<Input id="weight" aria-describedby="weight-error" aria-invalid={!!errors.weight} />
<span id="weight-error" role="alert" className="text-xs text-destructive">
  {errors.weight?.message}
</span>

// Hide decorative icons from screen readers
<LeafIcon aria-hidden="true" />
```

---

## Images and Media

- Every `<img>` must have an `alt` attribute.
- Purely decorative images use `alt=""` (empty string, not omitted).
- Informative images describe their meaning concisely.
- Videos must have captions; audio must have transcripts.

```tsx
// Informative
<img src={badge.imageUrl} alt={`${badge.name} achievement badge`} />

// Decorative
<img src={backgroundTexture} alt="" role="presentation" />
```

---

## Motion and Animation

Respect the user's reduced-motion preference. Scavngr animation tokens are pre-set to respect this via Tailwind's `motion-safe:` / `motion-reduce:` variants.

```tsx
// ✅ Animation only plays when the user has not requested reduced motion
<div className="motion-safe:animate-spin" />

// For custom CSS, use the media query directly
@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; }
}
```

---

## Forms

- Every `<input>`, `<select>`, and `<textarea>` must have an associated `<label>`.
- Use `htmlFor` / `id` pairing or wrap the input in `<label>`.
- Required fields must be marked with `required` (HTML) or `aria-required="true"`.
- Validation errors must be associated via `aria-describedby`.

```tsx
<div className="flex flex-col gap-1">
  <label htmlFor="email" className="text-sm font-medium">
    Email{' '}
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  </label>
  <Input
    id="email"
    type="email"
    required
    aria-describedby={errors.email ? 'email-error' : undefined}
    aria-invalid={!!errors.email}
  />
  {errors.email && (
    <span id="email-error" role="alert" className="text-xs text-destructive">
      {errors.email.message}
    </span>
  )}
</div>
```

---

## Testing Accessibility

### Storybook

The `@storybook/addon-a11y` addon runs automated axe checks on every story. Open the **Accessibility** panel in Storybook to see violations and incomplete checks.

```bash
npm run storybook
```

### Playwright

End-to-end accessibility checks run in `e2e/` using `@axe-core/playwright`:

```bash
npm run a11y
```

### Manual checklist

Before marking a feature complete:

- [ ] Navigate the entire flow using only keyboard.
- [ ] Verify all focus states are visible.
- [ ] Test with a screen reader (VoiceOver on macOS, NVDA on Windows).
- [ ] Check colour contrast for any new colour values.
- [ ] Confirm no Storybook a11y violations.
