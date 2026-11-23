import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/Select'
import { TransactionConfirmDialog } from '@/components/ui/TransactionConfirmDialog'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { WasteType } from '@/api/types'
import { useRecycleWaste } from '@/hooks/useRecycleWaste'
import { useImageUpload } from '@/hooks/useImageUpload'
import {
  Newspaper,
  Recycle,
  Package,
  Wrench,
  GlassWater,
  LocateFixed,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Waste type config with icons ─────────────────────────────────────────────

const WASTE_TYPES: { value: WasteType; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: WasteType.Paper,
    label: 'Paper',
    icon: <Newspaper className="h-4 w-4" />,
    color: 'text-yellow-600'
  },
  {
    value: WasteType.PetPlastic,
    label: 'PET Plastic',
    icon: <Recycle className="h-4 w-4" />,
    color: 'text-blue-600'
  },
  {
    value: WasteType.Plastic,
    label: 'Plastic',
    icon: <Package className="h-4 w-4" />,
    color: 'text-purple-600'
  },
  {
    value: WasteType.Metal,
    label: 'Metal',
    icon: <Wrench className="h-4 w-4" />,
    color: 'text-slate-600 dark:text-slate-400'
  },
  {
    value: WasteType.Glass,
    label: 'Glass',
    icon: <GlassWater className="h-4 w-4" />,
    color: 'text-cyan-600'
  }
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  address: string
  onClose: () => void
  onSuccess?: (wasteId: bigint) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RegisterWasteModal({ open, address, onClose, onSuccess }: Props) {
  const [wasteType, setWasteType] = useState<WasteType>(WasteType.Paper)
  const [weight, setWeight] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<bigint | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingParams, setPendingParams] = useState<{
    weightGrams: bigint
    lat: bigint
    lng: bigint
  } | null>(null)

  const { mutate: recycleWaste, isPending } = useRecycleWaste()
  const { images, addImages, removeImage, cids, isUploading, validationError } = useImageUpload()
  function reset() {
    setWeight('')
    setLatitude('')
    setLongitude('')
    setWasteType(WasteType.Paper)
    setLocError(null)
    setSuccessId(null)
    setShowConfirm(false)
    setPendingParams(null)
  }

  function handleClose() {
    if (isPending) return
    reset()
    onClose()
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6))
        setLongitude(pos.coords.longitude.toFixed(6))
        setLocating(false)
      },
      () => {
        setLocError('Could not get location. Enter coordinates manually.')
        setLocating(false)
      },
      { timeout: 8000 }
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const w = parseFloat(weight)
    if (!w || w <= 0) return

    const weightGrams = BigInt(Math.round(w))
    const lat = BigInt(Math.round(parseFloat(latitude || '0') * 1_000_000))
    const lng = BigInt(Math.round(parseFloat(longitude || '0') * 1_000_000))

    // Show confirmation before submitting
    setPendingParams({ weightGrams, lat, lng })
    setShowConfirm(true)
  }

  function executeRegister() {
    if (!pendingParams) return
    const { weightGrams, lat, lng } = pendingParams
    recycleWaste(
      { recycler: address, wasteType, weightGrams, latitude: lat, longitude: lng },
      {
        onSuccess: (wasteId) => {
          setShowConfirm(false)
          setSuccessId(wasteId)
          onSuccess?.(wasteId)
        },
        onSettled: () => setShowConfirm(false)
      }
    )
  }

  // ── Success state ───────────────────────────────────────────────────────
  if (successId !== null) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <div
            className="flex flex-col items-center gap-4 py-6 text-center"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div>
              <p className="text-lg font-semibold">Waste registered</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your waste item has been recorded on-chain.
              </p>
            </div>
            <div className="rounded-md border bg-muted/40 px-6 py-3">
              <p className="text-xs text-muted-foreground">Waste ID</p>
              <p className="font-mono text-xl font-bold">#{successId.toString()}</p>
              {cids.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {cids.length} image{cids.length !== 1 ? 's' : ''} attached
                </p>
              )}
            </div>
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const selectedType = WASTE_TYPES.find((t) => t.value === wasteType)
  const weightNum = parseFloat(weight) || 0
  const weightDisplay = weightNum >= 1000 ? `${(weightNum / 1000).toFixed(2)} kg` : `${weightNum} g`

  return (
    <>
      <TransactionConfirmDialog
        open={showConfirm}
        action="Register Waste"
        params={[
          { label: 'Type', value: selectedType?.label ?? '' },
          { label: 'Weight', value: weightDisplay },
          ...(latitude ? [{ label: 'Latitude', value: latitude }] : []),
          ...(longitude ? [{ label: 'Longitude', value: longitude }] : []),
          ...(cids.length > 0 ? [{ label: 'Images', value: `${cids.length} uploaded` }] : [])
        ]}
        isPending={isPending}
        onConfirm={executeRegister}
        onCancel={() => !isPending && setShowConfirm(false)}
      />
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Waste</DialogTitle>
            <DialogDescription>Record a new waste item on the supply chain.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Waste type with icons */}
            <div className="space-y-1">
              <label htmlFor="waste-type-trigger" className="text-sm font-medium">
                Waste type
              </label>
              <Select
                value={String(wasteType)}
                onValueChange={(v) => setWasteType(Number(v) as WasteType)}
              >
                <SelectTrigger id="waste-type-trigger" className="w-full" autoFocus>
                  <SelectValue>
                    {selectedType && (
                      <span className="flex items-center gap-2">
                        <span className={selectedType.color}>{selectedType.icon}</span>
                        {selectedType.label}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {WASTE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={String(t.value)}>
                      <span className="flex items-center gap-2">
                        <span className={t.color}>{t.icon}</span>
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weight in grams */}
            <div className="space-y-1">
              <label htmlFor="weight-input" className="text-sm font-medium">
                Weight (grams)
              </label>
              <Input
                id="weight-input"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 500"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Location</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={useCurrentLocation}
                  disabled={locating || isPending}
                >
                  <LocateFixed className={cn('h-3.5 w-3.5', locating && 'animate-pulse')} />
                  {locating ? 'Locating…' : 'Use current location'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="lat-input" className="text-xs text-muted-foreground">
                    Latitude
                  </label>
                  <Input
                    id="lat-input"
                    type="number"
                    min="-90"
                    max="90"
                    step="0.000001"
                    placeholder="e.g. 40.714"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="lng-input" className="text-xs text-muted-foreground">
                    Longitude
                  </label>
                  <Input
                    id="lng-input"
                    type="number"
                    min="-180"
                    max="180"
                    step="0.000001"
                    placeholder="e.g. -74.006"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </div>
              </div>

              {locError && (
                <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                  {locError}
                </p>
              )}
            </div>

            {/* Image upload */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Photos <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <ImageUpload
                images={images}
                onAdd={addImages}
                onRemove={removeImage}
                validationError={validationError}
                disabled={isPending}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || isUploading || !weight}>
                {isUploading ? 'Uploading images…' : isPending ? 'Submitting…' : 'Register'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
