import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { RolePicker } from './RolePicker'
import { Role } from '@/api/types'

expect.extend(toHaveNoViolations)

describe('RolePicker', () => {
  describe('Rendering', () => {
    it('renders all three role options', () => {
      render(<RolePicker onChange={vi.fn()} />)
      expect(screen.getByText('Recycler')).toBeInTheDocument()
      expect(screen.getByText('Collector')).toBeInTheDocument()
      expect(screen.getByText('Manufacturer')).toBeInTheDocument()
    })

    it('renders role descriptions', () => {
      render(<RolePicker onChange={vi.fn()} />)
      expect(screen.getByText(/Submit and track waste materials/i)).toBeInTheDocument()
      expect(screen.getByText(/Collect and transfer waste/i)).toBeInTheDocument()
      expect(screen.getByText(/Set incentives and confirm/i)).toBeInTheDocument()
    })

    it('renders a radiogroup with accessible label', () => {
      render(<RolePicker onChange={vi.fn()} />)
      expect(screen.getByRole('radiogroup', { name: /select your role/i })).toBeInTheDocument()
    })

    it('renders three radio buttons', () => {
      render(<RolePicker onChange={vi.fn()} />)
      expect(screen.getAllByRole('radio')).toHaveLength(3)
    })

    it('marks no option as selected by default', () => {
      render(<RolePicker onChange={vi.fn()} />)
      const radios = screen.getAllByRole('radio')
      radios.forEach((r) => expect(r).toHaveAttribute('aria-checked', 'false'))
    })

    it('marks the provided value as selected', () => {
      render(<RolePicker value={Role.Collector} onChange={vi.fn()} />)
      const collectorBtn = screen.getByText('Collector').closest('button')!
      expect(collectorBtn).toHaveAttribute('aria-checked', 'true')
    })

    it('marks non-selected roles as unchecked', () => {
      render(<RolePicker value={Role.Recycler} onChange={vi.fn()} />)
      const collectorBtn = screen.getByText('Collector').closest('button')!
      expect(collectorBtn).toHaveAttribute('aria-checked', 'false')
    })

    it('applies custom className', () => {
      render(<RolePicker onChange={vi.fn()} className="custom-grid" />)
      expect(screen.getByRole('radiogroup')).toHaveClass('custom-grid')
    })
  })

  describe('Interactions', () => {
    it('calls onChange with Recycler when Recycler option is clicked', async () => {
      const handleChange = vi.fn()
      render(<RolePicker onChange={handleChange} />)
      await userEvent.click(screen.getByText('Recycler'))
      expect(handleChange).toHaveBeenCalledWith(Role.Recycler)
    })

    it('calls onChange with Collector when Collector option is clicked', async () => {
      const handleChange = vi.fn()
      render(<RolePicker onChange={handleChange} />)
      await userEvent.click(screen.getByText('Collector'))
      expect(handleChange).toHaveBeenCalledWith(Role.Collector)
    })

    it('calls onChange with Manufacturer when Manufacturer option is clicked', async () => {
      const handleChange = vi.fn()
      render(<RolePicker onChange={handleChange} />)
      await userEvent.click(screen.getByText('Manufacturer'))
      expect(handleChange).toHaveBeenCalledWith(Role.Manufacturer)
    })

    it('calls onChange when Enter key is pressed on an option', async () => {
      const handleChange = vi.fn()
      render(<RolePicker onChange={handleChange} />)
      const recyclerBtn = screen.getByText('Recycler').closest('button')!
      recyclerBtn.focus()
      await userEvent.keyboard('{Enter}')
      expect(handleChange).toHaveBeenCalledWith(Role.Recycler)
    })

    it('calls onChange when Space key is pressed on an option', async () => {
      const handleChange = vi.fn()
      render(<RolePicker onChange={handleChange} />)
      const recyclerBtn = screen.getByText('Recycler').closest('button')!
      recyclerBtn.focus()
      await userEvent.keyboard(' ')
      expect(handleChange).toHaveBeenCalledWith(Role.Recycler)
    })
  })

  describe('Accessibility', () => {
    it('each role button has role="radio"', () => {
      render(<RolePicker onChange={vi.fn()} />)
      expect(screen.getAllByRole('radio')).toHaveLength(3)
    })

    it('role buttons have visible focus ring class', () => {
      render(<RolePicker onChange={vi.fn()} />)
      const btns = screen.getAllByRole('radio')
      btns.forEach((btn) =>
        expect(btn).toHaveClass('focus-visible:ring-2')
      )
    })

    it('passes axe audit without selection', async () => {
      const { container } = render(<RolePicker onChange={vi.fn()} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit with a role selected', async () => {
      const { container } = render(<RolePicker value={Role.Manufacturer} onChange={vi.fn()} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
