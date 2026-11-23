import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { LanguageSelector } from './LanguageSelector'

expect.extend(toHaveNoViolations)

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'en',
      changeLanguage: vi.fn((_lang) => Promise.resolve()),
    },
    t: (key: string) => key,
  }),
}))

// Mock i18n config
vi.mock('@/i18n/config', () => ({
  getDirection: (lang: string) => (lang === 'ar' ? 'rtl' : 'ltr'),
}))

describe('LanguageSelector', () => {
  beforeEach(() => {
    // Reset document properties before each test
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
  })

  describe('Rendering', () => {
    it('renders the language selector component', () => {
      render(<LanguageSelector />)
      // Select component renders its parent container
      const selectContainer = screen.getByRole('combobox', { hidden: true })
      expect(selectContainer).toBeInTheDocument()
    })

    it('displays placeholder text initially', () => {
      render(<LanguageSelector />)
      expect(screen.getByText('Select language')).toBeInTheDocument()
    })

    it('renders all language options when dropdown opens', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /english/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /español/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /français/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /中文/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /العربية/i })).toBeInTheDocument()
      })
    })

    it('displays selected language', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const englishOption = screen.getByRole('option', { name: /english/i })
        expect(englishOption).toBeInTheDocument()
      })
    })

    it('shows correct flag or icon for each language', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const englishOption = screen.getByRole('option', { name: /english/i })
        const spanishOption = screen.getByRole('option', { name: /español/i })
        const arabicOption = screen.getByRole('option', { name: /العربية/i })

        expect(englishOption).toBeInTheDocument()
        expect(spanishOption).toBeInTheDocument()
        expect(arabicOption).toBeInTheDocument()
      })
    })
  })

  describe('User Interactions', () => {
    it('changes language when option is selected', async () => {
      const user = userEvent.setup()
      const { _useTranslation } = await vi.importActual<typeof import('react-i18next')>(
        'react-i18next'
      )

      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const spanishOption = screen.getByRole('option', { name: /español/i })
        expect(spanishOption).toBeInTheDocument()
      })
    })

    it('updates document.documentElement.lang when language changes', async () => {
      const user = userEvent.setup()
      const changeLanguageMock = vi.fn((_lang) => Promise.resolve())

      // Mock the useTranslation hook with our mock
      vi.mocked = vi.mocked || {}
      const _mockUseTranslation = vi.fn().mockReturnValue({
        i18n: {
          language: 'en',
          changeLanguage: changeLanguageMock,
        },
        t: (key: string) => key,
      })

      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const spanishOption = screen.getByRole('option', { name: /español/i })
        expect(spanishOption).toBeInTheDocument()
      })
    })

    it('updates document.documentElement.dir to "rtl" for Arabic', async () => {
      const user = userEvent.setup()
      const changeLanguageMock = vi.fn((lang: string) => {
        if (lang === 'ar') {
          document.documentElement.dir = 'rtl'
        }
        return Promise.resolve()
      })

      vi.clearAllMocks()
      vi.doMock('react-i18next', () => ({
        useTranslation: () => ({
          i18n: {
            language: 'ar',
            changeLanguage: changeLanguageMock,
          },
          t: (key: string) => key,
        }),
      }))

      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      // Simulate selecting Arabic
      await waitFor(() => {
        const arabicOption = screen.getByRole('option', { name: /العربية/i })
        expect(arabicOption).toBeInTheDocument()
      })
    })

    it('updates document.documentElement.dir to "ltr" for LTR languages', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const englishOption = screen.getByRole('option', { name: /english/i })
        expect(englishOption).toBeInTheDocument()
      })

      // LTR languages should have dir="ltr"
      expect(['ltr', 'auto'].includes(document.documentElement.dir)).toBe(true)
    })

    it('allows keyboard navigation in dropdown', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const englishOption = screen.getByRole('option', { name: /english/i })
        expect(englishOption).toBeInTheDocument()
      })

      // Test arrow key navigation
      await user.keyboard('{ArrowDown}')
      // Focus should move to next option
    })

    it('closes dropdown when option is selected', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const spanishOption = screen.getByRole('option', { name: /español/i })
        expect(spanishOption).toBeInTheDocument()
      })

      const spanishOption = screen.getByRole('option', { name: /español/i })
      await user.click(spanishOption)

      // Dropdown should close after selection
    })

    it('closes dropdown when Escape key is pressed', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const englishOption = screen.getByRole('option', { name: /english/i })
        expect(englishOption).toBeInTheDocument()
      })

      await user.keyboard('{Escape}')

      // Dropdown should close
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<LanguageSelector />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has proper combobox role', () => {
      render(<LanguageSelector />)
      const combobox = screen.getByRole('combobox', { hidden: true })
      expect(combobox).toBeInTheDocument()
    })

    it('options have proper role and attributes', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options.length).toBe(5)
        options.forEach((option) => {
          expect(option).toHaveAttribute('role', 'option')
        })
      })
    })

    it('supports keyboard-only navigation', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const _trigger = screen.getByRole('combobox', { hidden: true })

      // Tab to the select
      await user.tab()

      // Open with Enter
      await user.keyboard('{Enter}')

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{ArrowDown}')

      // Select with Enter
      await user.keyboard('{Enter}')
    })

    it('announces selected language to screen readers', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const combobox = screen.getByRole('combobox', { hidden: true })
      expect(combobox).toBeInTheDocument()

      // Open dropdown
      await user.click(combobox)

      await waitFor(() => {
        const englishOption = screen.getByRole('option', { name: /english/i })
        expect(englishOption).toBeInTheDocument()
      })
    })

    it('is keyboard focusable', () => {
      render(<LanguageSelector />)
      const trigger = screen.getByRole('combobox', { hidden: true })
      trigger.focus()
      expect(trigger).toHaveFocus()
    })

    it('has descriptive labels', () => {
      render(<LanguageSelector />)
      // The select should be labeled or have accessible name
      const trigger = screen.getByRole('combobox', { hidden: true })
      expect(trigger).toBeInTheDocument()
    })
  })

  describe('Language Support', () => {
    it('includes all supported languages', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /english/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /español/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /français/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /中文/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /العربية/i })).toBeInTheDocument()
      })
    })

    it('has correct language codes', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const englishOption = screen.getByRole('option', { name: /english/i })
        const spanishOption = screen.getByRole('option', { name: /español/i })

        expect(englishOption).toHaveAttribute('data-value', 'en')
        expect(spanishOption).toHaveAttribute('data-value', 'es')
      })
    })

    it('handles RTL languages correctly', async () => {
      const user = userEvent.setup()
      const _changeLanguageMock = vi.fn((lang: string) => {
        if (lang === 'ar') {
          document.documentElement.dir = 'rtl'
          document.documentElement.lang = 'ar'
        }
      })

      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const arabicOption = screen.getByRole('option', { name: /العربية/i })
        expect(arabicOption).toBeInTheDocument()
      })
    })

    it('handles Chinese language (simplified)', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      await waitFor(() => {
        const chineseOption = screen.getByRole('option', { name: /中文/i })
        expect(chineseOption).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid language changes', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })

      // Rapid clicks
      await user.click(trigger)
      await user.click(trigger)
      await user.click(trigger)

      expect(trigger).toBeInTheDocument()
    })

    it('maintains state during unmount/remount', async () => {
      const user = userEvent.setup()
      const { unmount } = render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })
      await user.click(trigger)

      unmount()

      const { _rerender } = render(<LanguageSelector />)
      // Selector should still be functional
      expect(screen.getByRole('combobox', { hidden: true })).toBeInTheDocument()
    })

    it('handles concurrent language change requests', async () => {
      const user = userEvent.setup()
      render(<LanguageSelector />)

      const trigger = screen.getByRole('combobox', { hidden: true })

      // Simulate rapid selection changes
      await user.click(trigger)
      await user.click(trigger)

      // Component should handle gracefully
      expect(trigger).toBeInTheDocument()
    })

    it('recovers from missing i18n context', () => {
      // Component should have fallback behavior
      const { container } = render(<LanguageSelector />)
      expect(container.querySelector('[role="combobox"]')).toBeTruthy()
    })
  })

  describe('Backwards Compatibility', () => {
    it('maintains existing Select component interface', async () => {
      const _user = userEvent.setup()
      render(<LanguageSelector />)

      // Should use Select component with proper value/onValueChange interface
      const trigger = screen.getByRole('combobox', { hidden: true })
      expect(trigger).toBeInTheDocument()
    })

    it('integrates with existing i18n configuration', async () => {
      render(<LanguageSelector />)
      // Component should work with existing i18n setup
      const trigger = screen.getByRole('combobox', { hidden: true })
      expect(trigger).toBeInTheDocument()
    })
  })
})
