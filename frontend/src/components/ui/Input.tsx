import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Input
 *
 * A shared, accessible text input primitive used across the application.
 * Replaces per-page duplicated `<input>` markup so styling and behavior
 * stay consistent.
 *
 * ## Usage
 *
 * ```tsx
 * <Input placeholder="Email" type="email" aria-label="Email" />
 * ```
 *
 * ### With react-hook-form
 *
 * The component forwards all native input props, so a `register()` spread
 * works out of the box (including `type`, `step`, `min`, `aria-label`, etc.):
 *
 * ```tsx
 * <Input type="number" step="0.01" min={0} {...register('amount')} />
 * ```
 *
 * ### Error / invalid state
 *
 * Pass `aria-invalid` (and optionally a custom `className`) to signal an
 * invalid field. The invalid styling is applied via the `aria-invalid`
 * attribute so it works with or without a form library:
 *
 * ```tsx
 * <Input aria-invalid={!!errors.email} {...register('email')} />
 * ```
 *
 * ## Props
 *
 * Extends all native `React.InputHTMLAttributes<HTMLInputElement>` props
 * (`type`, `step`, `min`, `max`, `aria-label`, `aria-invalid`, `disabled`,
 * `placeholder`, `value`, `defaultValue`, `onChange`, etc.) plus `className`.
 *
 * ## Accessibility
 *
 * - Always provide an accessible name via `aria-label` or an associated
 *   `<label>`.
 * - Use `aria-invalid` to communicate validation errors to assistive tech.
 * - Focus styles are visible via `focus-visible` ring utilities.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
