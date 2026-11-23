import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch
} from 'react-hook-form'
import '@/api/types'
import { type WeightUnit, type WasteFormValues } from '@/lib/validation/wasteSubmission'
import { useAuth } from '@/contexts/AuthContext'
import { useNetwork } from '@/contexts/NetworkContext'
import { useTheme } from '@/contexts/ThemeContext'
import { WasteMaterialSelector, WASTE_TYPE_OPTIONS } from './WasteMaterialSelector'
import { WasteWeightField } from './WasteWeightField'
import { WasteLocationFields } from './WasteLocationFields'

export { WASTE_TYPE_OPTIONS }
export type { WasteFormValues }

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
  setWeightUnit
}: WasteSubmissionFieldsProps) {
  // Auth, network, and theme are provided via scoped contexts rather than drilled props.
  const { user } = useAuth()
  const { isOnline } = useNetwork()
  const { theme } = useTheme()
  const selectedType = watch('wasteType')
  const isDisabled = !isOnline

  return (
    <div data-user-id={user?.id} data-theme={theme}>
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
          disabled={isDisabled}
          {...register('notes')}
        />
      </section>
    </div>
  )
}
