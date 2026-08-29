import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { WasteType } from '@/api/types'
import { useImageUpload } from '@/hooks/useImageUpload'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { wasteSubmissionSchema, toWeightInGrams, type WeightUnit } from '@/lib/validation/wasteSubmission'
import { WasteSubmissionFields, type WasteFormValues } from './WasteSubmissionFields'
import { WasteSubmissionImageUpload } from './WasteSubmissionImageUpload'
import { WasteSubmissionSummary } from './WasteSubmissionSummary'

export { WasteSubmissionFields } from './WasteSubmissionFields'
export { WasteSubmissionImageUpload } from './WasteSubmissionImageUpload'
export { WasteSubmissionSummary } from './WasteSubmissionSummary'

export interface WasteSubmissionFormData {
  wasteType: WasteType
  weight: number
  latitude: string
  longitude: string
  notes: string
  photoCids: string[]
}

interface WasteSubmissionFormProps {
  onSubmit: (data: WasteSubmissionFormData) => Promise<void>
  onCancel: () => void
}

export function WasteSubmissionForm({ onSubmit, onCancel }: WasteSubmissionFormProps) {
  const { images, addImages, removeImage, uploadIds, isUploading, validationError: imageValidationError } = useImageUpload()
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('grams')
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const schema = useMemo(() => wasteSubmissionSchema(weightUnit), [weightUnit])

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<WasteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { wasteType: '', weight: '', latitude: '', longitude: '', notes: '' },
  })

  const onFormSubmit = handleSubmit(async (data) => {
    if (uploadIds.length === 0) return
    const weightInGrams = toWeightInGrams(data.weight, weightUnit)
    setSubmitState('loading')
    setSubmitError(null)

    try {
      await onSubmit({
        wasteType: data.wasteType as WasteType,
        weight: weightInGrams,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes,
        photoCids: uploadIds,
      })
      setSubmitState('success')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed')
      setSubmitState('error')
    }
  })

  const photoError = submitState !== 'idle' || Object.keys(errors).length > 0
    ? uploadIds.length === 0 && images.length === 0 ? 'At least one photo is required' : null
    : null

  if (submitState === 'success') {
    return <WasteSubmissionSummary onDone={onCancel} />
  }

  return (
    <form onSubmit={onFormSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Submit Waste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <WasteSubmissionFields
            control={control}
            register={register}
            setValue={setValue}
            watch={watch}
            errors={errors}
            weightUnit={weightUnit}
            setWeightUnit={setWeightUnit}
          />
          <WasteSubmissionImageUpload
            images={images}
            onAdd={addImages}
            onRemove={removeImage}
            validationError={imageValidationError}
            photoError={photoError}
          />
          {submitError && (
            <p className="text-sm text-destructive" role="alert">{submitError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitState === 'loading' || isUploading}>
              {submitState === 'loading' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
              ) : isUploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading photos...</>
              ) : (
                'Submit Waste'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

