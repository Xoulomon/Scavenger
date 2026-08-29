import { useState } from 'react'
import { Plus, Coins, Recycle, Weight, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCardSkeleton } from '@/components/ui/Skeletons'
import { RegisterWasteModal } from '@/components/modals/RegisterWasteModal'
import { TransferWasteModal } from '@/components/modals/TransferWasteModal'
import { useAuth } from '@/context/AuthContext'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useResource } from '@/hooks/useResource'
import { ScavengerClient } from '@/api/client'
import { Material, Incentive, ParticipantStats, WasteType } from '@/api/types'
import { config } from '@/config'
import { networkConfig } from '@/lib/stellar'

const client = new ScavengerClient({
  rpcUrl: networkConfig.rpcUrl,
  networkPassphrase: networkConfig.networkPassphrase,
  contractId: config.contractId
})

const WASTE_LABELS: Record<WasteType, string> = {
  [WasteType.Paper]: 'Paper',
  [WasteType.PetPlastic]: 'PET Plastic',
  [WasteType.Plastic]: 'Plastic',
  [WasteType.Metal]: 'Metal',
  [WasteType.Glass]: 'Glass',
  [WasteType.Organic]: 'Organic',
  [WasteType.Electronic]: 'Electronic',
}

function statusVariant(m: Material): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (!m.is_active) return 'destructive'
  if (m.is_confirmed) return 'default'
  if (m.verified) return 'secondary'
  return 'outline'
}

function statusLabel(m: Material): string {
  if (!m.is_active) return 'Inactive'
  if (m.is_confirmed) return 'Confirmed'
  if (m.verified) return 'Verified'
  return 'Pending'
}

export function RecyclerDashboard() {
  useAppTitle('Dashboard — Recycler')
  const { user } = useAuth()
  const address = user?.address ?? ''

  const [modalOpen, setModalOpen] = useState(false)
  const [transferWasteId, setTransferWasteId] = useState<bigint | null>(null)

  const { data, isLoading: loading, reload: load } = useResource(async () => {
    if (!address) return null
    const [participantStats, wasteIds, activeIncentives] = await Promise.all([
      client.getStats(address),
      client.getParticipantWastes(address),
      client.getActiveIncentives()
    ])

    const materials = await Promise.all(
      wasteIds
        .slice(-10)
        .reverse()
        .map((id) => client.getMaterial(id))
    )

    return {
      stats: participantStats,
      incentives: activeIncentives.slice(0, 5),
      wastes: materials.filter(Boolean) as Material[]
    }
  }, [address])

  const stats: ParticipantStats | null = data?.stats ?? null
  const wastes: Material[] = data?.wastes ?? []
  const incentives: Incentive[] = data?.incentives ?? []

  return (
    <div className="space-y-6 overflow-x-hidden px-4 py-6 sm:px-0 sm:py-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">Dashboard</h1>
        <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Register Waste
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Token Balance
                </CardTitle>
                <Coins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats?.total_earned?.toString() ?? '0'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Wastes Submitted
                </CardTitle>
                <Recycle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats?.materials_submitted ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Transfers
                </CardTitle>
                <Weight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats?.transfers_count ?? 0}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Recent wastes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Wastes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : wastes.length === 0 ? (
            <EmptyState
              icon={Recycle}
              title="No wastes submitted"
              description="Start by submitting your first waste"
              action={{ label: 'Register Waste', onClick: () => setModalOpen(true) }}
            />
          ) : (
            <div className="divide-y">
              {wastes.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      #{m.id} · {WASTE_LABELS[m.waste_type]}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.weight} kg</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(m)}>{statusLabel(m)}</Badge>
                    {m.is_active && !m.is_confirmed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTransferWasteId(BigInt(m.id))}
                      >
                        Transfer
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top active incentives */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Active Incentives</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="space-y-1.5">
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : incentives.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No active incentives"
              description="Incentives will appear once manufacturers create them"
            />
          ) : (
            <div className="divide-y">
              {incentives.map((inc) => (
                <div
                  key={inc.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{WASTE_LABELS[inc.waste_type]}</p>
                    <p className="text-xs text-muted-foreground">
                      Budget remaining: {inc.remaining_budget}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {inc.reward_points} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RegisterWasteModal
        open={modalOpen}
        address={address}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false)
          load()
        }}
      />

      <TransferWasteModal
        open={transferWasteId !== null}
        waste={
          transferWasteId !== null
            ? ((wastes.find(
                (w) => BigInt(w.id) === transferWasteId
              ) as unknown as import('@/api/types').Waste) ?? null)
            : null
        }
        onClose={() => {
          setTransferWasteId(null)
          load()
        }}
      />
    </div>
  )
}
