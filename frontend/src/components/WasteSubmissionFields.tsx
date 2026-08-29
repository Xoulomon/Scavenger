import { type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue, type UseFormWatch } from 'react-hook-form'
import { WasteType } from '@/api/types'
import { type WeightUnit } from '@/lib/validation/wasteSubmission'
import { WasteMaterialSelector, WASTE_TYPE_OPTIONS } from './WasteMaterialSelector'
import { WasteWeightField } from './WasteWeightField'
import { WasteLocationFields } from './WasteLocationFields'

export { WASTE_TYPE_OPTIONS }

export interface WasteFormValues {
  wasteType: WasteType | ''
  weight: string
  latitude: string
  longitude: string
  notes: string
}

export interface WasteSubmissionFieldsProps {
  control: Control<WasteFormValues>
  register: UseFormRegister<WasteFormValues>
  setValue: UseFormSetValue<WasteFormValues>
  watch: UseFormWatch<WasteFormValues>
  errors: FieldErrors<WasteFormValues>
  weightUnit: WeightUnit
  setWeightUnit: (unit: WeightUnit) => void
}

export function WasteSubmissionFields({
  control,
  register,
  setValue,
  watch,
  errors,
  weightUnit,
  setWeightUnit,
}: WasteSubmissionFieldsProps) {
  const selectedType = watch('wasteType')

  return (
    <>
      <WasteMaterialSelector control={control} selectedType={selectedType} errors={errors} />

      <WasteWeightField
        register={register}
        watch={watch}
        errors={errors}
        weightUnit={weightUnit}
        setWeightUnit={setWeightUnit}
      />

      <WasteLocationFields register={register} setValue={setValue} errors={errors} />

      <section>
        <label htmlFor="notes-input" className="block text-sm font-medium mb-2">
          Notes
        </label>
        <textarea
          id="notes-input"
          rows={3}
          placeholder="Optional notes about this waste submission..."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('notes')}
        />
      </section>
    </>
  )
}
