import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useCharityDonations } from '@/hooks/useCharityDonations'
import { useWallet } from '@/context/WalletContext'
import { Charity, CharityDonation } from '@/lib/charityStorage'
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
import { TransactionConfirmDialog } from '@/components/ui/TransactionConfirmDialog'
import { Heart, Download, ExternalLink, History } from 'lucide-react'
import { formatTokenAmount, formatDate } from '@/lib/helpers'
import { CharityTab } from '@/lib/constants'

// ── Charity Profile Card ──────────────────────────────────────────────────────

function CharityCard({
  charity,
  onDonate,
  onProfile
}: {
  charity: Charity
  onDonate: (c: Charity) => void
  onProfile: (c: Charity) => void
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 xs:flex-row xs:items-start xs:justify-between">
          <div className="min-w-0">
            <CardTitle className="break-words text-base">{charity.name}</CardTitle>
            <Badge variant="secondary" className="mt-1 text-xs">
              {charity.category}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full xs:w-auto"
            onClick={() => onProfile(charity)}
          >
            {t('charity.profile')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="break-words text-sm text-muted-foreground">{charity.description}</p>
        <Button size="sm" className="w-full" onClick={() => onDonate(charity)}>
          <Heart className="mr-1 h-3 w-3" /> {t('charity.donate')}
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Charity Profile Dialog ────────────────────────────────────────────────────

function CharityProfileDialog({
  charity,
  onClose,
  onDonate
}: {
  charity: Charity | null
  onClose: () => void
  onDonate: (c: Charity) => void
}) {
  const { t } = useTranslation()
  if (!charity) return null
  return (
    <Dialog open={!!charity} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="break-words">{charity.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <Badge variant="secondary">{charity.category}</Badge>
          <p className="break-words text-muted-foreground">{charity.description}</p>
          <div>
            <span className="font-medium">{t('charity.contractAddress')}: </span>
            <span className="break-all text-xs text-muted-foreground">{charity.address}</span>
          </div>
          {charity.website && (
            <a
              href={charity.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 break-all text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" /> {charity.website}
            </a>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 xs:flex-row">
          <Button variant="outline" className="w-full xs:w-auto" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button
            className="w-full xs:w-auto"
            onClick={() => {
              onClose()
              onDonate(charity)
            }}
          >
            <Heart className="mr-1 h-3 w-3" /> {t('charity.donate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Donate Dialog ─────────────────────────────────────────────────────────────

function DonateDialog({
  charity,
  balance,
  isPending,
  onClose,
  onConfirm
}: {
  charity: Charity | null
  balance: bigint
  isPending: boolean
  onClose: () => void
  onConfirm: (amount: bigint) => void
}) {
  const { t } = useTranslation()
  const [amountStr, setAmountStr] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  if (!charity) return null

  const parsed = amountStr ? BigInt(amountStr) : 0n
  const invalid = parsed <= 0n || parsed > balance

  const handleSubmit = () => {
    if (invalid) return
    setShowConfirm(true)
  }

  return (
    <>
      <Dialog open={!!charity && !showConfirm} onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="break-words">
              {t('charity.donateTo', { name: charity.name })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t('charity.availableBalance')}: <strong>{formatTokenAmount(balance)}</strong>{' '}
              {t('charity.tokens')}
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('charity.tokenAmount')}</label>
              <input
                type="number"
                min="1"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={t('charity.enterAmount')}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/\D/g, ''))}
              />
              {amountStr && invalid && (
                <p className="text-xs text-destructive">
                  {parsed <= 0n
                    ? t('charity.amountGreaterThanZero')
                    : t('charity.insufficientBalance')}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 xs:flex-row">
            <Button variant="outline" className="w-full xs:w-auto" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              className="w-full xs:w-auto"
              onClick={handleSubmit}
              disabled={invalid || !amountStr}
            >
              {t('charity.review')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransactionConfirmDialog
        open={showConfirm}
        title={t('charity.donateTo', { name: charity.name })}
        description={t('charity.donateConfirmDescription', {
          amount: formatTokenAmount(parsed),
          name: charity.name
        })}
        isLoading={isPending}
        onConfirm={() => onConfirm(parsed)}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  )
}

// ── History Row ───────────────────────────────────────────────────────────────

function HistoryRow({
  donation,
  onDownload
}: {
  donation: CharityDonation
  onDownload: (d: CharityDonation) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 rounded-md border px-3 py-3 text-sm xs:px-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="break-words font-medium">{donation.charityName}</span>
        <Badge variant="outline">
          {t('charity.tokensAmount', { amount: formatTokenAmount(donation.tokenAmount) })}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {formatDate(donation.timestamp / 1000)}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => onDownload(donation)}
      >
        <Download className="mr-1 h-3 w-3" /> {t('charity.receipt')}
      </Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CharityDonationsPage() {
  const { t } = useTranslation()
  useAppTitle(t('charity.title'))
  const { address } = useWallet()
  const { charities, donations, totalDonated, balance, donate, downloadReceipt, isPending, error } =
    useCharityDonations(address)

  const [tab, setTab] = useState<CharityTab>(CharityTab.Charities)
  const [donateTarget, setDonateTarget] = useState<Charity | null>(null)
  const [profileTarget, setProfileTarget] = useState<Charity | null>(null)

  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center px-4 text-center text-muted-foreground">
        {t('charity.connectWallet')}
      </div>
    )
  }

  const handleConfirmDonate = async (amount: bigint) => {
    if (!donateTarget) return
    await donate({ charity: donateTarget, tokenAmount: amount })
    setDonateTarget(null)
  }

  return (
    <div className="space-y-6 px-3 py-6 xs:px-4 sm:px-0 sm:py-0">
      <div className="flex flex-col gap-2 xs:flex-row xs:items-center xs:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold xs:text-2xl">{t('charity.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('charity.totalDonated')}: <strong>{formatTokenAmount(totalDonated)}</strong>{' '}
            {t('charity.tokens')}
          </p>
        </div>
      </div>

      {error && <p className="break-words text-sm text-destructive">{(error as Error).message}</p>}

      {/* Tabs */}
      <div className="flex w-full gap-1 rounded-lg border p-1 xs:w-fit">
        {([CharityTab.Charities, CharityTab.History] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm capitalize transition-colors xs:flex-none ${
              tab === tabKey
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            {t(`charity.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {tab === CharityTab.Charities && (
        <div className="grid gap-4 xs:grid-cols-1 sm:grid-cols-2 tablet:grid-cols-3">
          {charities.map((c) => (
            <CharityCard
              key={c.id}
              charity={c}
              onDonate={setDonateTarget}
              onProfile={setProfileTarget}
            />
          ))}
        </div>
      )}

      {tab === CharityTab.History && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('charity.donationHistory')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {donations.length === 0 ? (
              <EmptyState
                icon={History}
                title={t('charity.noDonations')}
                description={t('charity.noDonationsDescription')}
              />
            ) : (
              donations.map((d) => (
                <HistoryRow key={d.id} donation={d} onDownload={downloadReceipt} />
              ))
            )}
          </CardContent>
        </Card>
      )}

      <CharityProfileDialog
        charity={profileTarget}
        onClose={() => setProfileTarget(null)}
        onDonate={(c) => {
          setProfileTarget(null)
          setDonateTarget(c)
        }}
      />

      <DonateDialog
        charity={donateTarget}
        balance={balance}
        isPending={isPending}
        onClose={() => setDonateTarget(null)}
        onConfirm={handleConfirmDonate}
      />
    </div>
  )
}
