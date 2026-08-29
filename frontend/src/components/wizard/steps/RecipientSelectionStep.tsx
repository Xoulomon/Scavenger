import { Input } from '../../ui/Input'
import { RecipientSelectionStepProps } from '../types'

const mockRecipients = [
  { address: 'GABC...XYZ1', name: 'Recycling Center A', type: 'Recycler' },
  { address: 'GDEF...XYZ2', name: 'Waste Processor B', type: 'Processor' },
  { address: 'GHIJ...XYZ3', name: 'Collection Point C', type: 'Collector' },
];

export function RecipientSelectionStep({ register, errors, formData: _formData }: RecipientSelectionStepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Select Recipient</h2>
      <p className="text-sm text-muted-foreground">
        Choose who will receive the waste transfer
      </p>

      <div className="space-y-2">
        {mockRecipients.map((recipient) => (
          <label
            key={recipient.address}
            className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
          >
            <input
              type="radio"
              value={recipient.address}
              {...register('recipientAddress', { required: 'Recipient is required' })}
              className="mr-3"
            />
            <div className="flex-1">
              <p className="font-medium">{recipient.name}</p>
              <p className="text-sm text-muted-foreground">
                {recipient.type} • {recipient.address}
              </p>
            </div>
          </label>
        ))}
      </div>

      {errors.recipientAddress && (
        <p className="text-sm text-red-500">{errors.recipientAddress.message as string}</p>
      )}

      <div className="pt-4 border-t">
        <label className="block text-sm font-medium mb-2">Or enter custom address:</label>
        <Input
          {...register('recipientAddress')}
          placeholder="Enter Stellar address"
        />
      </div>
    </div>
  );
}
