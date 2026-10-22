import { AlertCircle, Camera, FileText, ShieldCheck, Upload, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { useDropzone } from 'react-dropzone'

import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

import { formatFileSize } from '../format'
import type { FileInfo, ValidationErrors } from '../types'

type DropzoneState = ReturnType<typeof useDropzone>

export function KycStep({
  identityDoc,
  identityFile,
  selfieDoc,
  selfieFile,
  docDropzone,
  selfieDropzone,
  onRemoveIdentity,
  onRemoveSelfie,
  errors,
}: {
  identityDoc: FileInfo | null
  identityFile: File | null
  selfieDoc: FileInfo | null
  selfieFile: File | null
  docDropzone: DropzoneState
  selfieDropzone: DropzoneState
  onRemoveIdentity: () => void
  onRemoveSelfie: () => void
  errors: ValidationErrors
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Identity Verification</h2>
        <p className="text-sm text-muted-foreground">
          Upload a government-issued ID for KYC verification.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* Identity Document */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Identity Document <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Passport, driver's license, or national ID. PDF, JPEG, or PNG up to 10 MB.
            </p>

            {!identityFile && !identityDoc ? (
              <div
                {...docDropzone.getRootProps()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                  docDropzone.isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/40'
                )}
              >
                <input {...docDropzone.getInputProps()} aria-label="Upload identity document" />
                <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">
                  {docDropzone.isDragActive
                    ? 'Drop your document here'
                    : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, JPEG, PNG -- max 10 MB
                </p>
              </div>
            ) : (
              <FilePreview
                icon={<FileText className="h-5 w-5 text-primary" aria-hidden="true" />}
                name={identityFile?.name ?? identityDoc?.name}
                size={identityFile?.size ?? identityDoc?.size ?? 0}
                removeLabel="Remove identity document"
                onRemove={onRemoveIdentity}
              />
            )}

            {errors.identityDoc && (
              <p
                role="alert"
                aria-live="assertive"
                className="flex items-center gap-1.5 text-xs text-destructive"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errors.identityDoc}
              </p>
            )}
          </div>

          {/* Selfie Photo */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
              Selfie Photo{' '}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <p className="text-xs text-muted-foreground">
              A clear photo of your face for additional verification. JPEG or PNG up to 10
              MB.
            </p>

            {!selfieFile && !selfieDoc ? (
              <div
                {...selfieDropzone.getRootProps()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
                  selfieDropzone.isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/40'
                )}
              >
                <input {...selfieDropzone.getInputProps()} aria-label="Upload selfie photo" />
                <Camera className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">
                  {selfieDropzone.isDragActive ? 'Drop your photo here' : 'Upload a selfie'}
                </p>
              </div>
            ) : (
              <FilePreview
                icon={<Camera className="h-5 w-5 text-primary" aria-hidden="true" />}
                name={selfieFile?.name ?? selfieDoc?.name}
                size={selfieFile?.size ?? selfieDoc?.size ?? 0}
                removeLabel="Remove selfie photo"
                onRemove={onRemoveSelfie}
              />
            )}

            {errors.selfiePhoto && (
              <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errors.selfiePhoto}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FilePreview({
  icon,
  name,
  size,
  removeLabel,
  onRemove,
}: {
  icon: ReactNode
  name: string | undefined
  size: number
  removeLabel: string
  onRemove: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
