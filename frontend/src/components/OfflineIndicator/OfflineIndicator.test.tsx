import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OfflineIndicator } from './index'

// Mock the useOnlineStatus hook
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}))

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

describe('OfflineIndicator', () => {
  it('should show offline indicator when offline', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)

    render(<OfflineIndicator />)

    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument()
  })

  it('should not show indicator when online', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(true)

    render(<OfflineIndicator />)

    expect(screen.queryByText('Offline')).not.toBeInTheDocument()
  })
})
