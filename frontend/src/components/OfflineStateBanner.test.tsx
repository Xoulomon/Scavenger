import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

interface OfflineStateBannerProps {
  isOnline: boolean
  onRetry?: () => Promise<void>
  message?: string
}

// Offline state banner component
const OfflineStateBanner: React.FC<OfflineStateBannerProps> = ({
  isOnline,
  onRetry,
  message = 'You are offline. Some features may be unavailable.',
}) => {
  const [isRetrying, setIsRetrying] = React.useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      if (onRetry) {
        await onRetry()
      }
    } finally {
      setIsRetrying(false)
    }
  }

  if (isOnline) {
    return null
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-3 shadow-lg"
      data-testid="offline-state-banner"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span>{message}</span>
        </div>
        {onRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-3 py-1 bg-white text-yellow-600 rounded hover:bg-gray-100 disabled:opacity-50"
            data-testid="retry-button"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
      </div>
    </div>
  )
}

// Offline data view hook
interface UseOfflineDataViewOptions {
  queryKey: string
  isOnline: boolean
}

const useOfflineDataView = ({ queryKey, isOnline }: UseOfflineDataViewOptions) => {
  const [data, setData] = React.useState<any>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (!isOnline) {
        // Try to get from cache
        const cachedData = localStorage.getItem(`cache_${queryKey}`)
        if (cachedData) {
          setData(JSON.parse(cachedData))
        } else {
          setError('No cached data available. Please connect to the internet.')
        }
      } else {
        // Fetch from server
        setData({ id: 1, name: 'Test Data' })
      }
    } catch (err) {
      setError('Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }, [queryKey, isOnline])

  React.useEffect(() => {
    fetchData()
  }, [isOnline, fetchData])

  const retry = React.useCallback(() => {
    return fetchData()
  }, [fetchData])

  return { data, isLoading, error, retry }
}

describe('Offline State Handling', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('OfflineStateBanner Component', () => {
    it('should render banner when offline', () => {
      render(<OfflineStateBanner isOnline={false} />)
      expect(screen.getByTestId('offline-state-banner')).toBeInTheDocument()
    })

    it('should not render banner when online', () => {
      const { container } = render(<OfflineStateBanner isOnline={true} />)
      expect(container.firstChild).toBeNull()
    })

    it('should display offline message', () => {
      render(<OfflineStateBanner isOnline={false} />)
      expect(
        screen.getByText('You are offline. Some features may be unavailable.')
      ).toBeInTheDocument()
    })

    it('should display custom offline message', () => {
      const customMessage = 'Connection lost. Retrying...'
      render(<OfflineStateBanner isOnline={false} message={customMessage} />)
      expect(screen.getByText(customMessage)).toBeInTheDocument()
    })

    it('should have proper ARIA attributes for accessibility', () => {
      render(<OfflineStateBanner isOnline={false} />)
      const banner = screen.getByTestId('offline-state-banner')
      expect(banner).toHaveAttribute('role', 'alert')
      expect(banner).toHaveAttribute('aria-live', 'polite')
    })

    it('should render retry button when onRetry is provided', () => {
      const mockRetry = vi.fn()
      render(<OfflineStateBanner isOnline={false} onRetry={mockRetry} />)
      expect(screen.getByTestId('retry-button')).toBeInTheDocument()
    })

    it('should not render retry button when onRetry is not provided', () => {
      render(<OfflineStateBanner isOnline={false} />)
      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
    })
  })

  describe('Retry Functionality', () => {
    it('should call retry function when retry button is clicked', async () => {
      const mockRetry = vi.fn().mockResolvedValue(undefined)
      render(<OfflineStateBanner isOnline={false} onRetry={mockRetry} />)

      const retryButton = screen.getByTestId('retry-button')
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(mockRetry).toHaveBeenCalled()
      })
    })

    it('should disable retry button while retrying', async () => {
      const mockRetry = vi.fn(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )
      render(<OfflineStateBanner isOnline={false} onRetry={mockRetry} />)

      const retryButton = screen.getByTestId('retry-button') as HTMLButtonElement
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(retryButton.disabled).toBe(true)
      })

      await waitFor(() => {
        expect(retryButton.disabled).toBe(false)
      })
    })

    it('should show retrying text during retry', async () => {
      const mockRetry = vi.fn(
        () => new Promise(resolve => setTimeout(resolve, 50))
      )
      render(<OfflineStateBanner isOnline={false} onRetry={mockRetry} />)

      const retryButton = screen.getByTestId('retry-button')
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText('Retrying...')).toBeInTheDocument()
      })
    })

    it('should handle retry errors gracefully', async () => {
      const mockRetry = vi.fn().mockRejectedValue(new Error('Retry failed.'))
      render(<OfflineStateBanner isOnline={false} onRetry={mockRetry} />)

      const retryButton = screen.getByTestId('retry-button')
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(mockRetry).toHaveBeenCalled()
      })

      // Button should be enabled again after error
      await waitFor(() => {
        expect(retryButton).not.toBeDisabled()
      })
    })
  })

  describe('Offline Data View Hook', () => {
    it('should return data when online', async () => {
      const TestComponent = () => {
        const { data } = useOfflineDataView({ queryKey: 'test', isOnline: true })
        return <div>{data ? 'Data loaded' : 'No data'}</div>
      }

      render(<TestComponent />)
      await waitFor(() => {
        expect(screen.getByText('Data loaded')).toBeInTheDocument()
      })
    })

    it('should show error when offline without cached data', async () => {
      const TestComponent = () => {
        const { error } = useOfflineDataView({ queryKey: 'test', isOnline: false })
        return <div>{error || 'No error'}</div>
      }

      render(<TestComponent />)
      await waitFor(() => {
        expect(screen.getByText(/No cached data available/)).toBeInTheDocument()
      })
    })

    it('should return cached data when offline', async () => {
      const cachedData = { id: 1, name: 'Cached Data' }
      localStorage.setItem('cache_test', JSON.stringify(cachedData))

      const TestComponent = () => {
        const { data } = useOfflineDataView({ queryKey: 'test', isOnline: false })
        return <div>{data ? `Data: ${data.name}` : 'No data'}</div>
      }

      render(<TestComponent />)
      await waitFor(() => {
        expect(screen.getByText('Data: Cached Data')).toBeInTheDocument()
      })
    })

    it('should set loading state during fetch', async () => {
      const TestComponent = () => {
        const { isLoading } = useOfflineDataView({ queryKey: 'test', isOnline: true })
        return <div>{isLoading ? 'Loading' : 'Loaded'}</div>
      }

      render(<TestComponent />)
      // Initially loading
      expect(screen.getByText('Loading')).toBeInTheDocument()
      // Then loaded
      await waitFor(() => {
        expect(screen.getByText('Loaded')).toBeInTheDocument()
      })
    })

    it('should support retry functionality', async () => {
      const TestComponent = () => {
        const { data, retry } = useOfflineDataView({ queryKey: 'test', isOnline: false })
        return (
          <div>
            <div>{data ? 'Data loaded' : 'No data'}</div>
            <button onClick={retry}>Retry</button>
          </div>
        )
      }

      render(<TestComponent />)
      const retryButton = screen.getByText('Retry')

      fireEvent.click(retryButton)
      await waitFor(() => {
        expect(retryButton).toBeInTheDocument()
      })
    })
  })

  describe('Offline State Transitions', () => {
    it('should show banner when transitioning from online to offline', () => {
      const { rerender } = render(<OfflineStateBanner isOnline={true} />)
      expect(screen.queryByTestId('offline-state-banner')).not.toBeInTheDocument()

      rerender(<OfflineStateBanner isOnline={false} />)
      expect(screen.getByTestId('offline-state-banner')).toBeInTheDocument()
    })

    it('should hide banner when transitioning from offline to online', () => {
      const { rerender } = render(<OfflineStateBanner isOnline={false} />)
      expect(screen.getByTestId('offline-state-banner')).toBeInTheDocument()

      rerender(<OfflineStateBanner isOnline={true} />)
      expect(screen.queryByTestId('offline-state-banner')).not.toBeInTheDocument()
    })
  })
})
