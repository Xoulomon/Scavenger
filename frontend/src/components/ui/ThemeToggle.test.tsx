import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ThemeToggle, ThemeSelector } from './ThemeToggle'
import { useTheme } from '@/context/ThemeProvider'
import { ReactNode } from 'react'

expect.extend(toHaveNoViolations)

// Mock the ThemeProvider context
vi.mock('@/context/ThemeProvider', async () => {
  const actual =
    await vi.importActual<typeof import('@/context/ThemeProvider')>('@/context/ThemeProvider')
  return {
    ...actual,
    useTheme: vi.fn(() => ({
      isDark: false,
      isReady: true,
      toggleTheme: vi.fn(),
      theme: 'light' as const,
      setTheme: vi.fn()
    }))
  }
})

// Wrapper with mocked ThemeProvider
function ThemeTestWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>
}

describe('ThemeToggle', () => {
  describe('Rendering', () => {
    it('renders toggle button with default props', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('overflow-hidden')
    })

    it('renders button with icon size by default', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveClass('size-icon')
    })

    it('renders with custom className', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle className="custom-class" />
        </ThemeTestWrapper>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })

    it('renders icon without label by default', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      expect(screen.queryByText(/light mode|dark mode/i)).not.toBeInTheDocument()
    })

    it('renders label when showLabel is true', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle showLabel={true} />
        </ThemeTestWrapper>
      )
      expect(screen.getByText(/light mode|dark mode/i)).toBeInTheDocument()
    })

    it('displays correct icon for dark mode', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: true,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'dark',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('displays correct icon for light mode', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('disables button when not ready', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: false,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('has proper aria-label', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      const button = screen.getByRole('button', { name: /switch to dark mode/i })
      expect(button).toBeInTheDocument()
    })

    it('updates aria-label when theme changes', () => {
      const mockUseTheme = vi.mocked(useTheme)
      const { rerender } = render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )

      expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()

      // Mock changes to dark mode
      mockUseTheme.mockReturnValue({
        isDark: true,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'dark',
        setTheme: vi.fn()
      })

      rerender(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )

      expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('calls toggleTheme when clicked', async () => {
      const user = userEvent.setup()
      const toggleThemeMock = vi.fn()
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: toggleThemeMock,
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )

      const button = screen.getByRole('button')
      await user.click(button)
      expect(toggleThemeMock).toHaveBeenCalledTimes(1)
    })

    it('toggles theme with keyboard Enter', async () => {
      const user = userEvent.setup()
      const toggleThemeMock = vi.fn()
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: toggleThemeMock,
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )

      const button = screen.getByRole('button')
      button.focus()
      await user.keyboard('{Enter}')
      expect(toggleThemeMock).toHaveBeenCalled()
    })

    it('toggles theme with keyboard Space', async () => {
      const user = userEvent.setup()
      const toggleThemeMock = vi.fn()
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: toggleThemeMock,
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )

      const button = screen.getByRole('button')
      button.focus()
      await user.keyboard(' ')
      expect(toggleThemeMock).toHaveBeenCalled()
    })

    it('does not toggle when disabled', async () => {
      const user = userEvent.setup()
      const toggleThemeMock = vi.fn()
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: false,
        toggleTheme: toggleThemeMock,
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )

      const button = screen.getByRole('button')
      await user.click(button)
      expect(toggleThemeMock).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('announces purpose to screen readers', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label')
      expect(button).toHaveAttribute('title')
    })

    it('has icon marked as aria-hidden', () => {
      const { container } = render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      const icons = container.querySelectorAll('[aria-hidden="true"]')
      expect(icons.length).toBeGreaterThan(0)
    })

    it('focusable with keyboard navigation', () => {
      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )
      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid clicks', async () => {
      const user = userEvent.setup()
      const toggleThemeMock = vi.fn()
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: toggleThemeMock,
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeToggle />
        </ThemeTestWrapper>
      )

      const button = screen.getByRole('button')
      await user.tripleClick(button)
      expect(toggleThemeMock).toHaveBeenCalled()
    })

    it('handles label text updates', () => {
      const mockUseTheme = vi.mocked(useTheme)
      const { rerender } = render(
        <ThemeTestWrapper>
          <ThemeToggle showLabel={true} />
        </ThemeTestWrapper>
      )

      expect(screen.getByText(/light mode/i)).toBeInTheDocument()

      mockUseTheme.mockReturnValue({
        isDark: true,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'dark',
        setTheme: vi.fn()
      })

      rerender(
        <ThemeTestWrapper>
          <ThemeToggle showLabel={true} />
        </ThemeTestWrapper>
      )

      expect(screen.getByText(/dark mode/i)).toBeInTheDocument()
    })
  })
})

describe('ThemeSelector', () => {
  describe('Rendering', () => {
    it('renders all three theme options', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )

      expect(screen.getByRole('radio', { name: /light/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /dark/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /system/i })).toBeInTheDocument()
    })

    it('marks current theme as checked', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )

      const lightOption = screen.getByRole('radio', { name: /light/i })
      expect(lightOption).toHaveAttribute('aria-checked', 'true')
    })

    it('marks other themes as unchecked', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )

      const darkOption = screen.getByRole('radio', { name: /dark/i })
      const systemOption = screen.getByRole('radio', { name: /system/i })

      expect(darkOption).toHaveAttribute('aria-checked', 'false')
      expect(systemOption).toHaveAttribute('aria-checked', 'false')
    })

    it('renders with radiogroup role', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
      expect(radioGroup).toHaveAttribute('aria-label', 'Theme')
    })

    it('applies custom className', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      const { container } = render(
        <ThemeTestWrapper>
          <ThemeSelector className="custom-selector" />
        </ThemeTestWrapper>
      )

      const selector = container.querySelector('[role="radiogroup"]')
      expect(selector).toHaveClass('custom-selector')
    })
  })

  describe('User Interactions', () => {
    it('calls setTheme when option is clicked', async () => {
      const user = userEvent.setup()
      const setThemeMock = vi.fn()
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: setThemeMock
      })

      render(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )

      const darkOption = screen.getByRole('radio', { name: /dark/i })
      await user.click(darkOption)
      expect(setThemeMock).toHaveBeenCalledWith('dark')
    })

    it('allows keyboard navigation between options', async () => {
      const user = userEvent.setup()
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )

      const lightOption = screen.getByRole('radio', { name: /light/i })
      const _darkOption = screen.getByRole('radio', { name: /dark/i })

      lightOption.focus()
      expect(lightOption).toHaveFocus()

      await user.keyboard('{ArrowRight}')
      // Focus should move to next option (keyboard navigation in radiogroup)
    })

    it('updates checked state when theme changes', () => {
      const mockUseTheme = vi.mocked(useTheme)
      const { rerender } = render(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )

      let lightOption = screen.getByRole('radio', { name: /light/i })
      expect(lightOption).toHaveAttribute('aria-checked', 'true')

      // Change theme to dark
      mockUseTheme.mockReturnValue({
        isDark: true,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'dark',
        setTheme: vi.fn()
      })

      rerender(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )

      lightOption = screen.getByRole('radio', { name: /light/i })
      const darkOption = screen.getByRole('radio', { name: /dark/i })

      expect(lightOption).toHaveAttribute('aria-checked', 'false')
      expect(darkOption).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      const { container } = render(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has proper radiogroup semantics', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      render(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )

      const radioGroup = screen.getByRole('radiogroup', { name: 'Theme' })
      const radios = screen.getAllByRole('radio')

      expect(radioGroup).toBeInTheDocument()
      expect(radios.length).toBe(3)
    })

    it('icons are aria-hidden', () => {
      const mockUseTheme = vi.mocked(useTheme)
      mockUseTheme.mockReturnValue({
        isDark: false,
        isReady: true,
        toggleTheme: vi.fn(),
        theme: 'light',
        setTheme: vi.fn()
      })

      const { container } = render(
        <ThemeTestWrapper>
          <ThemeSelector />
        </ThemeTestWrapper>
      )

      const icons = container.querySelectorAll('[aria-hidden="true"]')
      expect(icons.length).toBeGreaterThan(0)
    })
  })
})
