import { useState, useRef, useCallback } from 'react'
import {
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  ArrowDown,
  ZoomIn,
  ZoomOut,
  Download,
  ShieldCheck,
  Truck,
  PackageCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WasteTransfer, Waste } from '@/api/types'
import { formatAddress, formatDate, wasteTypeLabel } from '@/lib/helpers'
import { Button } from './Button'

export type TimelineLayout = 'horizontal' | 'vertical'

export interface JourneyEvent {
  id: string
  type: 'submitted' | 'transfer' | 'verified' | 'confirmed' | 'deactivated'
  timestamp: number
  label: string
  detail?: string
  from?: string
  to?: string
}

export interface WasteJourneyTimelineProps {
  waste: Waste
  transfers: WasteTransfer[]
  layout?: TimelineLayout
  className?: string
}

function buildEvents(waste: Waste, transfers: WasteTransfer[]): JourneyEvent[] {
  const events: JourneyEvent[] = [
    {
      id: 'submitted',
      type: 'submitted',
      timestamp: waste.recycled_timestamp,
      label: 'Submitted',
      detail: `${wasteTypeLabel(waste.waste_type)} · ${Number(waste.weight) >= 1000 ? `${(Number(waste.weight) / 1000).toFixed(2)} kg` : `${Number(waste.weight)} g`}`,
      to: waste.current_owner
    }
  ]

  for (const t of transfers) {
    events.push({
      id: `transfer-${t.waste_id}-${t.transferred_at}`,
      type: 'transfer',
      timestamp: t.transferred_at,
      label: 'Transferred',
      from: t.from,
      to: t.to
    })
  }

  if (waste.is_confirmed && waste.confirmer) {
    events.push({
      id: 'confirmed',
      type: 'confirmed',
      timestamp: waste.recycled_timestamp,
      label: 'Confirmed',
      detail: `By ${formatAddress(waste.confirmer)}`
    })
  }

  if (!waste.is_active) {
    events.push({
      id: 'deactivated',
      type: 'deactivated',
      timestamp: waste.recycled_timestamp,
      label: 'Deactivated'
    })
  }

  return events.sort((a, b) => a.timestamp - b.timestamp)
}

const EVENT_ICON: Record<JourneyEvent['type'], React.ReactNode> = {
  submitted: <PackageCheck className="h-3.5 w-3.5" />,
  transfer: <Truck className="h-3.5 w-3.5" />,
  verified: <ShieldCheck className="h-3.5 w-3.5" />,
  confirmed: <CheckCircle2 className="h-3.5 w-3.5" />,
  deactivated: <XCircle className="h-3.5 w-3.5" />
}

const EVENT_COLOR: Record<JourneyEvent['type'], string> = {
  submitted: 'border-primary bg-primary text-primary-foreground',
  transfer: 'border-blue-500 bg-blue-500 text-white',
  verified: 'border-green-500 bg-green-500 text-white',
  confirmed: 'border-emerald-500 bg-emerald-500 text-white',
  deactivated: 'border-destructive bg-destructive text-destructive-foreground'
}

function EventNode({
  event,
  isLast,
  layout,
  zoom
}: {
  event: JourneyEvent
  isLast: boolean
  layout: TimelineLayout
  zoom: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'flex',
        layout === 'horizontal' ? 'flex-col items-center' : 'flex-row items-start gap-4'
      )}
      style={{ fontSize: `${zoom}rem` }}
    >
      {/* Node + connector */}
      <div
        className={cn(
          'flex',
          layout === 'horizontal' ? 'flex-row items-center' : 'flex-col items-center'
        )}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${event.label} event details`}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            EVENT_COLOR[event.type]
          )}
        >
          {EVENT_ICON[event.type]}
        </button>
        {!isLast && (
          <div
            className={cn(
              'bg-border',
              layout === 'horizontal' ? 'h-px w-12 shrink-0' : 'mt-1 h-8 w-px'
            )}
          />
        )}
      </div>

      {/* Label + detail popover */}
      <div
        className={cn(layout === 'horizontal' ? 'mt-2 max-w-[7rem] text-center' : 'flex-1 pb-4')}
      >
        <p className="text-xs font-semibold leading-tight">{event.label}</p>
        <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{formatDate(event.timestamp)}</p>
        {open && (
          <div className="mt-1 rounded-md border bg-popover p-2 text-[0.65rem] text-popover-foreground shadow-md">
            {event.detail && <p>{event.detail}</p>}
            {event.from && (
              <p className="flex items-center gap-1">
                <span className="font-mono">{formatAddress(event.from)}</span>
                {layout === 'horizontal' ? (
                  <ArrowRight className="h-2.5 w-2.5" />
                ) : (
                  <ArrowDown className="h-2.5 w-2.5" />
                )}
                <span className="font-mono">{event.to ? formatAddress(event.to) : '—'}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function WasteJourneyTimeline({
  waste,
  transfers,
  layout: initialLayout = 'horizontal',
  className
}: WasteJourneyTimelineProps) {
  const [layout, setLayout] = useState<TimelineLayout>(initialLayout)
  const [zoom, setZoom] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  const events = buildEvents(waste, transfers)

  const exportImage = useCallback(async () => {
    // Export as text summary (html2canvas not available; can be added as optional dep)
    const text = events
      .map((e) => `${e.label} — ${formatDate(e.timestamp)}${e.detail ? ` (${e.detail})` : ''}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard not available in all environments
    }
  }, [events])

  const statusIcon = waste.is_confirmed ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  ) : waste.is_active ? (
    <Clock className="h-4 w-4 text-yellow-500" />
  ) : (
    <XCircle className="h-4 w-4 text-destructive" />
  )

  return (
    <div className={cn('space-y-3', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-sm font-medium">
          {statusIcon}
          <span>Waste #{waste.waste_id.toString()}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLayout((l) => (l === 'horizontal' ? 'vertical' : 'horizontal'))}
            aria-label="Toggle layout"
          >
            {layout === 'horizontal' ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
            disabled={zoom <= 0.6}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}
            disabled={zoom >= 1.6}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportImage} aria-label="Export timeline">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div
        ref={containerRef}
        role="list"
        aria-label="Waste journey timeline"
        className={cn(
          'overflow-auto rounded-lg border bg-card p-4',
          layout === 'horizontal' ? 'flex flex-row items-start gap-0' : 'flex flex-col gap-0'
        )}
      >
        {events.map((event, idx) => (
          <div key={event.id} role="listitem">
            <EventNode
              event={event}
              isLast={idx === events.length - 1}
              layout={layout}
              zoom={zoom}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
