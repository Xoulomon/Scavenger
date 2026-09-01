import { useState } from 'react'
import { Input } from '../../ui/Input'
import { LocateFixed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LocationStepProps } from '../types'

export function LocationStep({ register, errors, formData }: LocationStepProps) {
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const latInput = document.getElementById('latitude-input') as HTMLInputElement;
        const lngInput = document.getElementById('longitude-input') as HTMLInputElement;
        if (latInput && lngInput) {
          latInput.value = lat;
          lngInput.value = lng;
        }
        setLocating(false);
      },
      () => {
        setLocError('Could not get location. Enter coordinates manually.');
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Location</h2>
      <p className="text-sm text-muted-foreground">
        Provide the collection location coordinates
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="latitude-input" className="block text-sm font-medium mb-2">
            Latitude <span className="text-red-500">*</span>
          </label>
          <Input
            id="latitude-input"
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            placeholder="e.g. 40.7128"
            {...register('latitude')}
          />
          {errors.latitude && (
            <p className="text-sm text-red-500 mt-1">{errors.latitude.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="longitude-input" className="block text-sm font-medium mb-2">
            Longitude <span className="text-red-500">*</span>
          </label>
          <Input
            id="longitude-input"
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            placeholder="e.g. -74.0060"
            {...register('longitude')}
          />
          {errors.longitude && (
            <p className="text-sm text-red-500 mt-1">{errors.longitude.message as string}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={locating}
        className="flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <LocateFixed className={cn('h-4 w-4', locating && 'animate-pulse')} />
        {locating ? 'Locating…' : 'Use current location'}
      </button>

      {locError && (
        <p className="text-sm text-red-500" role="alert">{locError}</p>
      )}
    </div>
  );
}
