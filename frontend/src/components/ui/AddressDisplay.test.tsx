import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { AddressDisplay } from './AddressDisplay'

expect.extend(toHaveNoViolations)

// Mock clipboard API
const mockClipboardWrite = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockClipboardWrite,
  },
})

// Mock config
vi.mock('@/config', () => ({
  config: {
    network: 'TESTNET',
  },
}))

describe('AddressDisplay', () => {
  beforeEach(() => {
    mockClipboardWrite.mockClear()
    mockClipboardWrite.mockResolvedValue(undefined)
  })

  describe('Rendering', () => {
    it('renders truncated address', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      render(<AddressDisplay address={address} />)

      const truncated = screen.getByText(/GBR…63XY/i)
      expect(truncated).toBeInTheDocument()
    })

    it('respects custom chars parameter', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      render(<AddressDisplay address={address} chars={6} />)

      const truncated = screen.getByText(/GBRPYH…BD63XY/i)
      expect(truncated).toBeInTheDocument()
    })

    it('displays full address in title attribute', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      render(<AddressDisplay address={address} />)

      const addressSpan = screen.getByLabelText(address)
      expect(addressSpan).toHaveAttribute('title', address)
    })

    it('renders with default characters (4)', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      const { container } = render(<AddressDisplay address={address} />)

      const addressDisplay = container.querySelector('span[class*="font-mono"]')
      expect(addressDisplay?.textContent).toMatch(/GBR…63XY/)
    })

    it('applies custom className', () => {
      const { container } = render(
        <AddressDisplay address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY" className="custom-class" />
      )

      expect(container.querySelector('.custom-class')).toBeInTheDocument()
    })

    it('renders monospace font for address', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      const { container } = render(<AddressDisplay address={address} />)

      const addressSpan = container.querySelector('[class*="font-mono"]')
      expect(addressSpan).toHaveClass('font-mono')
    })

    it('renders copy button', () => {
      render(<AddressDisplay address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY" />)

      const copyButton = screen.getByRole('button', { name: /copy address/i })
      expect(copyButton).toBeInTheDocument()
    })

    it('does not render explorer link by default', () => {
      render(
        <AddressDisplay
          address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY"
          showExplorer={false}
        />
      )

      const explorerLink = screen.queryByLabelText(/view on stellar expert/i)
      expect(explorerLink).not.toBeInTheDocument()
    })

    it('renders explorer link when showExplorer is true', () => {
      render(
        <AddressDisplay
          address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY"
          showExplorer={true}
        />
      )

      const explorerLink = screen.getByRole('link', { name: /view on stellar expert/i })
      expect(explorerLink).toBeInTheDocument()
      expect(explorerLink).toHaveAttribute('target', '_blank')
      expect(explorerLink).toHaveAttribute('rel', 'noreferrer')
    })
  })

  describe('Copy Functionality', () => {
    it('copies address to clipboard when button clicked', async () => {
      const user = userEvent.setup()
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      render(<AddressDisplay address={address} />)

      const copyButton = screen.getByRole('button', { name: /copy address/i })
      await user.click(copyButton)

      expect(mockClipboardWrite).toHaveBeenCalledWith(address)
    })

    it('shows check icon after copying', async () => {
      const user = userEvent.setup()
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      const { container } = render(<AddressDisplay address={address} />)

      const copyButton = screen.getByRole('button', { name: /copy address/i })
      await user.click(copyButton)

      // Check icon should be visible after copy
      await waitFor(() => {
        const checkIcon = container.querySelector('[class*="text-green"]')
        expect(checkIcon).toBeInTheDocument()
      })
    })

    it('announces copy to screen readers', async () => {
      const user = userEvent.setup()
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      render(<AddressDisplay address={address} />)

      const copyButton = screen.getByRole('button', { name: /copy address/i })
      await user.click(copyButton)

      await waitFor(() => {
        const status = screen.getByRole('status')
        expect(status).toHaveTextContent('Address copied to clipboard.')
      })
    })

    it('resets copy icon after 1.5 seconds', async () => {
      vi.useFakeTimers()
      const user = userEvent.setup({ delay: null })
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      const { container } = render(<AddressDisplay address={address} />)

      const copyButton = screen.getByRole('button', { name: /copy address/i })
      await user.click(copyButton)

      // Check that copy icon is shown
      await waitFor(() => {
        expect(container.querySelector('[class*="text-green"]')).toBeInTheDocument()
      })

      // Fast forward time
      vi.advanceTimersByTime(1500)

      // Icon should reset
      await waitFor(() => {
        expect(container.querySelector('[class*="text-green"]')).not.toBeInTheDocument()
      })

      vi.useRealTimers()
    })

    it('copy button is keyboard accessible', async () => {
      const user = userEvent.setup()
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      render(<AddressDisplay address={address} />)

      const copyButton = screen.getByRole('button', { name: /copy address/i })
      copyButton.focus()
      expect(copyButton).toHaveFocus()

      await user.keyboard('{Enter}')
      expect(mockClipboardWrite).toHaveBeenCalledWith(address)
    })

    it('handles clipboard write errors gracefully', async () => {
      const user = userEvent.setup()
      mockClipboardWrite.mockRejectedValue(new Error('Clipboard denied.'))
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'

      render(<AddressDisplay address={address} />)

      const copyButton = screen.getByRole('button', { name: /copy address/i })
      // Should not throw
      await user.click(copyButton)
    })
  })

  describe('Explorer Link', () => {
    it('generates correct explorer URL for address', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      render(
        <AddressDisplay address={address} showExplorer={true} />
      )

      const explorerLink = screen.getByRole('link')
      expect(explorerLink).toHaveAttribute(
        'href',
        expect.stringContaining(address)
      )
    })

    it('opens explorer in new tab', () => {
      render(
        <AddressDisplay
          address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY"
          showExplorer={true}
        />
      )

      const explorerLink = screen.getByRole('link')
      expect(explorerLink).toHaveAttribute('target', '_blank')
      expect(explorerLink).toHaveAttribute('rel', 'noreferrer')
    })

    it('explorer link has proper title', () => {
      render(
        <AddressDisplay
          address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY"
          showExplorer={true}
        />
      )

      const explorerLink = screen.getByRole('link')
      expect(explorerLink).toHaveAttribute('title', 'View on Stellar Expert')
    })
  })

  describe('Accessibility', () => {
    it('address has proper aria-label', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      render(<AddressDisplay address={address} />)

      const addressSpan = screen.getByLabelText(address)
      expect(addressSpan).toBeInTheDocument()
    })

    it('copy button has accessible label', () => {
      render(<AddressDisplay address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY" />)

      const copyButton = screen.getByRole('button', { name: /copy address/i })
      expect(copyButton).toHaveAttribute('aria-label', 'Copy address')
    })

    it('copy status region has aria-live', () => {
      render(<AddressDisplay address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY" />)

      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
    })

    it('explorer link has accessible label', () => {
      render(
        <AddressDisplay
          address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY"
          showExplorer={true}
        />
      )

      const explorerLink = screen.getByRole('link', { name: /view on stellar expert/i })
      expect(explorerLink).toHaveAttribute('aria-label', 'View on Stellar Expert')
    })

    it('has focus indicators on interactive elements', () => {
      const { container } = render(
        <AddressDisplay
          address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY"
          showExplorer={true}
        />
      )

      const buttons = container.querySelectorAll('button, a')
      buttons.forEach((button) => {
        expect(button).toHaveClass('focus-visible:ring-2')
      })
    })

    it('passes axe accessibility audit', async () => {
      const { container } = render(
        <AddressDisplay
          address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY"
          showExplorer={true}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('without explorer link passes accessibility', async () => {
      const { container } = render(
        <AddressDisplay
          address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY"
          showExplorer={false}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Interactions', () => {
    it('receives focus on copy button', async () => {
      const user = userEvent.setup()
      render(<AddressDisplay address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY" />)

      const copyButton = screen.getByRole('button')
      await user.click(copyButton)
      expect(copyButton).toHaveFocus()
    })

    it('tab navigation works through interactive elements', async () => {
      const user = userEvent.setup()
      render(
        <AddressDisplay
          address="GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY"
          showExplorer={true}
        />
      )

      const copyButton = screen.getByRole('button')
      const explorerLink = screen.getByRole('link')

      // Tab to copy button
      await user.tab()
      expect(copyButton).toHaveFocus()

      // Tab to explorer link
      await user.tab()
      expect(explorerLink).toHaveFocus()
    })
  })

  describe('Edge Cases', () => {
    it('handles very short addresses', () => {
      render(<AddressDisplay address="TEST" chars={1} />)
      expect(screen.getByText(/T…T/)).toBeInTheDocument()
    })

    it('handles large chars parameter', () => {
      const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY4T4EISLE5MXE3EBBD63XY'
      render(<AddressDisplay address={address} chars={20} />)

      const truncated = screen.getByText(/GBRPYHIL2CI3WHZDTOOQ…ISLE5MXE3EBBD63XY/)
      expect(truncated).toBeInTheDocument()
    })

    it('handles empty address gracefully', () => {
      const { container } = render(<AddressDisplay address="" />)
      expect(container).toBeInTheDocument()
    })
  })
})
