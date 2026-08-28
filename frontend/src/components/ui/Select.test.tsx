import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectLabel,
  SelectGroup,
  SelectSeparator,
} from './Select'

expect.extend(toHaveNoViolations)

function SelectFixture({
  value,
  onValueChange,
  disabled,
}: {
  value?: string
  onValueChange?: (v: string) => void
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger disabled={disabled} aria-label="Fruit select">
        <SelectValue placeholder="Pick a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
      </SelectContent>
    </Select>
  )
}

describe('Select', () => {
  describe('Rendering', () => {
    it('renders placeholder when no value selected', () => {
      render(<SelectFixture />)
      expect(screen.getByText('Pick a fruit')).toBeInTheDocument()
    })

    it('renders selected value', () => {
      render(<SelectFixture value="apple" />)
      expect(screen.getByText('Apple')).toBeInTheDocument()
    })

    it('renders trigger with accessible label', () => {
      render(<SelectFixture />)
      expect(screen.getByLabelText('Fruit select')).toBeInTheDocument()
    })

    it('renders chevron icon in trigger', () => {
      const { container } = render(<SelectFixture />)
      // Lucide chevron renders as an SVG
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Interaction', () => {
    it('opens dropdown when trigger is clicked', async () => {
      render(<SelectFixture />)
      const trigger = screen.getByRole('combobox')
      await userEvent.click(trigger)
      await waitFor(() => {
        expect(screen.getByText('Apple')).toBeVisible()
      })
    })

    it('calls onValueChange when an item is selected', async () => {
      const handleChange = vi.fn()
      render(<SelectFixture onValueChange={handleChange} />)
      await userEvent.click(screen.getByRole('combobox'))
      await waitFor(() => screen.getByText('Banana'))
      await userEvent.click(screen.getByText('Banana'))
      expect(handleChange).toHaveBeenCalledWith('banana')
    })

    it('is disabled when disabled prop is set', () => {
      render(<SelectFixture disabled />)
      expect(screen.getByRole('combobox')).toBeDisabled()
    })
  })

  describe('Subcomponents', () => {
    it('renders SelectLabel', () => {
      render(
        <Select>
          <SelectTrigger aria-label="Grouped select">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fruits</SelectLabel>
              <SelectItem value="apple">Apple</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      )
      expect(screen.getByText('Fruits')).toBeInTheDocument()
    })

    it('renders SelectSeparator without crashing', () => {
      const { container } = render(
        <Select>
          <SelectTrigger aria-label="Sep select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
            <SelectSeparator />
            <SelectItem value="b">B</SelectItem>
          </SelectContent>
        </Select>
      )
      expect(container).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('trigger has combobox role', () => {
      render(<SelectFixture />)
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('trigger passes axe audit', async () => {
      const { container } = render(<SelectFixture />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
