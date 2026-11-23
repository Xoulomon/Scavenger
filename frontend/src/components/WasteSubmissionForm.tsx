import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { WasteType } from '@/api/types'
import { useImageUpload } from '@/hooks/useImageUpload'
import { useAuth } from '@/contexts/AuthContext'
import { useNetwork } from '@/contexts/NetworkContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import {
  wasteSubmissionSchema,
  toWeightInGrams,
  type WeightUnit
} from '@/lib/validation/wasteSubmission'
import { STATUSES, type Status } from '@/lib/constants'
import { getSubmitErrorMessage, getPhotoError } from '@/lib/format'
import { WasteSubmissionFields, type WasteFormValues } from './WasteSubmissionFields'
import { WasteSubmissionImageUpload } from './WasteSubmissionImageUpload'
import { WasteSubmissionSummary } from './WasteSubmissionSummary'
import { useToast } from '@/components/ui/Toast'

export { WasteSubmissionFields } from './WasteSubmissionFields'
export { WasteSubmissionImageUpload } from './WasteSubmissionImageUpload'
export { WasteSubmissionSummary } from './WasteSubmissionSummary'

/**
 * Shape of the data emitted by {@link WasteSubmissionForm} on submit.
 *
 * Backwards-compatibility note: this interface is unchanged from the previous
 * hand-rolled implementation. `weight` remains normalized to grams (a number)
 * and `latitude`/`longitude` remain strings, so existing consumers do not need
 * to change. Validation is now driven by the shared `wasteSubmissionSchema`
 * (react-hook-form + zod) rather than ad-hoc checks.
 */
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
  /** @deprecated Auth values are now read from AuthContext. Kept for backwards compatibility. */
  isAuthenticated?: boolean
  /** @deprecated Network values are now read from NetworkContext. Kept for backwards compatibility. */
  isOnline?: boolean
  /** @deprecated Theme values are now read from ThemeContext. Kept for backwards compatibility. */
  theme?: 'light' | 'dark'
}

export function WasteSubmissionForm({
  onSubmit,
  onCancel,
  isAuthenticated: _isAuthenticatedProp,
  isOnline: _isOnlineProp,
  theme: _themeProp
}: WasteSubmissionFormProps) {
  const { isAuthenticated } = useAuth()
  const { isOnline } = useNetwork()
  const { theme } = useTheme()
  const { t } = useTranslation()
  const {
    images,
    addImages,
    removeImage,
    uploadIds,
    isUploading,
    validationError: imageValidationError
  } = useImageUpload()
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('grams')
  const [submitState, setSubmitState] = useState<Status>(STATUSES.IDLE)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { toast } = useToast()

  const schema = useMemo(() => wasteSubmissionSchema(weightUnit), [weightUnit])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors }
  } = useForm<WasteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { wasteType: '', weight: '', latitude: '', longitude: '', notes: '' }
  })

  const onFormSubmit = handleSubmit(async (data) => {
    if (!isAuthenticated) {
      setSubmitError('You must be signed in to submit waste')
      setSubmitState('error')
      return
    }
    if (!isOnline) {
      setSubmitError('You must be online to submit waste')
      setSubmitState('error')
      return
    }
    if (uploadIds.length === 0) return
    const weightInGrams = toWeightInGrams(data.weight, weightUnit)
    setSubmitState(STATUSES.LOADING)
    setSubmitError(null)

    try {
      await onSubmit({
        wasteType: data.wasteType as WasteType,
        weight: weightInGrams,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes,
        photoCids: uploadIds
      })
      setSubmitState(STATUSES.SUCCESS)
    } catch (e) {
      const message = getSubmitErrorMessage(e)
      setSubmitError(message)
      setSubmitState(STATUSES.ERROR)
      toast({ title: 'Submission failed', description: message, variant: 'destructive' })
    }
  })

  const photoError = getPhotoError({
    submitState,
    hasFieldErrors: Object.keys(errors).length > 0,
    uploadCount: uploadIds.length,
    imageCount: images.length
  })

  if (submitState === STATUSES.SUCCESS) {
    return <WasteSubmissionSummary onDone={onCancel} />
  }

  return (
    <form
      onSubmit={onFormSubmit}
      noValidate
      data-theme={theme}
      aria-label="Submit waste"
      aria-busy={submitState === 'loading'}
    >
      <Card>
        <CardHeader>
          <CardTitle id="waste-submission-title">{t('wasteSubmission.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 xs:space-y-5 sm:space-y-6">
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
            <p className="text-sm text-destructive" role="alert" aria-live="assertive">
              {submitError}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-2 xs:flex-row xs:gap-3 tablet:gap-4">
            <Button type="button" variant="outline" onClick={onCancel} className="w-full xs:flex-1">
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              className="w-full xs:flex-1"
              disabled={submitState === STATUSES.LOADING || isUploading}
            >
              {submitState === STATUSES.LOADING ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Submitting...
                </>
              ) : isUploading ? (
                <LoadingState
                  variant="inline"
                  label={t('wasteSubmission.actions.uploadingPhotos')}
                />
              ) : (
                t('wasteSubmission.actions.submit')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
