import { CheckCircle2, PackageCheck, ShieldCheck, Truck, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo } from 'react'

import type { Material, WasteTransfer } from '@/api/types'
import { formatAddress,formatDate, wasteTypeLabel } from '@/lib/helpers'
import { cn } from '@/lib/utils'

import { formatWeight } from '../format'
import type { TimelineEvent } from '../types'

const EVENT_ICON: Record<TimelineEvent['type'], ReactNode> = {
  submitted: <PackageCheck className="h-3.5 w-3.5" />,
  transfer: <Truck className="h-3.5 w-3.5" />,
  verified: <ShieldCheck className="h-3.5 w-3.5" />,
  confirmed: <CheckCircle2 className="h-3.5 w-3.5" />,
  deactivated: <XCircle className="h-3.5 w-3.5" />,
}

const EVENT_COLOR: Record<TimelineEvent['type'], string> = {
  submitted: 'border-primary bg-primary text-primary-foreground',
  transfer: 'border-blue-500 bg-blue-500 text-white',
  verified: 'border-green-500 bg-green-500 text-white',
  confirmed: 'border-emerald-500 bg-emerald-500 text-white',
  deactivated: 'border-destructive bg-destructive text-destructive-foreground',
}

export function WasteTimeline({
  material,
  transfers,
  isLoading,
}: {
  material: Material
  transfers: WasteTransfer[]
  isLoading: boolean
}) {
  const events = useMemo(() => {
    const evts: TimelineEvent[] = [
      {
        id: 'submitted',
        type: 'submitted',
        timestamp: material.submitted_at,
        label: 'Material Submitted',
        detail: `${wasteTypeLabel(material.waste_type)}, ${formatWeight(material.weight)}`,
        actor: material.submitter,
      },
    ]

    for (const t of transfers) {
      evts.push({
        id: `transfer-${t.transferred_at}`,
        type: 'transfer',
        timestamp: t.transferred_at,
        label: 'Transferred',
        detail: `${formatAddress(t.from)} to ${formatAddress(t.to)}`,
        actor: t.from,
      })
    }

    if (material.verified) {
      evts.push({
        id: 'verified',
        type: 'verified',
        timestamp: material.submitted_at,
        label: 'Verified',
        detail: 'Material quality verified',
      })
    }

    if (material.is_confirmed && material.confirmer) {
      evts.push({
        id: 'confirmed',
        type: 'confirmed',
        timestamp: material.submitted_at,
        label: 'Confirmed',
        detail: `Confirmed by ${formatAddress(material.confirmer)}`,
        actor: material.confirmer,
      })
    }

    if (!material.is_active) {
      evts.push({
        id: 'deactivated',
        type: 'deactivated',
        timestamp: material.submitted_at,
        label: 'Deactivated',
      })
    }

    return evts.sort((a, b) => a.timestamp - b.timestamp)
  }, [material, transfers])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0" role="list" aria-label="Waste history timeline">
      {events.map((event, idx) => (
        <div key={event.id} role="listitem" className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                EVENT_COLOR[event.type]
              )}
            >
              {EVENT_ICON[event.type]}
            </div>
            {idx < events.length - 1 && (
              <div className="h-8 w-px bg-border" />
            )}
          </div>
          <div className="pb-4">
            <p className="text-sm font-semibold">{event.label}</p>
            <p className="text-xs text-muted-foreground">{formatDate(event.timestamp)}</p>
            {event.detail && (
              <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
