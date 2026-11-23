import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCircle, Coins, Info, X, Settings } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Notification, NotificationType } from '@/lib/notifications'

// ---------------------------------------------------------------------------
// Helpers (pure — also used by property tests)
// ---------------------------------------------------------------------------

/** Returns the display label for the unread badge. */
export function getBadgeLabel(unreadCount: number): string {
  return unreadCount > 99 ? '99+' : String(unreadCount)
}

/** Returns the capped badge count value (max 99). */
export function getBadgeCount(unreadCount: number): number {
  return Math.min(unreadCount, 99)
}

/** Sorts notifications descending by createdAt and caps at 20. */
export function getPanelNotifications(notifications: Notification[]): Notification[] {
  return [...notifications].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)
}

/** Returns a relative timestamp string for a given Unix ms timestamp. */
export function getRelativeTimestamp(createdAt: number): string {
  const diffMs = Date.now() - createdAt
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
}

/** Returns the icon component name for a notification type. */
export function getTypeIconName(type: NotificationType): string {
  switch (type) {
    case 'transfer':
      return 'Bell'
    case 'confirmation':
      return 'CheckCircle'
    case 'reward':
      return 'Coins'
    case 'system':
    default:
      return 'Info'
  }
}

// ---------------------------------------------------------------------------
// Type icon component
// ---------------------------------------------------------------------------

function TypeIcon({ type, className }: { type: NotificationType; className?: string }) {
  const cls = cn('h-4 w-4 shrink-0', className)
  switch (type) {
    case 'transfer':
      return <Bell className={cls} />
    case 'confirmation':
      return <CheckCircle className={cls} />
    case 'reward':
      return <Coins className={cls} />
    case 'system':
    default:
      return <Info className={cls} />
  }
}

// ---------------------------------------------------------------------------
// NotificationPanel
// ---------------------------------------------------------------------------

interface NotificationPanelProps {
  notifications: Notification[]
  onClose: () => void
  onMarkRead: (id: string) => Promise<void>
  onMarkAllRead: () => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function NotificationPanel({
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDelete
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const items = getPanelNotifications(notifications)

  // Click-outside closes the panel
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-popover text-popover-foreground shadow-lg sm:w-96"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Notifications</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs"
          onClick={() => void onMarkAllRead()}
        >
          Mark all as read
        </Button>
      </div>

      {/* List */}
      <ul className="max-h-96 overflow-y-auto divide-y">
        {items.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</li>
        ) : (
          items.map((n) => (
            <li
              key={n.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-accent',
                !n.read && 'bg-accent/30'
              )}
              onClick={() => void onMarkRead(n.id)}
            >
              <TypeIcon
                type={n.type}
                className={cn(
                  'mt-0.5',
                  n.type === 'transfer' && 'text-blue-500',
                  n.type === 'confirmation' && 'text-green-500',
                  n.type === 'reward' && 'text-yellow-500',
                  n.type === 'system' && 'text-muted-foreground'
                )}
              />
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-medium', !n.read && 'font-semibold')}>
                  {n.title}
                  {n.count > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">×{n.count}</span>
                  )}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {getRelativeTimestamp(n.createdAt)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Delete notification"
                className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation()
                  void onDelete(n.id)
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))
        )}
      </ul>

      {/* Footer */}
      <div className="border-t px-4 py-2">
        <Link
          to="/settings"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <Settings className="h-3.5 w-3.5" />
          Notification preferences →
        </Link>
      </div>
    </div>
  )
}
