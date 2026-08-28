import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { WalletModal } from '../WalletModal'

expect.extend(toHaveNoViolations)

// Mock WalletContext
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
let mockWalletState = {
  address: null as string | null,
  isConnected: false,
  isInstalled: false,
  connect: mockConnect,
  disconnect: mockDisconnect,
  isLoading: false,
  error: null as string | null,
}

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => mockWalletState,
}))

describe('WalletModal', () => {
  beforeEach(() => {
    mockConnect.mockClear()
    mockDisconnect.mockClear()
    mockWalletState = {
      address: null,
      isConnected: false,
      isInstalled: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
      isLoading: false,
      error: null,
    }
  })

  describe('Rendering — not connected', () => {
    it('renders nothing when open=false', () => {
      render(<WalletModal open={false} onOpenChange={vi.fn()} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders "Connect Wallet" title when open and not connected', () => {
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument()
    })

    it('shows Freighter wallet option', () => {
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByText('Freighter')).toBeInTheDocument()
    })

    it('shows Albedo wallet option', () => {
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByText('Albedo')).toBeInTheDocument()
    })

    it('shows Install link when Freighter is not installed', () => {
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByText('Install')).toBeInTheDocument()
    })

    it('shows Connect button when Freighter is installed', () => {
      mockWalletState.isInstalled = true
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
    })

    it('shows "Coming soon" for Albedo', () => {
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByText('Coming soon')).toBeInTheDocument()
    })

    it('renders error message when error exists', () => {
      mockWalletState.error = 'Freighter extension is not installed.'
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Freighter extension is not installed/i)).toBeInTheDocument()
    })
  })

  describe('Rendering — connected', () => {
    beforeEach(() => {
      mockWalletState.isConnected = true
      mockWalletState.address = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    })

    it('renders "Wallet Connected" title', () => {
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument()
    })

    it('shows the connected address', () => {
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByText('GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBeInTheDocument()
    })

    it('shows Disconnect button', () => {
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('calls connect() when Connect button clicked', async () => {
      mockWalletState.isInstalled = true
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      await userEvent.click(screen.getByRole('button', { name: /^connect$/i }))
      expect(mockConnect).toHaveBeenCalledTimes(1)
    })

    it('disables Connect button when isLoading=true', () => {
      mockWalletState.isInstalled = true
      mockWalletState.isLoading = true
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByRole('button', { name: /connecting/i })).toBeDisabled()
    })

    it('calls disconnect() and closes modal when Disconnect clicked', async () => {
      const onOpenChange = vi.fn()
      mockWalletState.isConnected = true
      mockWalletState.address = 'GABC...'
      render(<WalletModal open={true} onOpenChange={onOpenChange} />)
      await userEvent.click(screen.getByRole('button', { name: /disconnect/i }))
      expect(mockDisconnect).toHaveBeenCalledTimes(1)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls onOpenChange(false) when close button clicked', async () => {
      const onOpenChange = vi.fn()
      render(<WalletModal open={true} onOpenChange={onOpenChange} />)
      await userEvent.click(screen.getByLabelText(/close wallet dialog/i))
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Accessibility', () => {
    it('dialog has accessible title', () => {
      render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('passes axe audit — disconnected state', async () => {
      const { container } = render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('passes axe audit — connected state', async () => {
      mockWalletState.isConnected = true
      mockWalletState.address = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const { container } = render(<WalletModal open={true} onOpenChange={vi.fn()} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
