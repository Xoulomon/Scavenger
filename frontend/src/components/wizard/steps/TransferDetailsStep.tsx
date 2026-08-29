import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Input } from '../../ui/Input';
import { TransferFormData } from '../types';

interface TransferDetailsStepProps {
  register: UseFormRegister<TransferFormData>;
  errors: FieldErrors<TransferFormData>;
}

export function TransferDetailsStep({ register, errors }: TransferDetailsStepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Transfer Details</h2>
      <p className="text-sm text-muted-foreground">
        Provide additional information about the transfer
      </p>

      <div>
        <label className="block text-sm font-medium mb-2">
          Transfer Location <span className="text-red-500">*</span>
        </label>
        <Input
          {...register('location', { required: 'Location is required' })}
          placeholder="Enter transfer location"
        />
        {errors.location && (
          <p className="text-sm text-red-500 mt-1">{errors.location.message as string}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
        <textarea
          {...register('notes')}
          placeholder="Add any additional notes about this transfer"
          className="w-full min-h-[100px] p-3 border rounded-lg"
        />
      </div>
    </div>
  );
}
