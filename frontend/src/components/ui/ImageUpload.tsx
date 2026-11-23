import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImageFile, MAX_IMAGES, MAX_SIZE_MB } from '@/hooks/useImageUpload'
import { ipfsGatewayUrl } from '@/lib/ipfs'

interface Props {
  images: ImageFile[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  validationError: string | null
  disabled?: boolean
}

export function ImageUpload({ images, onAdd, onRemove, validationError, disabled }: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (!disabled) onAdd(accepted)
    },
    [onAdd, disabled]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [], 'image/gif': [] },
    maxFiles: MAX_IMAGES,
    disabled
  })

  const canAdd = images.length < MAX_IMAGES && !disabled

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {canAdd && (
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/40',
            disabled && 'pointer-events-none opacity-50'
          )}
        >
          <input {...getInputProps()} aria-label="Upload images" />
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              {isDragActive ? 'Drop images here' : 'Drag & drop or click to upload'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              JPEG, PNG, WebP, GIF · max {MAX_SIZE_MB} MB · up to {MAX_IMAGES} images
            </p>
          </div>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {validationError}
        </p>
      )}

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
            >
              <img
                src={img.cid ? ipfsGatewayUrl(img.cid) : img.preview}
                alt={`Preview of ${img.file.name}`}
                className="h-full w-full object-cover"
              />

              {/* Progress overlay */}
              {img.progress > 0 && img.progress < 100 && !img.error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                  <span className="text-xs font-medium text-white">{img.progress}%</span>
                </div>
              )}

              {/* Error overlay */}
              {img.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-destructive/70 p-1">
                  <p className="text-center text-[10px] leading-tight text-white">{img.error}</p>
                </div>
              )}

              {/* Uploaded badge */}
              {img.cid && !img.error && (
                <div className="absolute bottom-1 right-1">
                  <CheckCircle2 className="h-4 w-4 text-green-400 drop-shadow" />
                </div>
              )}

              {/* Remove button */}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove image ${img.file.name}`}
                  onClick={() => onRemove(img.id)}
                  className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-0.5 text-white transition-opacity group-hover:flex hover:bg-black/80 focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {images.filter((i) => i.cid).length}/{images.length} uploaded
          {images.length < MAX_IMAGES && ` · ${MAX_IMAGES - images.length} remaining`}
        </p>
      )}
    </div>
  )
}
