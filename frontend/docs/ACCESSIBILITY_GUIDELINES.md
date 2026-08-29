# Accessibility Guidelines for Form Components

This document outlines accessibility requirements and best practices for all form components in the Scavenger application.

## Overview

All form components must meet WCAG 2.1 Level AA standards and pass automated accessibility checks using jest-axe.

## Form Component Checklist

### Labels and Associated Elements

- [ ] Every input field must have an associated `<label>` element with `for` attribute
- [ ] The label's `for` attribute must match the input's `id`
- [ ] Labels should use clear, descriptive text
- [ ] For required fields, include visual indicator (e.g., asterisk) AND use `required` attribute

**Example:**
```tsx
<label htmlFor="email-input">Email Address *</label>
<Input id="email-input" type="email" required aria-required="true" />
```

### ARIA Attributes

- [ ] Use `aria-label` or `aria-labelledby` when label text is not visible
- [ ] Use `aria-describedby` to link error messages to inputs
- [ ] Use `aria-required="true"` for required fields (in addition to HTML `required` attribute)
- [ ] Use `aria-invalid="true"` when field has an error
- [ ] Use `role="alert"` for error messages

**Example:**
```tsx
<Input
  id="password-input"
  type="password"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "password-error" : undefined}
  required
/>
{hasError && (
  <div id="password-error" role="alert">
    Password must be at least 8 characters
  </div>
)}
```

### Keyboard Navigation

- [ ] All form controls must be keyboard accessible (Tab, Enter, Arrow keys as appropriate)
- [ ] Tab order should follow logical page flow (left-to-right, top-to-bottom)
- [ ] No keyboard traps - users must be able to move away from any element using keyboard alone
- [ ] Select dropdowns must open with Arrow Down or Space, navigate with Arrow keys

**Testing:**
```bash
# Test keyboard navigation by tabbing through form
# All interactive elements should be reachable
```

### Color Contrast

- [ ] Text must have minimum 4.5:1 contrast ratio against background (normal text)
- [ ] Large text (18pt+) requires minimum 3:1 contrast
- [ ] Error messages must be distinguishable without color alone

### Error Handling

- [ ] Error messages must be associated with input using `aria-describedby`
- [ ] Error text must include information about what went wrong
- [ ] Error messages should use `role="alert"` to announce immediately
- [ ] Errors should be visible near the field they relate to

**Example:**
```tsx
<FormField
  id="username"
  label="Username"
  error={error && "Username must be 3-20 characters"}
  aria-describedby={error ? "username-error" : undefined}
/>
```

### Form Submission

- [ ] Submit button must have descriptive text (not just an icon)
- [ ] On submission error, focus should move to first invalid field or error summary
- [ ] Successful submission should provide feedback (message or redirect)
- [ ] Avoid using `alert()` for form validation - use inline messages instead

### Component-Specific Guidelines

#### Input Component
- `aria-label` for inputs without visible labels
- `aria-describedby` for hint text or error messages
- `type` attribute must be semantic (email, password, date, etc.)

#### Select Component
- Should use native `<select>` element or Radix UI Select with proper ARIA roles
- Radix UI Select automatically provides:
  - `role="combobox"` on trigger
  - `role="listbox"` on content
  - Arrow key navigation
  - Escape key to close

#### Checkbox Component
- Wrap checkbox and label together or use `aria-labelledby`
- Include `aria-checked` for custom checkbox implementations
- Make entire label clickable for better UX

#### Textarea Component
- Same label requirements as input
- Use `aria-label` if no visible label
- Include character count if there's a limit
- Use `aria-describedby` to link hint text

## Testing Accessibility

### Automated Testing with jest-axe

All form component tests must include jest-axe checks:

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('MyFormComponent', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<MyFormComponent />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no violations with error state', async () => {
    const { container } = render(<MyFormComponent error="Error message" />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

### Manual Testing

1. **Keyboard Navigation**: Tab through the entire form without using a mouse
2. **Screen Reader**: Test with VoiceOver (Mac), NVDA (Windows), or JAWS
3. **Zoom**: Test at 200% zoom level
4. **Color Blindness**: Use browser extensions to simulate color blindness
5. **High Contrast Mode**: Enable high contrast mode in OS settings

### Browser DevTools

Use browser accessibility inspector:
- Chrome: DevTools → Elements → Accessibility tree
- Firefox: Inspector → Accessibility tab
- See ARIA roles, labels, and tree structure

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [jest-axe Documentation](https://github.com/nickcolley/jest-axe)
- [Radix UI Accessibility](https://www.radix-ui.com/primitives/docs/overview/introduction#accessible-by-default)

## Issue #1058

This document was created as part of Issue #1058: Add accessibility audit and fixes for form components. See commit history for specific changes made to individual components.
