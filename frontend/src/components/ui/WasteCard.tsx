import * as React from 'react'
import { memo } from 'react'
import {
  Newspaper,
  Recycle,
  Package,
  Wrench,
  GlassWater,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Waste, WasteType } from '@/api/types'
import { wasteTypeLabel } from '@/lib/helpers'
import { Badge } from '@/components/ui/Badge'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card'

// ── Waste type icon map ──────────────────────────────────────────────────────

const WASTE_ICONS: Record<WasteType, React.ReactNode> = {
  [WasteType.Paper]:      <Newspaper  className="h-5 w-5" />,
  [WasteType.PetPlastic]: <Recycle    className="h-5 w-5" />,
  [WasteType.Plastic]:    <Package    className="h-5 w-5" />,
  [WasteType.Metal]:      <Wrench     className="h-5 w-5" />,
  [WasteType.Glass]:      <GlassWater className="h-5 w-5" />,
  [WasteType.Organic]:    <Recycle    className="h-5 w-5" />,
  [WasteType.Electronic]: <Wrench     className="h-5 w-5" />,
}

const WASTE_ICON_COLORS: Record<WasteType, string> = {
  [WasteType.Paper]:      'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
  [WasteType.PetPlastic]: 'text-blue-600   bg-blue-100   dark:text-blue-400   dark:bg-blue-900/30',
  [WasteType.Plastic]:    'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
  [WasteType.Metal]:      'text-slate-600  bg-slate-100  dark:text-slate-400  dark:bg-slate-800/50',
  [WasteType.Glass]:      'text-cyan-600   bg-cyan-100   dark:text-cyan-400   dark:bg-cyan-900/30',
  [WasteType.Organic]:    'text-green-600  bg-green-100  dark:text-green-400  dark:bg-green-900/30',
  [WasteType.Electronic]: 'text-red-600    bg-red-100    dark:text-red-400    dark:bg-red-900/30',
}

// ── Status helpers ───────────────────────────────────────────────────────────

type WasteStatus = 'confirmed' | 'pending' | 'inactive'

function resolveStatus(waste: Waste): WasteStatus {
  if (!waste.is_active)    return 'inactive'
  if (waste.is_confirmed)  return 'confirmed'
  return 'pending'
}

const STATUS_CONFIG: Record<WasteStatus, { label: string; icon: React.ReactNode; badge: string }> = {
  confirmed: {
    label: 'Confirmed',
    icon:  <CheckCircle2 className="h-3.5 w-3.5" />,
    badge: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  },
  pending: {
    label: 'Pending',
    icon:  <Clock className="h-3.5 w-3.5" />,
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  },
  inactive: {
    label: 'Inactive',
    icon:  <XCircle className="h-3.5 w-3.5" />,
    badge: 'bg-muted text-muted-foreground border-border',
  },
}

// ── Component ────────────────────────────────────────────────────────────────

export interface WasteCardProps {
  waste: Waste
  /** Slot for action buttons rendered in the card footer */
  actions?: React.ReactNode
  className?: string
}

export const WasteCard = memo(function WasteCard({ waste, actions, className }: WasteCardProps) {
  const status     = resolveStatus(waste)
  const statusCfg  = STATUS_CONFIG[status]
  const weightGrams = Number(waste.weight)

  return (
    <Card className={cn('flex flex-col', className)}>
      {/* Header: icon + label + status badge */}
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            WASTE_ICON_COLORS[waste.waste_type]
          )}
          aria-hidden="true"
        >
          {WASTE_ICONS[waste.waste_type]}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">
            {wasteTypeLabel(waste.waste_type)}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            #{waste.waste_id.toString()}
          </p>
        </div>

        <Badge
          className={cn(
            'inline-flex shrink-0 items-center gap-1 border text-xs font-medium',
            statusCfg.badge
          )}
        >
          {statusCfg.icon}
          {statusCfg.label}
        </Badge>
      </CardHeader>

      {/* Body: weight + owner */}
      <CardContent className="flex-1 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Weight</span>
          <span className="font-medium">
            {weightGrams >= 1000
              ? `${(weightGrams / 1000).toFixed(2)} kg`
              : `${weightGrams} g`}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-muted-foreground">Owner</span>
          <AddressDisplay address={waste.current_owner} showExplorer />
        </div>
      </CardContent>

      {/* Footer: action buttons slot */}
      {actions && (
        <CardFooter className="gap-2 pt-3">
          {actions}
        </CardFooter>
      )}
    </Card>
  )
})
WasteCard.displayName = 'WasteCard'
