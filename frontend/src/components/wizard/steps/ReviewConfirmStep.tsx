import { Card } from '../../ui/Card'
import { ReviewConfirmStepProps } from '../types'

export function ReviewConfirmStep({ formData }: ReviewConfirmStepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Review & Confirm</h2>
      <p className="text-sm text-muted-foreground">
        Please review the transfer details before confirming
      </p>

      <Card className="p-4 bg-muted/50">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Selected Waste Items</p>
            <p className="font-medium">{formData.wasteIds?.length || 0} item(s) selected</p>
            <p className="text-sm">{formData.wasteIds?.join(', ')}</p>
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium text-muted-foreground">Recipient</p>
            <p className="font-medium">{formData.recipientAddress || 'Not selected'}</p>
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium text-muted-foreground">Location</p>
            <p className="font-medium">{formData.location || 'Not provided'}</p>
          </div>

          {formData.notes && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p className="font-medium">{formData.notes}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
        <p className="text-sm">
          ⚠️ Please verify all information is correct before confirming. This action cannot be
          undone.
        </p>
      </div>
    </div>
  )
}
