import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OfflineStatus, DEFAULT_OFFLINE_MESSAGE } from './index'

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}))

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

describe('OfflineStatus', () => {
  beforeEach(() => {
    vi.mocked(useOnlineStatus).mockReturnValue(true)
  })

  describe('indicator variant', () => {
    it('renders the Offline pill when offline', () => {
      vi.mocked(useOnlineStatus).mockReturnValue(false)
      render(<OfflineStatus variant="indicator" />)

      expect(screen.getByTestId('offline-indicator')).toBeInTheDocument()
      expect(screen.getByText('Offline')).toBeInTheDocument()
      expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument()
    })

    it('renders nothing when online', () => {
      render(<OfflineStatus variant="indicator" />)
      expect(screen.queryByTestId('offline-indicator')).not.toBeInTheDocument()
    })

    it('defaults to the indicator variant', () => {
      vi.mocked(useOnlineStatus).mockReturnValue(false)
      render(<OfflineStatus />)
      expect(screen.getByTestId('offline-indicator')).toBeInTheDocument()
    })
  })

  describe('banner variant', () => {
    it('renders the default message as an alert when offline', () => {
      render(<OfflineStatus variant="banner" isOnline={false} />)

      const banner = screen.getByTestId('offline-state-banner')
      expect(banner).toHaveAttribute('role', 'alert')
      expect(banner).toHaveAttribute('aria-live', 'polite')
      expect(screen.getByText(DEFAULT_OFFLINE_MESSAGE)).toBeInTheDocument()
    })

    it('renders a custom message', () => {
      render(<OfflineStatus variant="banner" isOnline={false} message="No network" />)
      expect(screen.getByText('No network')).toBeInTheDocument()
    })

    it('renders nothing when isOnline is true, even if the hook reports offline', () => {
      vi.mocked(useOnlineStatus).mockReturnValue(false)
      render(<OfflineStatus variant="banner" isOnline={true} />)
      expect(screen.queryByTestId('offline-state-banner')).not.toBeInTheDocument()
    })

    it('omits the retry button when no onRetry is given', () => {
      render(<OfflineStatus variant="banner" isOnline={false} />)
      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
    })

    it('calls onRetry and disables the button while retrying', async () => {
      let resolveRetry: () => void = () => {}
      const onRetry = vi.fn(
        () => new Promise<void>((resolve) => { resolveRetry = resolve })
      )
      render(<OfflineStatus variant="banner" isOnline={false} onRetry={onRetry} />)

      const button = screen.getByTestId('retry-button')
      fireEvent.click(button)

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(button).toBeDisabled()
      expect(button).toHaveTextContent('Retrying...')

      resolveRetry()
      await waitFor(() => expect(button).not.toBeDisabled())
      expect(button).toHaveTextContent('Retry')
    })
  })
})
