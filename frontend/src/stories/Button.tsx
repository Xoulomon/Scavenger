import React from 'react'

import './button.css'

import { Button as SharedButton } from '../components/ui/Button'

export interface ButtonProps {
  /** Is this the principal call to action on the page? */
  primary?: boolean
  /** What background color to use */
  backgroundColor?: string
  /** How large should the button be? */
  size?: 'small' | 'medium' | 'large'
  /** Button contents */
  label: string
  /** Optional click handler */
  onClick?: () => void
}

/**
 * Storybook demo wrapper for the shared `Button` primitive from
 * `frontend/src/components/ui/Button`.
 *
 * This story replaces the legacy per-page demo button and delegates all
 * rendering to the shared primitive so that documentation stays in sync
 * with production usage.
 *
 * Variants:
 * - `primary` (default: `false`): principal call to action on the page.
 * - `secondary` (default): supporting actions.
 *
 * Sizes:
 * - `small`, `medium` (default), `large`.
 *
 * Accessibility notes:
 * - Always provide a meaningful `label`; it is used as the accessible name.
 * - The shared primitive renders a native `<button>` with `type="button"`
 *   by default, preserving keyboard focus and activation semantics.
 * - Do not rely on color alone to convey the primary/secondary distinction;
 *   pair with clear copy.
 */
export const Button = ({
  primary = false,
  size = 'medium',
  backgroundColor,
  label,
  ...props
}: ButtonProps) => {
  const variant = primary ? 'primary' : 'secondary'
  return (
    <SharedButton variant={variant} size={size} style={{ backgroundColor }} {...props}>
      {label}
    </SharedButton>
  )
}
