import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ThemeToggle, ThemeSelector } from './ThemeToggle'

expect.extend(toHaveNoViolations)

// Mock the ThemeProvider context
const mockToggleTheme = vi.fn()
const mockSetTheme = vi.fn()

let mockIsDark = false
let mockIsReady = true
let mockTheme: string = 'light'

vi.mock('@/context/ThemeProvider', () => ({
  useTheme: () => ({
    isDark: mockIsDark,
    isReady: mockIsReady,
    toggleTheme: mockToggleTheme,
    theme: mockTheme,
    setTheme: mockSetTheme,
    resolvedTheme: mockIsDark ? 'dark' : 'light',
    isHighContrast: false,
  }),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockToggleTheme.mockClear()
    mockSetTheme.mockClear()
    mockIsDark = false
    mockIsReady = true
    mockTheme = 'light'
  })

  describe('Rendering', () => {
    it('renders a button element', () => {
      render(<ThemeToggle />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('shows "Switch to dark mode" label when in light mode', () => {
      mockIsDark = false
      render(<ThemeToggle />)
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to dark mode')
    })

    it('shows "Switch to light mode" label when in dark mode', () => {
      mockIsDark = true
      render(<ThemeToggle />)
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to light mode')
    })

    it('renders without label text by default', () => {
      render(<ThemeToggle />)
      // No visible label text when showLabel=false
      expect(screen.queryByText(/dark mode/i)).not.toBeInTheDocument()
    })

    it('renders label text when showLabel=true and in light mode', () => {
      mockIsDark = false
      render(<ThemeToggle showLabel />)
      expect(screen.getByText('Dark mode')).toBeInTheDocument()
    })

    it('renders label text when showLabel=true and in dark mode', () => {
      mockIsDark = true
      render(<ThemeToggle showLabel />)
      expect(screen.getByText('Light mode')).toBeInTheDocument()
    })

    it('is disabled when theme is not ready', () => {
      mockIsReady = false
      render(<ThemeToggle />)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('is enabled when theme is ready', () => {
      mockIsReady = true
      render(<ThemeToggle />)
      expect(screen.getByRole('button')).not.toBeDisabled()
    })

    it('applies custom className', () => {
      render(<ThemeToggle className="custom-class" />)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })

  describe('Interactions', () => {
    it('calls toggleTheme when clicked', async () => {
      render(<ThemeToggle />)
      await userEvent.click(screen.getByRole('button'))
      expect(mockToggleTheme).toHaveBeenCalledTimes(1)
    })

    it('does not call toggleTheme when disabled', async () => {
      mockIsReady = false
      render(<ThemeToggle />)
      await userEvent.click(screen.getByRole('button'))
      expect(mockToggleTheme).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has an aria-label', () => {
      render(<ThemeToggle />)
      const btn = screen.getByRole('button')
      expect(btn).toHaveAttribute('aria-label')
    })

    it('passes axe audit in light mode', async () => {
      mockIsDark = false
      const { container } = render(<ThemeToggle />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit in dark mode', async () => {
      mockIsDark = true
      const { container } = render(<ThemeToggle />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})

describe('ThemeSelector', () => {
  beforeEach(() => {
    mockSetTheme.mockClear()
    mockTheme = 'light'
  })

  describe('Rendering', () => {
    it('renders three theme option buttons', () => {
      render(<ThemeSelector />)
      expect(screen.getByText('Light')).toBeInTheDocument()
      expect(screen.getByText('Dark')).toBeInTheDocument()
      expect(screen.getByText('System')).toBeInTheDocument()
    })

    it('renders radiogroup with accessible label', () => {
      render(<ThemeSelector />)
      expect(screen.getByRole('radiogroup', { name: /theme/i })).toBeInTheDocument()
    })

    it('marks current theme as checked', () => {
      mockTheme = 'dark'
      render(<ThemeSelector />)
      const darkBtn = screen.getByText('Dark').closest('button')
      expect(darkBtn).toHaveAttribute('aria-checked', 'true')
    })

    it('marks non-current themes as unchecked', () => {
      mockTheme = 'light'
      render(<ThemeSelector />)
      const darkBtn = screen.getByText('Dark').closest('button')
      expect(darkBtn).toHaveAttribute('aria-checked', 'false')
    })
  })

  describe('Interactions', () => {
    it('calls setTheme with "dark" when Dark button is clicked', async () => {
      render(<ThemeSelector />)
      await userEvent.click(screen.getByText('Dark'))
      expect(mockSetTheme).toHaveBeenCalledWith('dark')
    })

    it('calls setTheme with "light" when Light button is clicked', async () => {
      render(<ThemeSelector />)
      await userEvent.click(screen.getByText('Light'))
      expect(mockSetTheme).toHaveBeenCalledWith('light')
    })

    it('calls setTheme with "system" when System button is clicked', async () => {
      render(<ThemeSelector />)
      await userEvent.click(screen.getByText('System'))
      expect(mockSetTheme).toHaveBeenCalledWith('system')
    })
  })

  describe('Accessibility', () => {
    it('each option has role="radio"', () => {
      render(<ThemeSelector />)
      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)
    })

    it('passes axe audit', async () => {
      const { container } = render(<ThemeSelector />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
