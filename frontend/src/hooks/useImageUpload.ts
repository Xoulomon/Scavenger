import { useState, useCallback } from 'react'
import imageCompression from 'browser-image-compression'
import { uploadToIPFS } from '@/lib/ipfs'

export const MAX_IMAGES = 5
export const MAX_SIZE_MB = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface ImageFile {
  id: string
  file: File
  preview: string
  progress: number
  uploadId?: string
  error?: string
}

export interface ImageUploadConfig {
  maxImages?: number
  maxSizeMB?: number
  acceptedTypes?: string[]
  compressionOptions?: {
    maxSizeMB?: number
    maxWidthOrHeight?: number
    useWebWorker?: boolean
  }
  onUpload?: (file: File, onProgress: (percent: number) => void) => Promise<string>
}

export interface UseImageUploadReturn {
  images: ImageFile[]
  addImages: (files: File[]) => Promise<void>
  removeImage: (id: string) => void
  uploadIds: string[]
  isUploading: boolean
  validationError: string | null
}

/**
 * Configurable hook for image upload with validation, compression, and progress tracking
 * @param config - Upload configuration
 * @returns Image management interface with upload state
 */
export function useImageUpload(config: ImageUploadConfig = {}): UseImageUploadReturn {
  const {
    maxImages = MAX_IMAGES,
    maxSizeMB = MAX_SIZE_MB,
    acceptedTypes = ACCEPTED_TYPES,
    compressionOptions = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    },
    onUpload,
  } = config

  const [images, setImages] = useState<ImageFile[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!acceptedTypes.includes(file.type)) {
        return `${file.name}: unsupported format (${acceptedTypes.join(', ')})`
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `${file.name}: exceeds ${maxSizeMB} MB limit`
      }
      return null
    },
    [acceptedTypes, maxSizeMB]
  )

  const addImages = useCallback(
    async (files: File[]) => {
      setValidationError(null)

      const remaining = maxImages - images.length
      if (remaining <= 0) {
        setValidationError(`Maximum ${maxImages} images allowed.`)
        return
      }

      const toProcess = files.slice(0, remaining)

      for (const file of toProcess) {
        const err = validateFile(file)
        if (err) {
          setValidationError(err)
          return
        }
      }

      const newEntries: ImageFile[] = toProcess.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
      }))

      setImages((prev) => [...prev, ...newEntries])

      for (const entry of newEntries) {
        try {
          const compressed = await imageCompression(entry.file, compressionOptions)

          const uploadId = onUpload
            ? await onUpload(compressed, (pct) => {
                setImages((prev) =>
                  prev.map((img) =>
                    img.id === entry.id ? { ...img, progress: pct } : img
                  )
                )
              })
            : await uploadToIPFS(compressed, (pct) => {
                setImages((prev) =>
                  prev.map((img) =>
                    img.id === entry.id ? { ...img, progress: pct } : img
                  )
                )
              })

          setImages((prev) =>
            prev.map((img) =>
              img.id === entry.id ? { ...img, uploadId, progress: 100 } : img
            )
          )
        } catch (e) {
          const error = e instanceof Error ? e.message : 'Upload failed'
          setImages((prev) =>
            prev.map((img) =>
              img.id === entry.id ? { ...img, error, progress: 0 } : img
            )
          )
        }
      }
    },
    [images.length, maxImages, validateFile, compressionOptions, onUpload]
  )

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id)
      if (img) URL.revokeObjectURL(img.preview)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const uploadIds = images.filter((i) => i.uploadId).map((i) => i.uploadId!)
  const isUploading = images.some((i) => i.progress > 0 && i.progress < 100 && !i.error)

  return { images, addImages, removeImage, uploadIds, isUploading, validationError }
}
