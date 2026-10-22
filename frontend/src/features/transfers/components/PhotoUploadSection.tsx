import { Camera, X } from 'lucide-react'
import { useCallback, useRef } from 'react'

export function PhotoUploadSection({
  label,
  photos,
  onPhotosChange,
  inputId,
}: {
  label: string
  photos: File[]
  onPhotosChange: (files: File[]) => void
  inputId: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      onPhotosChange([...photos, ...imageFiles].slice(0, 5))
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [photos, onPhotosChange]
  )

  const removePhoto = useCallback(
    (idx: number) => {
      onPhotosChange(photos.filter((_, i) => i !== idx))
    },
    [photos, onPhotosChange]
  )

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, idx) => (
          <div
            key={`${photo.name}-${idx}`}
            className="group relative h-20 w-20 overflow-hidden rounded-lg border bg-muted"
          >
            <img
              src={URL.createObjectURL(photo)}
              alt={`${label} ${idx + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              aria-label={`Remove photo ${idx + 1}`}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {photos.length < 5 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            aria-label={`Add ${label.toLowerCase()}`}
          >
            <Camera className="h-5 w-5" />
            <span className="text-[10px]">Add</span>
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleFileChange}
        aria-label={`Upload ${label.toLowerCase()}`}
      />
      <p className="text-xs text-muted-foreground">
        Up to 5 photos. Accepted: JPEG, PNG, WebP.
      </p>
    </div>
  )
}
