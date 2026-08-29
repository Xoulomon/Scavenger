# Modal Dialog Accessibility Guidelines

This document outlines accessibility requirements and best practices for all modal dialogs in the Scavenger application.

## Overview

All modal dialogs must meet WCAG 2.1 Level AA standards and provide an accessible experience for keyboard, screen reader, and mouse users.

## Modal Dialog Checklist

### Focus Management

- [ ] Focus must be moved to the dialog when it opens
- [ ] Focus must remain trapped within the dialog (Tab/Shift+Tab)
- [ ] Focus must be restored to the trigger element when dialog closes
- [ ] No focus loss when opening/closing dialogs
- [ ] Dialog should be closed if user presses Escape key

**Example:**
```tsx
function MyModal({ open, onOpenChange }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      // Move focus to dialog or first focusable element
      dialogRef.current?.focus()
    } else {
      // Return focus to trigger
      triggerRef.current?.focus()
    }
  }, [open])

  return (
    <>
      <button ref={triggerRef} onClick={() => onOpenChange(true)}>
        Open Modal
      </button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={dialogRef} tabIndex={-1}>
          {/* Modal content */}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

### ARIA Attributes

All modals must have:
- [ ] `role="dialog"` on the dialog container
- [ ] `aria-modal="true"` to indicate this is a modal dialog
- [ ] `aria-labelledby` pointing to the dialog title
- [ ] `aria-describedby` pointing to the dialog description (if present)

**Example:**
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
    aria-describedby={hasDescription ? "dialog-description" : undefined}
  >
    <DialogHeader>
      <DialogTitle id="dialog-title">Modal Title</DialogTitle>
      {hasDescription && (
        <DialogDescription id="dialog-description">
          Modal description
        </DialogDescription>
      )}
    </DialogHeader>
  </DialogContent>
</Dialog>
```

### Dialog Title and Description

- [ ] Every dialog must have a title (required for screen readers)
- [ ] Title should be in `<DialogTitle>` component (Radix UI)
- [ ] Title must have an `id` attribute for `aria-labelledby`
- [ ] Use `<DialogDescription>` for additional context
- [ ] Description should have an `id` attribute for `aria-describedby`

### Keyboard Navigation

- [ ] Escape key closes the dialog
- [ ] Tab key moves focus to next focusable element within dialog
- [ ] Shift+Tab key moves focus to previous focusable element
- [ ] Focus wraps around within the dialog (first focusable element appears after last)
- [ ] Action buttons should be accessible via Tab key

### Close Button

- [ ] Close button must be clearly visible
- [ ] Close button must have descriptive text or `aria-label`
- [ ] Prefer using `<DialogClose>` component which includes sr-only text
- [ ] Close button should be one of the last focusable elements

**Example:**
```tsx
<DialogClose>
  <X className="h-4 w-4" />
  <span className="sr-only">Close</span>
</DialogClose>
```

### Screen Reader Announcements

- [ ] Dialog title should be announced when dialog opens
- [ ] Focus management should allow screen reader users to navigate content
- [ ] Button purposes should be clear (not just "OK" - use "Save changes")
- [ ] Error messages in dialogs should be announced with `role="alert"`

**Example:**
```tsx
{error && (
  <div role="alert" aria-live="assertive" className="text-destructive">
    {error}
  </div>
)}
```

### Content Guidelines

- [ ] Dialog content should be focused on a single purpose
- [ ] Avoid nested dialogs when possible
- [ ] Form inputs in dialogs should follow form accessibility guidelines
- [ ] Use appropriate heading levels within dialog (usually h2 or h3)

### Testing Modal Accessibility

#### Focus Trap Test
```typescript
it('traps focus within dialog', async () => {
  const user = userEvent.setup()
  render(<MyModal open={true} />)

  const firstButton = screen.getAllByRole('button')[0]
  firstButton.focus()

  // Tab through all elements
  for (let i = 0; i < 10; i++) {
    await user.tab()
  }

  // Focus should still be within dialog
  const activeElement = document.activeElement
  expect(activeElement?.closest('[role="dialog"]')).toBeTruthy()
})
```

#### Escape Key Test
```typescript
it('closes with Escape key', async () => {
  const user = userEvent.setup()
  const handleClose = vi.fn()
  render(<MyModal open={true} onClose={handleClose} />)

  await user.keyboard('{Escape}')

  expect(handleClose).toHaveBeenCalled()
})
```

#### Focus Restoration Test
```typescript
it('restores focus to trigger on close', async () => {
  const user = userEvent.setup()
  const triggerRef = useRef(null)

  render(
    <>
      <button ref={triggerRef}>Open</button>
      <MyModal open={isOpen} onOpenChange={setIsOpen} />
    </>
  )

  const trigger = screen.getByRole('button', { name: /open/i })
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: /close/i }))

  await waitFor(() => {
    expect(triggerRef.current).toHaveFocus()
  })
})
```

#### ARIA Test
```typescript
it('has proper ARIA attributes', () => {
  render(<MyModal open={true} />)

  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveAttribute('aria-labelledby')
})
```

#### Axe Test
```typescript
import { axe, toHaveNoViolations } from 'jest-axe'

it('has no accessibility violations', async () => {
  const { container } = render(<MyModal open={true} />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

## Radix UI Dialog Component

Scavenger uses Radix UI's Dialog component which provides:
- Built-in focus trap
- Automatic `role="dialog"` on content
- Automatic `aria-modal="true"`
- Escape key handling
- Focus restoration on close

Developers should:
- Ensure DialogTitle is always present
- Use DialogDescription when there's additional context
- Connect aria-labelledby and aria-describedby
- Test focus behavior in modals

## Common Issues

### Issue: Focus not trapped
**Solution**: Ensure all interactive elements are within the DialogContent. Check for elements outside dialog that can receive focus.

### Issue: Escape key not working
**Solution**: Verify onOpenChange prop is connected to Dialog component.

### Issue: Screen reader doesn't announce title
**Solution**: Ensure DialogTitle is present and has an id. Verify aria-labelledby is set correctly.

### Issue: Focus not returning to trigger
**Solution**: Verify trigger element is visible after dialog closes. Use ref to track trigger for restoration.

## Resources

- [ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/)
- [Radix UI Dialog Documentation](https://www.radix-ui.com/primitives/docs/components/dialog)
- [WCAG 2.1 Modal Dialogs](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA26)
- [jest-axe Documentation](https://github.com/nickcolley/jest-axe)

## Issue #1059

This document was created as part of Issue #1059: Accessibility pass on modals in components/modals. See commit history for specific changes and comprehensive test coverage added to all modal components.
