import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Badge } from './Badge/index'

expect.extend(toHaveNoViolations)

describe('Badge', () => {
  describe('Rendering', () => {
    it('renders children text', () => {
      render(<Badge>Active</Badge>)
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('renders with default variant', () => {
      render(<Badge>Default</Badge>)
      const badge = screen.getByText('Default')
      expect(badge).toHaveClass('bg-primary')
    })

    it('renders with secondary variant', () => {
      render(<Badge variant="secondary">Inactive</Badge>)
      expect(screen.getByText('Inactive')).toHaveClass('bg-secondary')
    })

    it('renders with destructive variant', () => {
      render(<Badge variant="destructive">Error</Badge>)
      expect(screen.getByText('Error')).toHaveClass('bg-destructive')
    })

    it('renders with outline variant', () => {
      render(<Badge variant="outline">Outline</Badge>)
      expect(screen.getByText('Outline')).toHaveClass('text-foreground')
    })

    it('applies custom className', () => {
      render(<Badge className="my-badge">Custom</Badge>)
      expect(screen.getByText('Custom')).toHaveClass('my-badge')
    })

    it('passes through HTML attributes', () => {
      render(<Badge data-testid="my-badge">Tagged</Badge>)
      expect(screen.getByTestId('my-badge')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('passes axe audit — default variant', async () => {
      const { container } = render(<Badge>Active</Badge>)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit — all variants', async () => {
      const variants = ['default', 'secondary', 'destructive', 'outline'] as const
      for (const variant of variants) {
        const { container } = render(<Badge variant={variant}>{variant}</Badge>)
        const results = await axe(container)
        expect(results).toHaveNoViolations()
      }
    })
  })
})
