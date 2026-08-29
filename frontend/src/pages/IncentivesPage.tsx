import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, Zap } from 'lucide-react'
import { useIncentives } from '@/hooks/useIncentives'
import { Incentive, WasteType, Role } from '@/api/types'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { IncentiveCardSkeleton } from '@/components/ui/Skeletons'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/Select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/Dialog'

const WASTE_LABELS: Record<WasteType, string> = {
  [WasteType.Paper]: 'Paper',
  [WasteType.PetPlastic]: 'PET Plastic',
  [WasteType.Plastic]: 'Plastic',
  [WasteType.Metal]: 'Metal',
  [WasteType.Glass]: 'Glass',
  [WasteType.Organic]: 'Organic',
  [WasteType.Electronic]: 'Electronic',
}

const ALL_WASTE_TYPES = Object.values(WasteType).filter(
  (v): v is WasteType => typeof v === 'number'
)

type FormState = { wasteType: string; rewardPoints: string; budget: string }
const EMPTY_FORM: FormState = { wasteType: String(WasteType.Paper), rewardPoints: '', budget: '' }

export function IncentivesPage() {
  const {
    incentives,
    isLoading,
    error,
    address,
    createIncentive,
    updateIncentive,
    deactivateIncentive
  } = useIncentives()
  const { user } = useAuth()
  const isManufacturer = user?.role === Role.Manufacturer

  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Create / Edit dialog
  const [editTarget, setEditTarget] = useState<Incentive | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const openCreate = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditTarget(null)
    setCreateOpen(true)
  }, [])

  const openEdit = useCallback((inc: Incentive) => {
    setForm({
      wasteType: String(inc.waste_type),
      rewardPoints: String(inc.reward_points),
      budget: String(inc.remaining_budget)
    })
    setEditTarget(inc)
    setCreateOpen(true)
  }, [])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      if (editTarget) {
        await updateIncentive(editTarget.id, BigInt(form.rewardPoints), BigInt(form.budget))
      } else {
        await createIncentive(
          Number(form.wasteType) as WasteType,
          BigInt(form.rewardPoints),
          BigInt(form.budget)
        )
      }
      setCreateOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const filtered =
    typeFilter === 'all'
      ? incentives
      : incentives.filter((i) => i.waste_type === Number(typeFilter))

  // Group by waste type
  const grouped = ALL_WASTE_TYPES.reduce<Record<WasteType, Incentive[]>>(
    (acc, wt) => ({ ...acc, [wt]: filtered.filter((i) => i.waste_type === wt) }),
    {} as Record<WasteType, Incentive[]>
  )

  return (
    <div className="space-y-6 overflow-x-hidden px-4 py-6 sm:px-0 sm:py-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">Incentives</h1>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <label htmlFor="incentive-type-filter" className="sr-only">
            Filter incentives by waste type
          </label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger id="incentive-type-filter" className="w-full sm:w-36">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ALL_WASTE_TYPES.map((wt) => (
                <SelectItem key={wt} value={String(wt)}>
                  {WASTE_LABELS[wt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isManufacturer && (
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Create Incentive
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <IncentiveCardSkeleton key={j} />
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No incentives found"
              description={
                typeFilter !== 'all' ? 'No incentives for this waste type' : 'No incentives yet'
              }
              action={
                isManufacturer ? { label: 'Create Incentive', onClick: openCreate } : undefined
              }
            />
          ) : (
            <>
              {ALL_WASTE_TYPES.map((wt) => {
                const group = grouped[wt]
                if (group.length === 0) return null
                return (
                  <Card key={wt}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{WASTE_LABELS[wt]}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-muted-foreground">
                            <tr>
                              <th className="pb-2 pr-4 font-medium">ID</th>
                              <th className="pb-2 pr-4 font-medium">Rewarder</th>
                              <th className="pb-2 pr-4 font-medium">Pts / unit</th>
                              <th className="pb-2 pr-4 font-medium">Budget remaining</th>
                              {isManufacturer && (
                                <th className="pb-2 font-medium text-right">Actions</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {group.map((inc) => {
                              const isOwner = inc.rewarder === address
                              return (
                                <tr key={inc.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="py-2 pr-4 font-mono">#{inc.id}</td>
                                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                                    <AddressDisplay address={inc.rewarder} showExplorer />
                                  </td>
                                  <td className="py-2 pr-4">{inc.reward_points}</td>
                                  <td className="py-2 pr-4">
                                    <Badge variant="secondary">
                                      {inc.remaining_budget.toLocaleString()}
                                    </Badge>
                                  </td>
                                  {isManufacturer && (
                                    <td className="py-2 text-right">
                                      {isOwner && (
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            aria-label={`Edit incentive #${inc.id}`}
                                            title="Edit"
                                            onClick={() => openEdit(inc)}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            aria-label={`Deactivate incentive #${inc.id}`}
                                            title="Deactivate"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => deactivateIncentive(inc.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Incentive' : 'Create Incentive'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editTarget && (
              <div className="space-y-1.5">
                <label htmlFor="incentive-waste-type" className="text-sm font-medium">
                  Waste Type
                </label>
                <Select
                  value={form.wasteType}
                  onValueChange={(v) => setForm((f) => ({ ...f, wasteType: v }))}
                >
                  <SelectTrigger id="incentive-waste-type" autoFocus>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_WASTE_TYPES.map((wt) => (
                      <SelectItem key={wt} value={String(wt)}>
                        {WASTE_LABELS[wt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="incentive-reward-points" className="text-sm font-medium">
                Reward Points (per unit)
              </label>
              <Input
                id="incentive-reward-points"
                type="number"
                min="1"
                placeholder="e.g. 100"
                value={form.rewardPoints}
                onChange={(e) => setForm((f) => ({ ...f, rewardPoints: e.target.value }))}
                autoFocus={!!editTarget}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="incentive-budget" className="text-sm font-medium">
                {editTarget ? 'Budget to add' : 'Total Budget'} (tokens)
              </label>
              <Input
                id="incentive-budget"
                type="number"
                min="1"
                placeholder="e.g. 10000"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !form.rewardPoints || !form.budget}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editTarget ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
