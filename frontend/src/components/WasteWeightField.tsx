import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { type UseFormRegister, type UseFormWatch, type FieldErrors } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { convertWeight, type WeightUnit } from '@/lib/validation/wasteSubmission'
import { formatWeightConversion, getWeightPlaceholder, getWeightUnitLabel } from '@/lib/format'
import type { WasteFormValues } from './WasteSubmissionFields'

/**
 * WasteWeightField
 *
 * Numeric weight entry with a unit toggle (grams/kilograms) and a live
 * converted-weight hint. Validation is driven by the zod schema in
 * `@/lib/validation/wasteSubmission` via react-hook-form registration.
 *
 * @example
 * <WasteWeightField
 *   register={register}
 *   watch={watch}
 *   errors={errors}
 *   weightUnit={weightUnit}
 *   setWeightUnit={setWeightUnit}
 * />
 */

interface WasteWeightFieldProps {
  register: UseFormRegister<WasteFormValues>
  watch: UseFormWatch<WasteFormValues>
  errors: FieldErrors<WasteFormValues>
  weightUnit: WeightUnit
  setWeightUnit: (unit: WeightUnit) => void
}

export function WasteWeightField({
  register,
  watch,
  errors,
  weightUnit,
  setWeightUnit
}: WasteWeightFieldProps) {
  const { t } = useTranslation()
  const weightValue = watch('weight')
  const convertedWeight = useMemo(
    () => formatWeightConversion(convertWeight(weightValue, weightUnit)),
    [weightValue, weightUnit]
  )
  const hasError = Boolean(errors.weight)
  const nextWeightUnit: WeightUnit = weightUnit === 'grams' ? 'kilograms' : 'grams'

  return (
    <section>
      <label htmlFor="weight-input" className="block text-sm font-medium mb-2">
        {t('waste.form.weight.label')} <span className="text-destructive">*</span>
      </label>
      <div className="flex flex-col gap-2 xs:flex-row tablet:gap-3">
        <Input
          id="weight-input"
          type="number"
          step="any"
          min="0"
          inputMode="decimal"
          className="w-full min-w-0"
          placeholder={getWeightPlaceholder(weightUnit)}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? 'weight-error' : undefined}
          {...register('weight', { valueAsNumber: true })}
        />
        <button
          type="button"
          onClick={() => setWeightUnit(nextWeightUnit)}
          className="shrink-0 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent xs:w-auto tablet:px-5"
          aria-label={t('waste.form.weight.switchUnit', {
            unit: t(`waste.units.${nextWeightUnit}`)
          })}
          aria-pressed={weightUnit === 'kilograms'}
        >
          {getWeightUnitLabel(weightUnit)}
        </button>
      </div>
      {convertedWeight && (
        <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
          {t('waste.form.weight.converted', { value: convertedWeight })}
        </p>
      )}
      {errors.weight && (
        <p id="weight-error" className="mt-1 text-sm text-destructive" role="alert">
          {errors.weight.message}
        </p>
      )}
    </section>
  )
}
