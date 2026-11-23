import * as React from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'

export interface TxParam {
  label: string
  value: React.ReactNode
}

export interface TransactionConfirmDialogProps {
  open: boolean
  /** Human-readable action name, e.g. "Transfer Waste" */
  action: string
  /** Key/value pairs summarising the transaction */
  params: TxParam[]
  /** Estimated fee string, e.g. "~0.00001 XLM" */
  estimatedFee?: string
  /** True while the transaction is being signed / submitted */
  isPending: boolean
  /** Called when the user clicks Confirm */
  onConfirm: () => void
  /** Called when the user clicks Cancel or closes the dialog */
  onCancel: () => void
}

export function TransactionConfirmDialog({
  open,
  action,
  params,
  estimatedFee = '~0.00001 XLM',
  isPending,
  onConfirm,
  onCancel
}: TransactionConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isPending && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Confirm Transaction
          </DialogTitle>
          <DialogDescription>
            Review the details below before signing with your wallet.
          </DialogDescription>
        </DialogHeader>

        {/* Transaction summary */}
        <div
          className="rounded-md border bg-muted/40 divide-y text-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Action</span>
            <span className="font-semibold">{action}</span>
          </div>
          {params.map((p) => (
            <div key={p.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">{p.label}</span>
              <span className="font-medium text-right max-w-[60%] truncate">{p.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Estimated fee</span>
            <span className="font-mono text-xs">{estimatedFee}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Pending…
              </>
            ) : (
              'Confirm & Sign'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
