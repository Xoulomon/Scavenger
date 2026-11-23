# Accessibility Testing

## Overview

Accessibility testing ensures the Scavenger platform is usable by everyone, including people with disabilities. We follow WCAG 2.1 Level AA standards.

## Testing Framework

- **Tool**: Playwright + axe-core
- **Standard**: WCAG 2.1 Level AA
- **Coverage**: Frontend components and pages

## Test Scenarios

### 1. Automated Accessibility Violations

- **Tool**: axe-core
- **Scope**: All pages
- **Checks**: Color contrast, ARIA labels, semantic HTML
- **Target**: Zero violations

### 2. ARIA Labels & Landmarks

- **Checks**: Main, nav, form labels
- **Requirement**: Every interactive element has accessible name
- **Validation**: Proper heading hierarchy (single H1)

### 3. Form Accessibility

- **Checks**: Input labels, error messages, validation
- **Requirement**: All inputs associated with labels
- **Validation**: Error messages have role="alert"

### 4. Button Accessibility

- **Checks**: Accessible names, proper semantics
- **Requirement**: All buttons have visible or aria-label text
- **Validation**: No empty buttons

### 5. Image Alt Text

- **Checks**: All images have alt text or aria-label
- **Requirement**: Descriptive alt text for content images
- **Validation**: Decorative images marked appropriately

### 6. Keyboard Navigation

- **Checks**: Tab order, focus management
- **Requirement**: All functionality accessible via keyboard
- **Validation**: Logical tab order, visible focus indicators

### 7. Color Contrast

- **Standard**: WCAG AA (4.5:1 for text, 3:1 for graphics)
- **Tool**: axe-core contrast checker
- **Validation**: All text meets minimum contrast

### 8. Focus Indicators

- **Requirement**: Visible focus outline on all interactive elements
- **Validation**: Outline or box-shadow visible on focus
- **Style**: Minimum 2px visible indicator

### 9. Modal Focus Trapping

- **Requirement**: Focus trapped within modal when open
- **Validation**: Tab cycles within modal only
- **Escape**: Escape key closes modal

### 10. Skip Links

- **Requirement**: Skip to main content link present
- **Validation**: First focusable element on page
- **Target**: `<a href="#main-content">`

### 11. Form Validation

- **Checks**: Error message accessibility
- **Requirement**: Errors announced to screen readers
- **Validation**: role="alert" on error messages

### 12. Language Declaration

- **Requirement**: HTML lang attribute set
- **Validation**: Correct language code (e.g., "en")

### 13. Responsive Design

- **Breakpoints**: 375px (mobile), 768px (tablet), 1024px (desktop)
- **Requirement**: Content readable at all sizes
- **Validation**: No horizontal scrolling on mobile

### 14. Text Resizing

- **Requirement**: Content readable at 200% zoom
- **Validation**: No content cutoff or overlap
- **Test**: Browser zoom and CSS zoom

## Running Accessibility Tests

```bash
cd frontend

# Run all accessibility tests
npm run a11y

# Run with UI
npm run a11y:ui

# Run specific test
npx playwright test --grep "keyboard navigation"

# Generate HTML report
npx playwright test --reporter=html
```

## CI/CD Integration

Accessibility tests run on every push:

```yaml
- name: Run Accessibility Tests
  run: npm run a11y:ci
```

## WCAG 2.1 Compliance

| Principle      | Level | Status |
| -------------- | ----- | ------ |
| Perceivable    | AA    | ✅     |
| Operable       | AA    | ✅     |
| Understandable | AA    | ✅     |
| Robust         | AA    | ✅     |

## Common Issues & Fixes

### Missing Alt Text

```tsx
// ❌ Bad
<img src="waste.jpg" />

// ✅ Good
<img src="waste.jpg" alt="Plastic waste collected" />
```

### Missing Form Labels

```tsx
// ❌ Bad
<input type="text" placeholder="Name" />

// ✅ Good
<label htmlFor="name">Name</label>
<input id="name" type="text" />
```

### Poor Color Contrast

```tsx
// ❌ Bad (2:1 ratio)
<p style={{ color: '#999', background: '#fff' }}>Text</p>

// ✅ Good (4.5:1 ratio)
<p style={{ color: '#333', background: '#fff' }}>Text</p>
```

### Missing Focus Indicator

```tsx
// ❌ Bad
button { outline: none; }

// ✅ Good
button:focus { outline: 2px solid #0066cc; }
```

## Accessibility Checklist

- [ ] All images have alt text
- [ ] All form inputs have labels
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Semantic HTML used
- [ ] ARIA labels where needed
- [ ] Error messages accessible
- [ ] Responsive at all breakpoints
- [ ] Text resizable to 200%

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WebAIM](https://webaim.org/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Reporting Accessibility Issues

Found an accessibility issue? Please report it:

1. Open an issue with label `accessibility`
2. Include WCAG criterion violated
3. Provide steps to reproduce
4. Suggest remediation if possible

## Continuous Improvement

- Review accessibility reports monthly
- Update tests for new components
- Train team on WCAG standards
- Conduct user testing with assistive technologies
