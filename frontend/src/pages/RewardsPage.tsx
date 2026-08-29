import { useState } from 'react'
import {
  Coins,
  Recycle,
  ArrowRightLeft,
  Heart,
  Package,
  Calculator,
  Send,
  TrendingUp,
} from 'lucide-react'
import { useRewards } from '@/hooks/useRewards'
import { useWallet } from '@/context/WalletContext'
import { useDonateToCharity } from '@/hooks/useDonateToCharity'
import { Role, WasteType } from '@/api/types'
import { wasteTypeLabel, formatDate } from '@/lib/helpers'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { TransactionConfirmDialog } from '@/components/ui/TransactionConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog'
import { useAppTitle } from '@/hooks/useAppTitle'

// ── Reward tiers ──────────────────────────────────────────────────────────────

const TIERS = [
  { label: 'Bronze', min: 0n, max: 999n, color: 'text-amber-700' },
  { label: 'Silver', min: 1000n, max: 4999n, color: 'text-slate-400' },
  { label: 'Gold', min: 5000n, max: 19999n, color: 'text-yellow-500' },
  { label: 'Platinum', min: 20000n, max: BigInt(Number.MAX_SAFE_INTEGER), color: 'text-cyan-400' },
]

function getTier(balance: bigint) {
  return TIERS.find((t) => balance >= t.min && balance <= t.max) ?? TIERS[0]
}

// ── Donate dialog ─────────────────────────────────────────────────────────────

function DonateDialog({ balance, open, onClose }: { balance: bigint; open: boolean; onClose: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [amount, setAmount] = useState('')
  const donate = useDonateToCharity()

  const parsed = amount ? BigInt(amount) : 0n
  const isInvalid = parsed <= 0n || parsed > balance

  const handleDonate = async () => {
    await donate.mutateAsync({ amount: parsed, balance })
    setShowConfirm(false)
    onClose()
    setAmount('')
  }

  return (
    <>
      <TransactionConfirmDialog
        open={showConfirm}
        action="Donate to Charity"
        params={[
          { label: 'Amount', value: `${parsed.toLocaleString()} tokens` },
          { label: 'Remaining balance', value: `${(balance - parsed).toLocaleString()} tokens` },
        ]}
        isPending={donate.isPending}
        onConfirm={handleDonate}
        onCancel={() => !donate.isPending && setShowConfirm(false)}
      />
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Donate to Charity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Available:{' '}
              <span className="font-medium text-foreground">{balance.toLocaleString()} tokens</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                min="1"
                max={balance.toString()}
                placeholder="e.g. 100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amount && isInvalid && (
                <p className="text-xs text-destructive">
                  {parsed <= 0n ? 'Must be greater than zero.' : 'Exceeds your balance.'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setShowConfirm(true)} disabled={!amount || isInvalid}>
              Donate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Transfer dialog ───────────────────────────────────────────────────────────

function TransferDialog({ balance, open, onClose }: { balance: bigint; open: boolean; onClose: () => void }) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')

  const parsed = amount ? BigInt(amount) : 0n
  const isInvalid = parsed <= 0n || parsed > balance || !recipient.trim()

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Tokens</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Available:{' '}
            <span className="font-medium text-foreground">{balance.toLocaleString()} tokens</span>
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Recipient address</label>
            <Input
              placeholder="G…"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Amount</label>
            <Input
              type="number"
              min="1"
              max={balance.toString()}
              placeholder="e.g. 100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={isInvalid}>Transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Reward calculator ─────────────────────────────────────────────────────────

const RATES: Record<WasteType, number> = {
  [WasteType.Paper]: 2,
  [WasteType.PetPlastic]: 5,
  [WasteType.Plastic]: 3,
  [WasteType.Metal]: 8,
  [WasteType.Glass]: 4,
  [WasteType.Organic]: 2,
  [WasteType.Electronic]: 6,
}

function RewardCalculator() {
  const [wasteType, setWasteType] = useState<WasteType>(WasteType.Paper)
  const [weight, setWeight] = useState('')

  const estimate = weight ? Math.floor(Number(weight) * RATES[wasteType]) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4" />
          Reward Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Waste type</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={wasteType}
              onChange={(e) => setWasteType(Number(e.target.value) as WasteType)}
              aria-label="Waste type"
            >
              {Object.values(WasteType)
                .filter((v) => typeof v === 'number')
                .map((v) => (
                  <option key={v} value={v}>
                    {wasteTypeLabel(v as WasteType)}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Weight (grams)</label>
            <Input
              type="number"
              min="1"
              placeholder="e.g. 500"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              aria-label="Weight in grams"
            />
          </div>
        </div>
        {estimate !== null && (
          <div className="flex items-center gap-2 rounded-md bg-primary/10 px-4 py-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm">
              Estimated reward:{' '}
              <span className="font-bold text-primary">{estimate.toLocaleString()} tokens</span>
            </span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Rates: Paper {RATES[WasteType.Paper]}, PET {RATES[WasteType.PetPlastic]}, Plastic{' '}
          {RATES[WasteType.Plastic]}, Metal {RATES[WasteType.Metal]}, Glass {RATES[WasteType.Glass]}{' '}
          tokens/gram. Actual rewards depend on active incentives.
        </p>
      </CardContent>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function RewardsPage() {
  useAppTitle('Rewards')
  const { address } = useWallet()
  const { stats, wastes, role, isLoading } = useRewards()
  const [activeDialog, setActiveDialog] = useState<'donate' | 'transfer' | null>(null)

  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Connect your wallet to view your rewards.
      </div>
    )
  }

  const totalEarned = stats?.total_earned ?? 0n
  const materialsSubmitted = stats?.materials_submitted ?? 0
  const transfersCount = stats?.transfers_count ?? 0
  const tier = getTier(totalEarned)

  const totalActivity = materialsSubmitted + transfersCount || 1
  const recyclingEarned =
    role === Role.Recycler
      ? totalEarned
      : (totalEarned * BigInt(materialsSubmitted)) / BigInt(totalActivity)
  const collectingEarned =
    role === Role.Collector
      ? totalEarned
      : (totalEarned * BigInt(transfersCount)) / BigInt(totalActivity)

  return (
    <div className="space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      <DonateDialog
        balance={totalEarned}
        open={activeDialog === 'donate'}
        onClose={() => setActiveDialog(null)}
      />
      <TransferDialog
        balance={totalEarned}
        open={activeDialog === 'transfer'}
        onClose={() => setActiveDialog(null)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Rewards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your token balance and earning history.
          </p>
        </div>
        {/* Tier badge */}
        {!isLoading && (
          <span className={`text-sm font-semibold ${tier.color}`} aria-label={`Tier: ${tier.label}`}>
            {tier.label} Tier
          </span>
        )}
      </div>

      {/* Balance + breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Coins className="h-4 w-4" />}
          label="Total Balance"
          value={isLoading ? '—' : totalEarned.toString()}
          variant="primary"
          isLoading={isLoading}
        />
        <StatCard
          icon={<Recycle className="h-4 w-4" />}
          label="From Recycling"
          value={isLoading ? '—' : recyclingEarned.toString()}
          variant="success"
          trendLabel={`${materialsSubmitted} submission${materialsSubmitted !== 1 ? 's' : ''}`}
          isLoading={isLoading}
        />
        <StatCard
          icon={<ArrowRightLeft className="h-4 w-4" />}
          label="From Collecting"
          value={isLoading ? '—' : collectingEarned.toString()}
          variant="warning"
          trendLabel={`${transfersCount} transfer${transfersCount !== 1 ? 's' : ''}`}
          isLoading={isLoading}
        />
      </div>

      {/* Redemption options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Redeem Rewards</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setActiveDialog('donate')}
            disabled={totalEarned === 0n}
            aria-label="Donate to charity"
          >
            <Heart className="h-4 w-4" />
            Donate to Charity
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setActiveDialog('transfer')}
            disabled={totalEarned === 0n}
            aria-label="Transfer tokens"
          >
            <Send className="h-4 w-4" />
            Transfer
          </Button>
        </CardContent>
      </Card>

      {/* Reward calculator */}
      <RewardCalculator />

      {/* Transaction history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Transaction History</CardTitle>
          <span className="text-xs text-muted-foreground">Last 20 items</span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : wastes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Package className="h-8 w-8 opacity-40" />
              <p className="text-sm">No activity yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {wastes.map((waste) => {
                const weightNum = Number(waste.weight)
                const weightStr =
                  weightNum >= 1000 ? `${(weightNum / 1000).toFixed(2)} kg` : `${weightNum} g`

                return (
                  <div
                    key={waste.waste_id.toString()}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">
                        {wasteTypeLabel(waste.waste_type)}{' '}
                        <span className="font-normal text-muted-foreground">
                          #{waste.waste_id.toString()}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {weightStr} · {formatDate(waste.recycled_timestamp)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        waste.is_confirmed ? 'default' : waste.is_active ? 'secondary' : 'outline'
                      }
                    >
                      {waste.is_confirmed ? 'Confirmed' : waste.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
