import { AlertTriangle, CheckCircle2 } from 'lucide-react'

import { Input } from '@/components/ui/Input'
import { isValidStellarAddress } from '@/lib/validation/stellarAddress'

export function DestinationStep({
  recipientAddress,
  onRecipientChange,
}: {
  recipientAddress: string
  onRecipientChange: (addr: string) => void
}) {
  const isValid = recipientAddress.length === 0 || isValidStellarAddress(recipientAddress)
  const isFilled = recipientAddress.length > 0

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the Stellar address of the recipient.
      </p>

      <div className="space-y-2">
        <label htmlFor="recipient-address" className="text-sm font-medium">
          Recipient Address
        </label>
        <Input
          id="recipient-address"
          type="text"
          placeholder="G..."
          value={recipientAddress}
          onChange={(e) => onRecipientChange(e.target.value.toUpperCase())}
          aria-label="Recipient Stellar address"
          aria-invalid={isFilled && !isValid}
          className={`font-mono text-xs ${
            isFilled && !isValid ? 'border-destructive focus-visible:ring-destructive' : ''
          }`}
        />
        {isFilled && !isValid && (
          <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
            <AlertTriangle className="h-3 w-3" />
            Invalid Stellar address. Must start with G and be 56 characters.
          </p>
        )}
        {isFilled && isValid && (
          <p className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Valid Stellar address
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Stellar addresses start with G and are 56 characters long.
        </p>
      </div>
    </div>
  )
}
