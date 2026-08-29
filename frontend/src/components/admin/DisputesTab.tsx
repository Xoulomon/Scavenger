import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { addAuditEntry } from './auditLog'

export interface Dispute {
  id: number
  wastId: number
  reporter: string
  description: string
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: number
}

interface DisputesTabProps {
  initialDisputes?: Dispute[]
}

export function DisputesTab({ initialDisputes = [] }: DisputesTabProps = {}) {
  const [disputes, setDisputes] = useState<Dispute[]>(initialDisputes)
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')


  const displayed = filter === 'all' ? disputes : disputes.filter((d) => d.status === filter)

  function resolve(id: number) {
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'resolved' } : d)))
    addAuditEntry('resolve_dispute', String(id))
  }

  function dismiss(id: number) {
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'dismissed' } : d)))
    addAuditEntry('dismiss_dispute', String(id))
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['all', 'open', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize ${
              filter === f ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground">No disputes found.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {displayed.map((d) => (
            <div key={d.id} className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    Dispute #{d.id} — Waste #{d.wastId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reporter: {d.reporter} · {formatDate(d.createdAt)}
                  </p>
                  <p className="text-sm mt-1">{d.description}</p>
                </div>
                <Badge
                  variant={d.status === 'open' ? 'default' : 'outline'}
                  className="shrink-0"
                >
                  {d.status}
                </Badge>
              </div>
              {d.status === 'open' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolve(d.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Resolve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => dismiss(d.id)}>
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
