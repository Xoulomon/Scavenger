import { useState } from 'react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useSubscriptions } from '@/hooks/useSubscriptions'
import { useWallet } from '@/context/WalletContext'
import { SubscriptionCalendar } from '@/components/SubscriptionCalendar'
import { Subscription, SubscriptionFrequency } from '@/lib/subscriptionStorage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/Dialog'
import { CalendarDays, Plus, Pause, Play, X, Clock } from 'lucide-react'
import { formatDate } from '@/lib/helpers'

const FREQUENCIES: { value: SubscriptionFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' }
]

const WASTE_TYPE_OPTIONS = ['Paper', 'PET Plastic', 'Plastic', 'Metal', 'Glass']

function statusBadge(status: Subscription['status']) {
  if (status === 'active') return <Badge variant="default">Active</Badge>
  if (status === 'paused') return <Badge variant="secondary">Paused</Badge>
  return <Badge variant="outline">Cancelled</Badge>
}

function SubscriptionRow({
  sub,
  onPause,
  onResume,
  onCancel,
  onPickup
}: {
  sub: Subscription
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onPickup: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {statusBadge(sub.status)}
        <span className="font-medium">{sub.recyclerName}</span>
        <span className="text-muted-foreground capitalize">{sub.frequency}</span>
        <span className="text-xs text-muted-foreground">Next: {formatDate(sub.nextPickup)}</span>
      </div>
      {sub.status !== 'cancelled' && (
        <div className="flex gap-2">
          {sub.status === 'active' && (
            <>
              <Button size="sm" variant="outline" onClick={() => onPickup(sub.id)}>
                Record Pickup
              </Button>
              <Button size="sm" variant="outline" onClick={() => onPause(sub.id)}>
                <Pause className="h-3 w-3" />
              </Button>
            </>
          )}
          {sub.status === 'paused' && (
            <Button size="sm" variant="outline" onClick={() => onResume(sub.id)}>
              <Play className="h-3 w-3" />
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onCancel(sub.id)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

function CreateSubscriptionDialog({
  open,
  onClose,
  onCreate
}: {
  open: boolean
  onClose: () => void
  onCreate: (data: {
    recyclerAddress: string
    recyclerName: string
    frequency: SubscriptionFrequency
    wasteTypes: string[]
    startDate: number
  }) => void
}) {
  const [recyclerAddress, setRecyclerAddress] = useState('')
  const [recyclerName, setRecyclerName] = useState('')
  const [frequency, setFrequency] = useState<SubscriptionFrequency>('weekly')
  const [wasteTypes, setWasteTypes] = useState<string[]>([])
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])

  const toggleWasteType = (t: string) =>
    setWasteTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  const handleSubmit = () => {
    if (!recyclerAddress || !recyclerName || wasteTypes.length === 0) return
    onCreate({
      recyclerAddress,
      recyclerName,
      frequency,
      wasteTypes,
      startDate: new Date(startDate).getTime()
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Pickup Subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Recycler Address</label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="G..."
              value={recyclerAddress}
              onChange={(e) => setRecyclerAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Recycler Name</label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Name or alias"
              value={recyclerName}
              onChange={(e) => setRecyclerName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Frequency</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as SubscriptionFrequency)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Start Date</label>
            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Waste Types</label>
            <div className="flex flex-wrap gap-2">
              {WASTE_TYPE_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleWasteType(t)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    wasteTypes.includes(t)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!recyclerAddress || !recyclerName || wasteTypes.length === 0}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SubscriptionsPage() {
  useAppTitle('Subscriptions')
  const { address } = useWallet()
  const {
    subscriptions,
    active,
    paused,
    cancelled,
    history,
    isLoading,
    error,
    create,
    pause,
    resume,
    cancel,
    recordPickup
  } = useSubscriptions(address)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'manage' | 'calendar' | 'history'>('manage')

  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Connect your wallet to manage subscriptions.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="text-destructive">{error}</div>
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-0 sm:py-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">Pickup Subscriptions</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border p-1 w-fit">
        {(['manage', 'calendar', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'manage' && (
        <div className="space-y-4">
          {active.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active ({active.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {active.map((s) => (
                  <SubscriptionRow
                    key={s.id}
                    sub={s}
                    onPause={pause}
                    onResume={resume}
                    onCancel={cancel}
                    onPickup={recordPickup}
                  />
                ))}
              </CardContent>
            </Card>
          )}
          {paused.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Paused ({paused.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {paused.map((s) => (
                  <SubscriptionRow
                    key={s.id}
                    sub={s}
                    onPause={pause}
                    onResume={resume}
                    onCancel={cancel}
                    onPickup={recordPickup}
                  />
                ))}
              </CardContent>
            </Card>
          )}
          {cancelled.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cancelled ({cancelled.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cancelled.map((s) => (
                  <SubscriptionRow
                    key={s.id}
                    sub={s}
                    onPause={pause}
                    onResume={resume}
                    onCancel={cancel}
                    onPickup={recordPickup}
                  />
                ))}
              </CardContent>
            </Card>
          )}
          {subscriptions.length === 0 && (
            <EmptyState
              icon={CalendarDays}
              title="No subscriptions yet"
              description="Create a subscription to schedule regular waste pickups"
            />
          )}
        </div>
      )}

      {tab === 'calendar' && <SubscriptionCalendar subscriptions={active} month={new Date()} />}

      {tab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No history yet"
                description="Subscription events will appear here"
              />
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">
                      {h.action.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(h.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <CreateSubscriptionDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(data) => create(data)}
      />
    </div>
  )
}
