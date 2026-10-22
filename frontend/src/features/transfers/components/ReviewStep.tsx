import { ArrowRight, ImageIcon } from 'lucide-react'

import { formatAddress,wasteTypeLabel } from '@/lib/helpers'

import { formatWasteWeight } from '../format'
import type { TransferFormData } from '../types'
import { SignaturePad } from './SignaturePad'

export function ReviewStep({
  form,
  senderAddress,
  onConfirmChange,
}: {
  form: TransferFormData
  senderAddress: string
  onConfirmChange: (confirmed: boolean) => void
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Review all details before submitting the transfer.
      </p>

      {/* Transfer summary */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <h4 className="text-sm font-semibold">Transfer Summary</h4>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Waste ID</span>
            <p className="font-medium">#{form.waste?.waste_id.toString()}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Material Type</span>
            <p className="font-medium">
              {form.waste ? wasteTypeLabel(form.waste.waste_type) : '-'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Weight</span>
            <p className="font-medium">
              {form.waste ? formatWasteWeight(form.waste.weight) : '-'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Status</span>
            <p className="font-medium">
              {form.waste?.is_confirmed ? 'Confirmed' : 'Unconfirmed'}
            </p>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex-1">
              <span className="text-muted-foreground">From</span>
              <p className="font-mono text-xs">{formatAddress(senderAddress)}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-muted-foreground">To</span>
              <p className="font-mono text-xs">{formatAddress(form.recipientAddress)}</p>
            </div>
          </div>
        </div>

        {form.transferNotes && (
          <div className="border-t pt-3">
            <span className="text-xs text-muted-foreground">Transfer Notes</span>
            <p className="text-sm">{form.transferNotes}</p>
          </div>
        )}

        {form.conditionNotes && (
          <div className="border-t pt-3">
            <span className="text-xs text-muted-foreground">Condition Notes</span>
            <p className="text-sm">{form.conditionNotes}</p>
          </div>
        )}

        {form.handlingInstructions && (
          <div className="border-t pt-3">
            <span className="text-xs text-muted-foreground">Handling Instructions</span>
            <p className="text-sm">{form.handlingInstructions}</p>
          </div>
        )}

        {(form.beforePhotos.length > 0 || form.afterPhotos.length > 0) && (
          <div className="border-t pt-3">
            <span className="text-xs text-muted-foreground">Documentation Photos</span>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span>
                {form.beforePhotos.length} before, {form.afterPhotos.length} after
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Signature / confirmation */}
      <SignaturePad onSign={onConfirmChange} signed={form.senderConfirmed} />

      <div className="flex items-start gap-2">
        <input
          id="confirm-checkbox"
          type="checkbox"
          checked={form.senderConfirmed}
          onChange={(e) => onConfirmChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border"
          aria-label="Confirm transfer details are correct"
        />
        <label htmlFor="confirm-checkbox" className="text-sm">
          I confirm that all transfer details are correct and I authorize this material transfer
          to the specified recipient.
        </label>
      </div>
    </div>
  )
}
