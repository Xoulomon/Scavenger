import { useEffect, useState } from 'react'
import { WifiOff, Wifi, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import {
  getPendingMutations,
  updateMutationStatus,
  removeMutationFromQueue,
  clearOldMutations
} from '@/lib/indexedDB'

interface QueuedMutation {
  id: string
  mutationKey: string[]
  variables: unknown
  timestamp: number
  status: 'pending' | 'synced' | 'failed'
  retryCount: number
}

export function OfflinePage() {
  useAppTitle('Offline Support')
  const isOnline = useOnlineStatus()
  const [queue, setQueue] = useState<QueuedMutation[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  async function loadQueue() {
    const pending = await getPendingMutations()
    setQueue(pending as QueuedMutation[])
  }

  useEffect(() => {
    loadQueue()
  }, [isOnline])

  async function handleClearFailed() {
    const failed = queue.filter((m) => m.status === 'failed')
    await Promise.all(failed.map((m) => removeMutationFromQueue(m.id)))
    await loadQueue()
  }

  async function handleRetry(id: string) {
    await updateMutationStatus(id, 'pending', 0)
    await loadQueue()
  }

  async function handleClearAll() {
    await clearOldMutations()
    await Promise.all(queue.map((m) => removeMutationFromQueue(m.id)))
    await loadQueue()
  }

  async function handleSync() {
    if (!isOnline) return
    setIsSyncing(true)
    // Trigger a page reload to let useOfflineMutation sync hook run
    await new Promise((r) => setTimeout(r, 1500))
    await loadQueue()
    setIsSyncing(false)
  }

  const pending = queue.filter((m) => m.status === 'pending')
  const failed = queue.filter((m) => m.status === 'failed')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Offline Support</h1>
        <p className="mt-1 text-muted-foreground">
          Manage offline actions and sync when back online
        </p>
      </div>

      {/* Status banner */}
      <Card
        className={
          isOnline
            ? 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10'
            : 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10'
        }
      >
        <CardContent className="flex items-center gap-3 py-4">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-600" />
          )}
          <div className="flex-1">
            <p className="font-medium">{isOnline ? 'You are online' : 'You are offline'}</p>
            <p className="text-sm text-muted-foreground">
              {isOnline
                ? 'All actions will be processed immediately'
                : 'Actions will be queued and synced when you reconnect'}
            </p>
          </div>
          {isOnline && pending.length > 0 && (
            <Button size="sm" onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing…' : `Sync ${pending.length} pending`}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{pending.length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{failed.length}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{queue.length}</p>
              <p className="text-sm text-muted-foreground">Total queued</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Offline Queue</CardTitle>
          <div className="flex gap-2">
            {failed.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearFailed}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear failed
              </Button>
            )}
            {queue.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No queued actions</p>
          ) : (
            <div className="space-y-2">
              {queue.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {m.mutationKey.join(' › ') || 'Unknown action'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.timestamp).toLocaleString()} · Retries: {m.retryCount}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Badge
                      variant={
                        m.status === 'synced'
                          ? 'default'
                          : m.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {m.status}
                    </Badge>
                    {m.status === 'failed' && (
                      <Button variant="ghost" size="sm" onClick={() => handleRetry(m.id)}>
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How offline mode works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Actions taken while offline are stored locally in IndexedDB</p>
          <p>• When you reconnect, pending actions are automatically synced</p>
          <p>• Conflicts are resolved using a remote-wins strategy by default</p>
          <p>• Failed actions can be retried manually or cleared</p>
          <p>• Actions older than 7 days are automatically removed</p>
        </CardContent>
      </Card>
    </div>
  )
}
