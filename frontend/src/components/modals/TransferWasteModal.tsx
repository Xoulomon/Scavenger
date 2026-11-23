import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { TransactionConfirmDialog } from '@/components/ui/TransactionConfirmDialog'
import { Waste, Role } from '@/api/types'
import { wasteTypeLabel, formatAddress } from '@/lib/helpers'
import { useWallet } from '@/context/WalletContext'
import { useParticipant } from '@/hooks/useParticipant'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { ScavengerClient } from '@/api/client'
import { cn } from '@/lib/utils'
import { isValidStellarAddress } from '@/lib/validation/stellarAddress'
import { ArrowRightLeft, AlertCircle } from 'lucide-react'

// ── Transfer rule validation ──────────────────────────────────────────────────
// Valid routes (from contract): Recycler→Collector, Recycler→Manufacturer, Collector→Manufacturer
// Manufacturer cannot transfer; same-role transfers are invalid.

const VALID_RECIPIENT_ROLES: Record<Role, Role[]> = {
  [Role.Recycler]: [Role.Collector, Role.Manufacturer],
  [Role.Collector]: [Role.Manufacturer],
  [Role.Manufacturer]: []
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface TransferWasteModalProps {
  waste: Waste | null
  open: boolean
  onClose: () => void
  onSuccess?: (waste: Waste) => void
}

export function TransferWasteModal({ waste, open, onClose, onSuccess }: TransferWasteModalProps) {
  const { address } = useWallet()
  const { participant } = useParticipant()
  const { config } = useContract()

  const [recipient, setRecipient] = useState('')
  const [note, setNote] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // ── Derived validation ──────────────────────────────────────────────────
  const recipientTrimmed = recipient.trim()

  const addressError: string | null = (() => {
    if (!recipientTrimmed) return null
    if (!isValidStellarAddress(recipientTrimmed)) return 'Invalid Stellar address.'
    if (recipientTrimmed === address) return 'Recipient cannot be yourself.'
    if (waste && recipientTrimmed === waste.current_owner) return 'Recipient is already the owner.'
    return null
  })()

  // We can only validate the route client-side if we know the sender's role.
  // The recipient role is unknown until submit — we validate on the server.
  // We do block Manufacturers from even opening the form (guarded by WasteDetailsModal),
  // but show a clear message here too.
  const senderRole = participant?.role
  const senderCanTransfer = senderRole ? VALID_RECIPIENT_ROLES[senderRole].length > 0 : true

  const canSubmit = !!recipientTrimmed && !addressError && senderCanTransfer && !isPending

  // ── Handlers ─────────────────────────────────────────────────────────────
  function reset() {
    setRecipient('')
    setNote('')
    setTxError(null)
  }

  function handleClose() {
    if (isPending) return
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!waste || !address || !canSubmit) return
    // Show confirmation step first
    setShowConfirm(true)
  }

  async function executeTransfer() {
    if (!waste || !address) return
    setTxError(null)

    const lat = BigInt(0)
    const lon = BigInt(0)

    const client = new ScavengerClient({
      rpcUrl: config.rpcUrl,
      networkPassphrase: networkConfig.networkPassphrase,
      contractId: config.contractId
    })

    setIsPending(true)
    try {
      await client.transferWaste(
        waste.waste_id,
        address,
        recipientTrimmed,
        lat,
        lon,
        note.trim(),
        address
      )
      setShowConfirm(false)
      onSuccess?.(waste)
      reset()
      onClose()
    } catch (err) {
      setShowConfirm(false)
      const msg = err instanceof Error ? err.message : 'Transaction failed'
      if (msg.includes('#')) {
        setTxError(
          `Contract error: ${msg}. Check the recipient is a registered participant with a valid role.`
        )
      } else {
        setTxError(msg)
      }
    } finally {
      setIsPending(false)
    }
  }

  if (!waste) return null

  const weightNum = Number(waste.weight)
  const weightStr = weightNum >= 1000 ? `${(weightNum / 1000).toFixed(2)} kg` : `${weightNum} g`

  return (
    <>
      <TransactionConfirmDialog
        open={showConfirm}
        action="Transfer Waste"
        params={[
          { label: 'Waste ID', value: `#${waste.waste_id.toString()}` },
          { label: 'Type', value: wasteTypeLabel(waste.waste_type) },
          { label: 'Weight', value: weightStr },
          { label: 'Recipient', value: formatAddress(recipientTrimmed) },
          ...(note.trim() ? [{ label: 'Note', value: note.trim() }] : [])
        ]}
        isPending={isPending}
        onConfirm={executeTransfer}
        onCancel={() => !isPending && setShowConfirm(false)}
      />
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Transfer Waste
            </DialogTitle>
            <DialogDescription>
              Transfer ownership of this waste item to another participant.
            </DialogDescription>
          </DialogHeader>

          {/* Waste summary */}
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3 text-sm">
            <div className="space-y-0.5">
              <p className="font-medium">{wasteTypeLabel(waste.waste_type)}</p>
              <p className="text-xs text-muted-foreground">ID #{waste.waste_id.toString()}</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {weightStr}
            </Badge>
          </div>

          {/* Sender role warning */}
          {senderRole && !senderCanTransfer && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Manufacturers cannot transfer waste items.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Recipient */}
            <div className="space-y-1">
              <label htmlFor="recipient-input" className="text-sm font-medium">
                Recipient address
              </label>
              <Input
                id="recipient-input"
                placeholder="G…"
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value)
                  setTxError(null)
                }}
                disabled={isPending || !senderCanTransfer}
                className={cn(addressError && 'border-destructive focus-visible:ring-destructive')}
                aria-describedby={addressError ? 'recipient-error' : undefined}
                autoFocus
                required
              />
              {addressError && (
                <p
                  id="recipient-error"
                  role="alert"
                  aria-live="assertive"
                  className="text-xs text-destructive"
                >
                  {addressError}
                </p>
              )}
              {senderRole && senderCanTransfer && (
                <p className="text-xs text-muted-foreground">
                  Valid recipients: {VALID_RECIPIENT_ROLES[senderRole].join(', ')}s
                </p>
              )}
            </div>

            {/* Note */}
            <div className="space-y-1">
              <label htmlFor="note-input" className="text-sm font-medium">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="note-input"
                placeholder="e.g. Collected from site A"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isPending || !senderCanTransfer}
                maxLength={200}
              />
            </div>

            {/* Transaction error */}
            {txError && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{txError}</span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isPending ? 'Transferring…' : 'Transfer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
