import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { cn } from '@/lib/utils'

interface OfflineIndicatorProps {
  className?: string
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus()

  if (isOnline) {
    return null
  }

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
