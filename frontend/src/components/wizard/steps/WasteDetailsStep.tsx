import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Input } from '../../ui/Input';

interface WasteDetailsStepProps {
  register: UseFormRegister<any>;
  errors: FieldErrors;
}

export function WasteDetailsStep({ register, errors }: WasteDetailsStepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Waste Details</h2>
      <p className="text-sm text-muted-foreground">
        Provide weight and any additional notes
      </p>

      <div>
        <label className="block text-sm font-medium mb-2">
          Weight (grams) <span className="text-red-500">*</span>
        </label>
        <Input
          type="number"
          min="1"
          step="1"
          placeholder="Enter weight in grams"
          {...register('weight')}
        />
        {errors.weight && (
          <p className="text-sm text-red-500 mt-1">{errors.weight.message as string}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
        <textarea
          {...register('notes')}
          placeholder="Add any additional notes about this waste"
          className="w-full min-h-[100px] p-3 border rounded-lg"
        />
      </div>
    </div>
  );
}
