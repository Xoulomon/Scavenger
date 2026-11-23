import { useState } from 'react'
import { Search, Ban } from 'lucide-react'
import { wasteTypeLabel, formatDate, formatAddress } from '@/lib/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAdminWasteLookup } from '@/hooks/useAdminDashboard'
import { addAuditEntry } from './auditLog'

export function WastesTab() {
  const [wasteId, setWasteId] = useState('')
  const [searched, setSearched] = useState<bigint | null>(null)

  const { data: waste, isLoading } = useAdminWasteLookup(searched)

  const handleDeactivate = async () => {
    if (!waste) return
    addAuditEntry('deactivate_waste', waste.waste_id.toString())
    alert(`Deactivate waste #${waste.waste_id} — connect admin wallet to confirm.`)
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = wasteId.trim()
          if (trimmed) setSearched(BigInt(trimmed))
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="number"
            min="1"
            placeholder="Waste ID…"
            value={wasteId}
            onChange={(e) => setWasteId(e.target.value)}
            className="pl-9"
            aria-label="Waste ID"
          />
        </div>
        <Button type="submit" disabled={!wasteId.trim()}>
          Lookup
        </Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {waste && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Waste #{waste.waste_id.toString()}</CardTitle>
            <Badge variant={waste.is_active ? 'default' : 'outline'}>
              {waste.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Type: {wasteTypeLabel(waste.waste_type)}</p>
            <p>Owner: {formatAddress(waste.current_owner)}</p>
            <p>Registered: {formatDate(waste.recycled_timestamp)}</p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleDeactivate()}
                disabled={!waste.is_active}
                aria-label="Deactivate waste"
              >
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                Deactivate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {searched !== null && !isLoading && !waste && (
        <p className="text-sm text-muted-foreground">
          No waste found with ID #{searched.toString()}.
        </p>
      )}
    </div>
  )
}
