import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  describe('renders with default variant mapping', () => {
    it('renders active status with default variant', () => {
      render(<StatusBadge status="active" />)
      expect(screen.getByText('active')).toBeInTheDocument()
    })

    it('renders passed status with secondary variant', () => {
      render(<StatusBadge status="passed" />)
      expect(screen.getByText('passed')).toBeInTheDocument()
    })

    it('renders rejected status with destructive variant', () => {
      render(<StatusBadge status="rejected" />)
      expect(screen.getByText('rejected')).toBeInTheDocument()
    })

    it('renders vetoed status with destructive variant', () => {
      render(<StatusBadge status="vetoed" />)
      expect(screen.getByText('vetoed')).toBeInTheDocument()
    })

    it('renders draft status with outline variant', () => {
      render(<StatusBadge status="draft" />)
      expect(screen.getByText('draft')).toBeInTheDocument()
    })

    it('renders pending status with outline variant', () => {
      render(<StatusBadge status="pending" />)
      expect(screen.getByText('pending')).toBeInTheDocument()
    })

    it('renders completed status with secondary variant', () => {
      render(<StatusBadge status="completed" />)
      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    it('renders failed status with destructive variant', () => {
      render(<StatusBadge status="failed" />)
      expect(screen.getByText('failed')).toBeInTheDocument()
    })
  })

  describe('handles case-insensitive status mapping', () => {
    it('maps lowercase status correctly', () => {
      render(<StatusBadge status="active" />)
      expect(screen.getByText('active')).toBeInTheDocument()
    })

    it('maps uppercase status correctly', () => {
      render(<StatusBadge status="ACTIVE" />)
      expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    })

    it('maps mixed-case status correctly', () => {
      render(<StatusBadge status="Active" />)
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })

  describe('handles unknown status with outline variant', () => {
    it('defaults unknown status to outline variant', () => {
      render(<StatusBadge status="unknown" />)
      expect(screen.getByText('unknown')).toBeInTheDocument()
    })

    it('defaults custom status to outline variant', () => {
      render(<StatusBadge status="custom-status" />)
      expect(screen.getByText('custom-status')).toBeInTheDocument()
    })
  })

  describe('respects custom variant mapping', () => {
    it('applies custom variant mapping', () => {
      const customMap = {
        active: 'destructive' as const,
        passed: 'default' as const,
      }
      render(<StatusBadge status="active" variantMap={customMap} />)
      expect(screen.getByText('active')).toBeInTheDocument()
    })

    it('falls back to outline for unmapped custom status', () => {
      const customMap = {
        active: 'default' as const,
      }
      render(<StatusBadge status="unknown" variantMap={customMap} />)
      expect(screen.getByText('unknown')).toBeInTheDocument()
    })
  })

  describe('capitalizes text', () => {
    it('renders status text capitalized', () => {
      const { container } = render(<StatusBadge status="active" />)
      const badge = container.querySelector('[class*="capitalize"]')
      expect(badge).toBeInTheDocument()
    })
  })
})
