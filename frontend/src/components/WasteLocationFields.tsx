import { useState } from 'react'
import { type UseFormRegister, type UseFormSetValue, type FieldErrors } from 'react-hook-form'
import { LocateFixed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import type { WasteFormValues } from './WasteSubmissionFields'

interface WasteLocationFieldsProps {
  register: UseFormRegister<WasteFormValues>
  setValue: UseFormSetValue<WasteFormValues>
  errors: FieldErrors<WasteFormValues>
}

export function WasteLocationFields({ register, setValue, errors }: WasteLocationFieldsProps) {
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    setLocError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue('latitude', pos.coords.latitude.toFixed(6), { shouldValidate: true })
        setValue('longitude', pos.coords.longitude.toFixed(6), { shouldValidate: true })
        setLocating(false)
      },
      () => {
        setLocError('Could not get location. Enter coordinates manually.')
        setLocating(false)
      },
      { timeout: 8000 }
    )
  }

  return (
    <section>
      <label className="block text-sm font-medium mb-2">
        Location <span className="text-destructive">*</span>
      </label>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            type="number"
            step="0.000001"
            placeholder="Latitude"
            aria-label="Latitude"
            {...register('latitude')}
          />
          {errors.latitude && (
            <p className="mt-1 text-sm text-destructive" role="alert">{errors.latitude.message}</p>
          )}
        </div>
        <div>
          <Input
            type="number"
            step="0.000001"
            placeholder="Longitude"
            aria-label="Longitude"
            {...register('longitude')}
          />
          {errors.longitude && (
            <p className="mt-1 text-sm text-destructive" role="alert">{errors.longitude.message}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={locating}
        className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <LocateFixed className={cn('h-4 w-4', locating && 'animate-pulse')} />
        {locating ? 'Locating...' : 'Use current location'}
      </button>
      {locError && (
        <p className="mt-1 text-sm text-destructive" role="alert">{locError}</p>
      )}
    </section>
  )
}
