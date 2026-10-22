import React from 'react'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { cn } from '@/lib/utils'

export interface OfflineStatusProps {
  /** `indicator` is a compact pill; `banner` is a full-width alert with optional retry. */
  variant?: 'indicator' | 'banner'
  /** Overrides the connectivity hook (used by the banner when the parent already tracks it). */
  isOnline?: boolean
  onRetry?: () => Promise<void>
  message?: string
  className?: string
}

export const DEFAULT_OFFLINE_MESSAGE = 'You are offline. Some features may be unavailable.'

export function OfflineStatus({
  variant = 'indicator',
  isOnline: isOnlineProp,
  onRetry,
  message = DEFAULT_OFFLINE_MESSAGE,
  className,
}: OfflineStatusProps) {
  const hookOnline = useOnlineStatus()
  const isOnline = isOnlineProp ?? hookOnline
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

  if (variant === 'indicator') {
    return (
      <div
        className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg shadow-lg',
          className
        )}
        data-testid="offline-indicator"
      >
        <WifiOff className="h-4 w-4" data-testid="wifi-off-icon" />
        <span className="text-sm font-medium">Offline</span>
      </div>
    )
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
