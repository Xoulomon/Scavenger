import React from 'react'
import { cn } from '@/lib/utils'

export interface OfflineStateBannerProps {
  isOnline: boolean
  onRetry?: () => Promise<void>
  message?: string
  className?: string
}

export const OfflineStateBanner: React.FC<OfflineStateBannerProps> = ({
  isOnline,
  onRetry,
  message = 'You are offline. Some features may be unavailable.',
  className,
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
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-3 shadow-lg',
        className
      )}
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
