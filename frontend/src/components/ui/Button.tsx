import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Shared Button primitive.
 *
 * Storybook-style usage:
 *
 * ```tsx
 * // Primary (default)
 * <Button onClick={handleSubmit}>Submit</Button>
 *
 * // Variants
 * <Button variant="destructive">Delete</Button>
 * <Button variant="outline">Cancel</Button>
 * <Button variant="ghost" size="icon" aria-label="Close">
 *   <XIcon />
 * </Button>
 *
 * // Sizes
 * <Button size="sm">Small</Button>
 * <Button size="lg">Large</Button>
 *
 * // Render as a child element (e.g. anchor) while keeping button styles
 * <Button asChild>
 *   <a href="/dashboard">Dashboard</a>
 * </Button>
 *
 * // Disabled state
 * <Button disabled>Disabled</Button>
 * ```
 *
 * Accessibility:
 * - Renders a native `<button>` by default, so keyboard activation and focus
 *   semantics come for free.
 * - Icon-only buttons (`size="icon"`) MUST provide an accessible name via
 *   `aria-label` or visually hidden text.
 * - Focus is indicated with a visible ring (`focus-visible:ring-2`).
 *
 * Backwards compatibility: `Button`, `ButtonProps`, and `buttonVariants` are
 * exported with the same names/signatures as before, so existing imports keep
 * working without changes.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-11 rounded-md px-3',
        lg: 'h-12 rounded-md px-8',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the styles onto the single child element instead of a `<button>`. */
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        // Default to type="button" to avoid accidental form submissions.
        type={asChild ? undefined : (type ?? 'button')}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
