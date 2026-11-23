# Accessibility Testing Guide

## Overview

This guide covers automated and manual accessibility testing for the Scavenger platform to ensure WCAG 2.1 AA compliance.

## Automated Testing

### Running Accessibility Tests

```bash
# Run all accessibility tests
npm run e2e -- --grep "Accessibility"

# Run keyboard navigation tests
npm run e2e -- --grep "Keyboard Navigation"

# Run specific test file
npm run e2e e2e/accessibility.spec.ts
```

### Test Coverage

#### 1. **Homepage Accessibility** (4 tests)

- No accessibility violations
- Proper heading hierarchy
- Alt text for all images
- Sufficient color contrast
- Keyboard navigation

#### 2. **Form Accessibility** (5 tests)

- Proper form labels
- ARIA labels for form fields
- Accessible error messages
- Form validation accessibility
- Keyboard form submission

#### 3. **Navigation Accessibility** (4 tests)

- Skip to main content link
- Navigation landmarks
- Breadcrumb navigation
- Current page indication

#### 4. **Screen Reader Support** (4 tests)

- Descriptive button text
- Descriptive link text
- Dynamic content announcements
- Proper list semantics

#### 5. **WCAG 2.1 AA Compliance** (3 tests)

- Full WCAG 2.1 AA compliance
- Focus indicators
- Text resizing support

#### 6. **Keyboard Navigation** (8 tests)

- Tab navigation through forms
- Enter key button activation
- Space key button activation
- Arrow key menu navigation
- Escape key menu closing
- Tab navigation for tabs
- Reverse navigation with Shift+Tab
- Skip to main content

## Manual Testing

### Screen Reader Testing

#### NVDA (Windows)

```bash
# Download from https://www.nvaccess.org/
# Test with Firefox or Chrome
```

#### JAWS (Windows)

```bash
# Commercial screen reader
# Test with Internet Explorer, Firefox, Chrome
```

#### VoiceOver (macOS/iOS)

```bash
# Built-in screen reader
# Enable: System Preferences > Accessibility > VoiceOver
```

#### TalkBack (Android)

```bash
# Built-in screen reader
# Enable: Settings > Accessibility > TalkBack
```

### Keyboard Navigation Testing

1. **Tab Navigation**
   - Tab through all interactive elements
   - Verify focus is visible
   - Check tab order is logical

2. **Enter/Space Keys**
   - Activate buttons with Enter
   - Activate buttons with Space
   - Verify actions trigger correctly

3. **Arrow Keys**
   - Navigate menus with arrow keys
   - Navigate tabs with arrow keys
   - Navigate sliders with arrow keys

4. **Escape Key**
   - Close modals with Escape
   - Close menus with Escape
   - Cancel operations with Escape

### Color Contrast Testing

Use tools like:

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Contrast Ratio](https://contrast-ratio.com/)
- Browser DevTools (Lighthouse)

**Minimum Requirements:**

- Normal text: 4.5:1
- Large text (18pt+): 3:1
- UI components: 3:1

### Zoom and Text Resizing

1. Test at 200% zoom
2. Test with browser text size increased
3. Verify no content is cut off
4. Verify layout remains usable

## Accessibility Checklist

### Structure

- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] Semantic HTML (nav, main, aside, footer)
- [ ] List markup for lists
- [ ] Table markup for tables

### Forms

- [ ] All inputs have labels
- [ ] Labels associated with inputs (for/id)
- [ ] Error messages linked to inputs
- [ ] Required fields marked
- [ ] Instructions provided

### Images

- [ ] All images have alt text
- [ ] Alt text is descriptive
- [ ] Decorative images have empty alt
- [ ] Complex images have long descriptions

### Links and Buttons

- [ ] Descriptive link text
- [ ] No "click here" links
- [ ] Buttons have accessible names
- [ ] Icon buttons have labels

### Color and Contrast

- [ ] 4.5:1 contrast for normal text
- [ ] 3:1 contrast for large text
- [ ] 3:1 contrast for UI components
- [ ] Color not sole means of conveying info

### Keyboard Navigation

- [ ] All functionality keyboard accessible
- [ ] Logical tab order
- [ ] Focus visible
- [ ] No keyboard traps

### ARIA

- [ ] Proper ARIA roles
- [ ] Proper ARIA states
- [ ] Proper ARIA properties
- [ ] No redundant ARIA

## Tools

### Automated Testing

- **axe DevTools**: Browser extension for accessibility testing
- **Lighthouse**: Built into Chrome DevTools
- **WAVE**: Browser extension for accessibility evaluation
- **Playwright + axe**: Automated testing in CI/CD

### Manual Testing

- **Screen readers**: NVDA, JAWS, VoiceOver, TalkBack
- **Keyboard navigation**: Tab, Enter, Space, Arrow keys
- **Browser zoom**: Test at 200% zoom
- **Color contrast**: WebAIM Contrast Checker

## CI/CD Integration

Accessibility tests run automatically on:

- Pull requests (smoke test)
- Merges to main (full suite)
- Scheduled nightly runs

Failures block deployment if critical issues found.

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM](https://webaim.org/)
- [Deque University](https://dequeuniversity.com/)
- [A11y Project](https://www.a11yproject.com/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Common Issues and Fixes

### Missing Alt Text

```html
<!-- Bad -->
<img src="waste.jpg" />

<!-- Good -->
<img src="waste.jpg" alt="Plastic waste collected from beach" />
```

### Missing Form Labels

```html
<!-- Bad -->
<input type="email" />

<!-- Good -->
<label for="email">Email Address</label>
<input id="email" type="email" />
```

### Poor Color Contrast

```css
/* Bad */
color: #999; /* 4.3:1 on white */

/* Good */
color: #666; /* 7.5:1 on white */
```

### Missing Focus Indicator

```css
/* Bad */
button:focus {
  outline: none;
}

/* Good */
button:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
```

### Non-Semantic HTML

```html
<!-- Bad -->
<div onclick="submitForm()">Submit</div>

<!-- Good -->
<button type="submit">Submit</button>
```

## Reporting Issues

When reporting accessibility issues, include:

1. Page URL
2. Issue description
3. WCAG criterion violated
4. Steps to reproduce
5. Assistive technology used (if applicable)
6. Browser and OS
