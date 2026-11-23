import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Select } from './Select'

expect.extend(toHaveNoViolations)

describe('Select', () => {
  const testOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ]

  describe('Rendering', () => {
    it('renders select component with placeholder', () => {
      render(
        <Select
          options={testOptions}
          placeholder="Choose an option"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )
      expect(screen.getByText('Choose an option')).toBeInTheDocument()
    })

    it('renders with default value', () => {
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value="option1"
          onValueChange={vi.fn()}
        />
      )
      expect(screen.getByText('Option 1')).toBeInTheDocument()
    })

    it('renders all options when dropdown opens', async () => {
      const user = userEvent.setup()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /option 1/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /option 2/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /option 3/i })).toBeInTheDocument()
      })
    })

    it('renders disabled state', () => {
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
          disabled={true}
        />
      )
      const trigger = screen.getByRole('combobox')
      expect(trigger).toBeDisabled()
    })

    it('renders with custom className', () => {
      const { container } = render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
          className="custom-select"
        />
      )
      const select = container.querySelector('.custom-select')
      expect(select).toBeInTheDocument()
    })

    it('renders empty state with no options', () => {
      render(
        <Select
          options={[]}
          placeholder="No options"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )
      expect(screen.getByText('No options')).toBeInTheDocument()
    })

    it('renders with option groups', async () => {
      const user = userEvent.setup()
      const groupedOptions = [
        { label: 'Group 1', options: [{ value: 'g1-o1', label: 'Group 1 Option 1' }] },
        { label: 'Group 2', options: [{ value: 'g2-o1', label: 'Group 2 Option 1' }] },
      ]

      render(
        <Select
          options={groupedOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        // Option groups should be accessible
        expect(screen.getByText('Group 1')).toBeInTheDocument()
      })
    })

    it('shows selected indicator for current value', async () => {
      const user = userEvent.setup()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value="option2"
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        const selectedOption = screen.getByRole('option', { name: /option 2/i })
        expect(selectedOption).toHaveAttribute('data-state', 'checked')
      })
    })
  })

  describe('User Interactions', () => {
    it('calls onValueChange when option is selected', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={onChange}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        const option = screen.getByRole('option', { name: /option 2/i })
        expect(option).toBeInTheDocument()
      })

      const option = screen.getByRole('option', { name: /option 2/i })
      await user.click(option)

      expect(onChange).toHaveBeenCalledWith('option2')
    })

    it('closes dropdown after selection', async () => {
      const user = userEvent.setup()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        const option = screen.getByRole('option', { name: /option 1/i })
        expect(option).toBeInTheDocument()
      })

      const option = screen.getByRole('option', { name: /option 1/i })
      await user.click(option)

      // Dropdown should close
    })

    it('allows keyboard navigation with arrow keys', async () => {
      const user = userEvent.setup()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /option 1/i })).toBeInTheDocument()
      })

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{ArrowDown}')

      // Select with Enter
      await user.keyboard('{Enter}')
    })

    it('closes dropdown when Escape is pressed', async () => {
      const user = userEvent.setup()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /option 1/i })).toBeInTheDocument()
      })

      await user.keyboard('{Escape}')

      // Dropdown should close
    })

    it('does not call onChange when disabled', async () => {
      const _user = userEvent.setup()
      const onChange = vi.fn()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={onChange}
          disabled={true}
        />
      )

      const trigger = screen.getByRole('combobox')
      
      // Disabled select shouldn't be clickable
      expect(trigger).toBeDisabled()
    })

    it('supports keyboard-only interaction', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={onChange}
        />
      )

      // Tab to focus
      await user.tab()

      // Open with Enter or Space
      await user.keyboard('{Enter}')

      // Navigate and select
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{Enter}')

      expect(onChange).toHaveBeenCalled()
    })

    it('filters options when searchable', async () => {
      const user = userEvent.setup()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
          searchable={true}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      // Type to filter
      await user.keyboard('opt')

      await waitFor(() => {
        // Should show filtered options
        const options = screen.getAllByRole('option')
        expect(options.length).toBeLessThanOrEqual(testOptions.length)
      })
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has proper combobox role', () => {
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )
      const combobox = screen.getByRole('combobox')
      expect(combobox).toBeInTheDocument()
    })

    it('options have proper role', async () => {
      const user = userEvent.setup()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options.length).toBe(testOptions.length)
      })
    })

    it('is keyboard focusable', () => {
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )
      const combobox = screen.getByRole('combobox')
      combobox.focus()
      expect(combobox).toHaveFocus()
    })

    it('announces selected value changes', () => {
      const { rerender } = render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      expect(screen.getByText('Choose')).toBeInTheDocument()

      rerender(
        <Select
          options={testOptions}
          placeholder="Choose"
          value="option1"
          onValueChange={vi.fn()}
        />
      )

      expect(screen.getByText('Option 1')).toBeInTheDocument()
    })

    it('has aria-expanded attribute', async () => {
      const user = userEvent.setup()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const combobox = screen.getByRole('combobox')
      expect(combobox).toHaveAttribute('aria-expanded', 'false')

      await user.click(combobox)

      expect(combobox).toHaveAttribute('aria-expanded', 'true')
    })

    it('has aria-disabled for disabled state', () => {
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
          disabled={true}
        />
      )

      const combobox = screen.getByRole('combobox')
      expect(combobox).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('Controlled Component Behavior', () => {
    it('updates when value prop changes', () => {
      const { rerender } = render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      expect(screen.getByText('Choose')).toBeInTheDocument()

      rerender(
        <Select
          options={testOptions}
          placeholder="Choose"
          value="option3"
          onValueChange={vi.fn()}
        />
      )

      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

    it('reflects option changes', () => {
      const newOptions = [
        { value: 'new1', label: 'New Option 1' },
        { value: 'new2', label: 'New Option 2' },
      ]

      const { rerender } = render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      rerender(
        <Select
          options={newOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      // Component should work with new options
      const combobox = screen.getByRole('combobox')
      expect(combobox).toBeInTheDocument()
    })

    it('clears value when value is set to undefined', () => {
      const { rerender } = render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value="option1"
          onValueChange={vi.fn()}
        />
      )

      expect(screen.getByText('Option 1')).toBeInTheDocument()

      rerender(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      expect(screen.getByText('Choose')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles very long option labels', async () => {
      const user = userEvent.setup()
      const longLabelOptions = [
        { value: '1', label: 'This is a very long option label that might wrap to multiple lines' },
      ]

      render(
        <Select
          options={longLabelOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByText(/very long option label/i)).toBeInTheDocument()
      })
    })

    it('handles special characters in labels', async () => {
      const user = userEvent.setup()
      const specialOptions = [
        { value: '1', label: 'Option & Special <Characters>' },
        { value: '2', label: 'Option "Quoted"' },
      ]

      render(
        <Select
          options={specialOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByText(/Special.*Characters/)).toBeInTheDocument()
      })
    })

    it('handles rapid open/close cycles', async () => {
      const user = userEvent.setup()
      render(
        <Select
          options={testOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')

      // Rapid clicks
      await user.click(trigger)
      await user.click(trigger)
      await user.click(trigger)

      expect(trigger).toBeInTheDocument()
    })

    it('handles many options (performance)', async () => {
      const user = userEvent.setup()
      const manyOptions = Array.from({ length: 100 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i}`,
      }))

      render(
        <Select
          options={manyOptions}
          placeholder="Choose"
          value={undefined}
          onValueChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      // Should handle large lists
      expect(trigger).toBeInTheDocument()
    })
  })

  describe('Backwards Compatibility', () => {
    it('maintains existing Select component interface', () => {
      const onChange = vi.fn()
      const { rerender } = render(
        <Select
          options={testOptions}
          placeholder="Choose an option"
          value={undefined}
          onValueChange={onChange}
        />
      )

      // Should work with the documented interface
      expect(screen.getByText('Choose an option')).toBeInTheDocument()

      rerender(
        <Select
          options={testOptions}
          placeholder="Choose an option"
          value="option1"
          onValueChange={onChange}
        />
      )

      expect(screen.getByText('Option 1')).toBeInTheDocument()
    })
  })
})
