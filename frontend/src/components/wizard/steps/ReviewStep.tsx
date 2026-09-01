import { Card } from '../../ui/Card'
import { WasteType } from '@/api/types'
import { ReviewStepProps } from '../types'

const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  [WasteType.Paper]: 'Paper',
  [WasteType.PetPlastic]: 'PET Plastic',
  [WasteType.Plastic]: 'Plastic',
  [WasteType.Metal]: 'Metal',
  [WasteType.Glass]: 'Glass',
  [WasteType.Organic]: 'Organic',
  [WasteType.Electronic]: 'Electronic',
};

export function ReviewStep({ formData }: ReviewStepProps) {
  const weightNum = Number(formData.weight) || 0;
  const weightDisplay = weightNum >= 1000 ? `${(weightNum / 1000).toFixed(2)} kg` : `${weightNum} g`;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Review & Submit</h2>
      <p className="text-sm text-muted-foreground">
        Please review your waste submission details
      </p>

      <Card className="p-4 bg-muted/50">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Waste Type</p>
            <p className="font-medium">{WASTE_TYPE_LABELS[formData.wasteType as WasteType] || 'Not selected'}</p>
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium text-muted-foreground">Weight</p>
            <p className="font-medium">{weightDisplay}</p>
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium text-muted-foreground">Location</p>
            <p className="font-medium">
              {formData.latitude && formData.longitude
                ? `${formData.latitude}, ${formData.longitude}`
                : 'Not provided'
              }
            </p>
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
          ⚠️ Please verify all information is correct before submitting. This action cannot be undone.
        </p>
      </div>
    </div>
  );
}
