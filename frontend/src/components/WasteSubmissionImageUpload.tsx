import { ImageUpload } from '@/components/ui/ImageUpload'
import type { UploadImage } from '@/hooks/useImageUpload'

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
  photoError,
}: WasteSubmissionImageUploadProps) {
  return (
    <section>
      <label className="block text-sm font-medium mb-2">
        Photos <span className="text-destructive">*</span>
      </label>
      <ImageUpload
        images={images}
        onAdd={onAdd}
        onRemove={onRemove}
        validationError={validationError}
      />
      {photoError && (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {photoError}
        </p>
      )}
    </section>
  )
}
