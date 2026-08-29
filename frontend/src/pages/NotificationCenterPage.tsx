import { useState } from 'react'
import { Bell, Trash2, CheckCheck, Volume2, VolumeX, Settings } from 'lucide-react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useNotifications } from '@/hooks/useNotifications'
import { useWallet } from '@/context/WalletContext'
import { NotificationStore, type NotificationType, type NotificationPreferences } from '@/lib/notifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

const NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string }[] = [
  { type: 'transfer', label: 'Transfers', description: 'Waste transfer updates' },
  { type: 'confirmation', label: 'Confirmations', description: 'Waste confirmation status' },
  { type: 'reward', label: 'Rewards', description: 'Token rewards and incentives' },
  { type: 'system', label: 'System', description: 'Platform announcements' },
]

function getRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function typeColor(type: NotificationType) {
  return {
    transfer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    confirmation: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    reward: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    system: 'bg-muted text-muted-foreground',
  }[type]
}

export function NotificationCenterPage() {
  useAppTitle('Notification Center')
  const { address } = useWallet()
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification } =
    useNotifications(address)

  const [prefs, setPrefs] = useState<NotificationPreferences>(() => NotificationStore.loadPrefs())
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem('scavngr_notif_sound') !== 'off'
  )
  const [filter, setFilter] = useState<NotificationType | 'all'>('all')

  const displayed = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter)

  function togglePref(type: NotificationType) {
    const next = { ...prefs, [type]: !prefs[type] }
    setPrefs(next)
    NotificationStore.savePrefs(next)
  }

  function toggleSound() {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem('scavngr_notif_sound', next ? 'on' : 'off')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Notification Center</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={toggleSound} aria-label="Toggle sound">
            {soundEnabled ? <Volume2 className="h-4 w-4 mr-1.5" /> : <VolumeX className="h-4 w-4 mr-1.5" />}
            Sound {soundEnabled ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            <CheckCheck className="h-4 w-4 mr-1.5" />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* History */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2">
            {(['all', ...NOTIFICATION_TYPES.map((t) => t.type)] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  filter === t
                    ? 'bg-primary text-primary-foreground'
                    : 'border hover:bg-accent'
                )}
              >
                {t === 'all' ? 'All' : NOTIFICATION_TYPES.find((x) => x.type === t)?.label}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {displayed.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No notifications
                </p>
              ) : (
                <ul className="divide-y">
                  {displayed.map((n) => (
                    <li
                      key={n.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors',
                        !n.read && 'bg-accent/20'
                      )}
                    >
                      <span className={cn('mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0', typeColor(n.type))}>
                        {n.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', !n.read && 'font-semibold')}>
                          {n.title}
                          {n.count > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">×{n.count}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{getRelativeTime(n.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!n.read && (
                          <button
                            onClick={() => void markRead(n.id)}
                            aria-label="Mark as read"
                            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => void deleteNotification(n.id)}
                          aria-label="Delete notification"
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-accent"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preferences */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" />
                Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {NOTIFICATION_TYPES.map(({ type, label, description }) => (
                <div key={type} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    checked={prefs[type]}
                    onCheckedChange={() => togglePref(type)}
                    aria-label={`Toggle ${label}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Badge summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Badge Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {NOTIFICATION_TYPES.map(({ type, label }) => {
                const count = notifications.filter((n) => n.type === type && !n.read).length
                return (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    {count > 0 ? (
                      <Badge variant="default" className="min-w-[1.5rem] justify-center">
                        {count}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
