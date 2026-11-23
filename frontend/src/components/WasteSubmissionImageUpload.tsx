import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { FormField } from '@/components/ui/FormField'
import type { UploadImage } from '@/hooks/useImageUpload'

/**
 * WasteSubmissionImageUpload
 *
 * Storybook-style usage:
 *
 * ```tsx
 * <WasteSubmissionImageUpload
 *   images={images}
 *   onAdd={handleAdd}
 *   onRemove={handleRemove}
 *   validationError={null}
 *   photoError={errors.photos?.message}
 * />
 * ```
 *
 * Renders the photo upload section for the waste submission form using the
 * shared `ImageUpload` and `FormField` UI primitives. Zod-derived validation
 * errors from react-hook-form are surfaced via `photoError` and rendered with
 * `role="alert"` for accessibility.
 */
export interface WasteSubmissionImageUploadProps {
  images: UploadImage[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  validationError?: string | null
  photoError?: string | null
}

export function WasteSubmissionImageUpload({
  images,
  onAdd,
  onRemove,
  validationError,
  photoError
}: WasteSubmissionImageUploadProps) {
  const errorId = useId()
  const { t } = useTranslation()

  return (
    <FormField
      label={t('wasteSubmission.imageUpload.label')}
      required
      error={photoError ?? undefined}
      htmlFor="waste-submission-photos"
    >
      <ImageUpload
        images={images}
        onAdd={onAdd}
        onRemove={onRemove}
        validationError={validationError}
      />
      {photoError && (
        <p
          id={errorId}
          className="mt-1 break-words text-xs text-destructive xs:text-sm tablet:text-sm"
          role="alert"
          aria-live="assertive"
        >
          {photoError}
        </p>
      )}
    </FormField>
  )
}
