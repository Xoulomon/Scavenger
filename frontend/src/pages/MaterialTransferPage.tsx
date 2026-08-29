import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ArrowRight,
  ArrowLeft,
  Send,
  Package,
  MapPin,
  FileText,
  Camera,
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  AlertTriangle,
  History,
  X,
  Loader2,
  ImageIcon,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useContract } from '@/context/ContractContext'
import { useWallet } from '@/context/WalletContext'
import { networkConfig } from '@/lib/stellar'
import { wasteTypeLabel, formatDate, formatAddress } from '@/lib/helpers'
import { isValidStellarAddress } from '@/lib/validation/stellarAddress'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAppTitle } from '@/hooks/useAppTitle'
import type { Waste, WasteTransfer } from '@/api/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type TransferStep = 'select' | 'destination' | 'documentation' | 'review'

type TransferStatus = 'pending' | 'in-transit' | 'delivered' | 'confirmed'

interface TransferFormData {
  wasteId: bigint | null
  waste: Waste | null
  recipientAddress: string
  transferNotes: string
  conditionNotes: string
  handlingInstructions: string
  beforePhotos: File[]
  afterPhotos: File[]
  senderConfirmed: boolean
}

interface LocalTransferRecord {
  wasteId: number
  from: string
  to: string
  transferredAt: number
  notes: string
  conditionNotes: string
  handlingInstructions: string
  status: TransferStatus
}

const STEPS: { key: TransferStep; label: string; icon: React.ReactNode }[] = [
  { key: 'select', label: 'Select Waste', icon: <Package className="h-4 w-4" /> },
  { key: 'destination', label: 'Destination', icon: <MapPin className="h-4 w-4" /> },
  { key: 'documentation', label: 'Documentation', icon: <FileText className="h-4 w-4" /> },
  { key: 'review', label: 'Review', icon: <CheckCircle2 className="h-4 w-4" /> },
]

const INITIAL_FORM: TransferFormData = {
  wasteId: null,
  waste: null,
  recipientAddress: '',
  transferNotes: '',
  conditionNotes: '',
  handlingInstructions: '',
  beforePhotos: [],
  afterPhotos: [],
  senderConfirmed: false,
}

// ── Local transfer history (session) ────────────────────────────────────────

const _transferHistory: LocalTransferRecord[] = []

function addTransferRecord(record: LocalTransferRecord) {
  _transferHistory.unshift(record)
  if (_transferHistory.length > 100) _transferHistory.pop()
}

function getTransferHistory(): LocalTransferRecord[] {
  return [..._transferHistory]
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useParticipantWastes() {
  const { config } = useContract()
  const { address } = useWallet()

  return useQuery<Waste[]>({
    queryKey: ['participant-wastes', address],
    queryFn: async () => {
      if (!address) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      const ids = await client.getParticipantWastes(address)
      const results = await Promise.all(
        ids.slice(-50).map((id) => client.getWaste(BigInt(id as unknown as number)))
      )
      return results.filter((w): w is Waste => w !== null && w.is_active)
    },
    enabled: !!address,
    staleTime: 30_000,
  })
}

function useWasteTransferHistory(wasteId: bigint | null) {
  const { config } = useContract()

  return useQuery<WasteTransfer[]>({
    queryKey: ['waste-transfer-history', wasteId?.toString()],
    queryFn: async () => {
      if (wasteId === null) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getWasteTransferHistory(wasteId)
    },
    enabled: wasteId !== null,
    staleTime: 15_000,
  })
}

function useTransferWaste() {
  const { config } = useContract()
  const { address } = useWallet()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      wasteId,
      to,
      note,
    }: {
      wasteId: bigint
      to: string
      note: string
    }) => {
      if (!address) throw new Error('No wallet connected.')
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.transferWaste(wasteId, address, to, BigInt(0), BigInt(0), note, address)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participant-wastes'] })
      qc.invalidateQueries({ queryKey: ['waste-transfer-history'] })
    },
  })
}

// ── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({
  currentStep,
  onStepClick,
}: {
  currentStep: TransferStep
  onStepClick: (step: TransferStep) => void
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <nav aria-label="Transfer progress" className="mb-6">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isClickable = idx < currentIdx

          return (
            <li key={step.key} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.key)}
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${idx + 1}: ${step.label}${isCompleted ? ' (completed)' : ''}`}
                className={`flex w-full flex-col items-center gap-1 rounded-lg p-2 text-xs transition-colors sm:flex-row sm:gap-2 sm:p-3 sm:text-sm ${
                  isCurrent
                    ? 'bg-primary/10 font-medium text-primary'
                    : isCompleted
                      ? 'cursor-pointer text-emerald-600 hover:bg-emerald-50'
                      : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <ArrowRight
                  className={`mx-1 hidden h-4 w-4 shrink-0 sm:block ${
                    idx < currentIdx ? 'text-emerald-500' : 'text-muted-foreground/30'
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ── Step 1: Select waste ────────────────────────────────────────────────────

function SelectWasteStep({
  wastes,
  isLoading,
  selectedId,
  onSelect,
}: {
  wastes: Waste[]
  isLoading: boolean
  selectedId: bigint | null
  onSelect: (waste: Waste) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (wastes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
        <Package className="h-10 w-10 opacity-30" />
        <p className="text-sm">No active waste materials found.</p>
        <p className="text-xs">Submit materials first before transferring.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Select the waste material you want to transfer.
      </p>
      <div className="divide-y divide-border rounded-lg border">
        {wastes.map((waste) => {
          const isSelected = selectedId !== null && waste.waste_id === selectedId
          return (
            <button
              key={waste.waste_id.toString()}
              type="button"
              onClick={() => onSelect(waste)}
              aria-pressed={isSelected}
              aria-label={`Select waste #${waste.waste_id} - ${wasteTypeLabel(waste.waste_type)}`}
              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-accent/50 ${
                isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary' : ''
              }`}
            >
              <div className="space-y-1">
                <p className="font-medium">
                  Waste #{waste.waste_id.toString()}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{wasteTypeLabel(waste.waste_type)}</Badge>
                  <span>
                    {Number(waste.weight) >= 1000
                      ? `${(Number(waste.weight) / 1000).toFixed(2)} kg`
                      : `${waste.weight.toString()} g`}
                  </span>
                  {waste.is_confirmed && (
                    <Badge className="bg-emerald-100 text-emerald-700">Confirmed</Badge>
                  )}
                </div>
              </div>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30'
                }`}
              >
                {isSelected && <CheckCircle2 className="h-3 w-3" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 2: Destination ─────────────────────────────────────────────────────

function DestinationStep({
  recipientAddress,
  onRecipientChange,
}: {
  recipientAddress: string
  onRecipientChange: (addr: string) => void
}) {
  const isValid = recipientAddress.length === 0 || isValidStellarAddress(recipientAddress)
  const isFilled = recipientAddress.length > 0

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the Stellar address of the recipient.
      </p>

      <div className="space-y-2">
        <label htmlFor="recipient-address" className="text-sm font-medium">
          Recipient Address
        </label>
        <Input
          id="recipient-address"
          type="text"
          placeholder="G..."
          value={recipientAddress}
          onChange={(e) => onRecipientChange(e.target.value.toUpperCase())}
          aria-label="Recipient Stellar address"
          aria-invalid={isFilled && !isValid}
          className={`font-mono text-xs ${
            isFilled && !isValid ? 'border-destructive focus-visible:ring-destructive' : ''
          }`}
        />
        {isFilled && !isValid && (
          <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
            <AlertTriangle className="h-3 w-3" />
            Invalid Stellar address. Must start with G and be 56 characters.
          </p>
        )}
        {isFilled && isValid && (
          <p className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Valid Stellar address
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Stellar addresses start with G and are 56 characters long.
        </p>
      </div>
    </div>
  )
}

// ── Step 3: Documentation ───────────────────────────────────────────────────

function PhotoUploadSection({
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

function DocumentationStep({
  form,
  onChange,
}: {
  form: TransferFormData
  onChange: (updates: Partial<TransferFormData>) => void
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Add notes and documentation for the transfer.
      </p>

      <div className="space-y-2">
        <label htmlFor="transfer-notes" className="text-sm font-medium">
          Transfer Notes
        </label>
        <textarea
          id="transfer-notes"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={3}
          placeholder="General notes about this transfer..."
          value={form.transferNotes}
          onChange={(e) => onChange({ transferNotes: e.target.value })}
          aria-label="Transfer notes"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="condition-notes" className="text-sm font-medium">
          Condition Notes
        </label>
        <textarea
          id="condition-notes"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={2}
          placeholder="Describe the current condition of the material..."
          value={form.conditionNotes}
          onChange={(e) => onChange({ conditionNotes: e.target.value })}
          aria-label="Condition notes"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="handling-instructions" className="text-sm font-medium">
          Handling Instructions
        </label>
        <textarea
          id="handling-instructions"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={2}
          placeholder="Special handling requirements or instructions..."
          value={form.handlingInstructions}
          onChange={(e) => onChange({ handlingInstructions: e.target.value })}
          aria-label="Handling instructions"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PhotoUploadSection
          label="Before Photos"
          photos={form.beforePhotos}
          onPhotosChange={(files) => onChange({ beforePhotos: files })}
          inputId="before-photos"
        />
        <PhotoUploadSection
          label="After Photos"
          photos={form.afterPhotos}
          onPhotosChange={(files) => onChange({ afterPhotos: files })}
          inputId="after-photos"
        />
      </div>
    </div>
  )
}

// ── Step 4: Review & Confirm ────────────────────────────────────────────────

function SignaturePad({
  onSign,
  signed,
}: {
  onSign: (signed: boolean) => void
  signed: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const getPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      if ('touches' in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        }
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    },
    []
  )

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return
      setIsDrawing(true)
      const pos = getPos(e)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    },
    [getPos]
  )

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return
      e.preventDefault()
      const pos = getPos(e)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      setHasDrawn(true)
    },
    [isDrawing, getPos]
  )

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
    if (hasDrawn) {
      onSign(true)
    }
  }, [hasDrawn, onSign])

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onSign(false)
  }, [onSign])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Digital Signature</label>
        {hasDrawn && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSignature}
            aria-label="Clear signature"
          >
            Clear
          </Button>
        )}
      </div>
      <div
        className={`rounded-lg border-2 ${
          signed ? 'border-emerald-500' : 'border-dashed border-muted-foreground/30'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="w-full cursor-crosshair touch-none rounded-lg bg-white"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          aria-label="Signature pad - draw your signature"
          role="img"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Draw your signature above to confirm the transfer.
      </p>
    </div>
  )
}

function ReviewStep({
  form,
  senderAddress,
  onConfirmChange,
}: {
  form: TransferFormData
  senderAddress: string
  onConfirmChange: (confirmed: boolean) => void
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Review all details before submitting the transfer.
      </p>

      {/* Transfer summary */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <h4 className="text-sm font-semibold">Transfer Summary</h4>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Waste ID</span>
            <p className="font-medium">#{form.waste?.waste_id.toString()}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Material Type</span>
            <p className="font-medium">
              {form.waste ? wasteTypeLabel(form.waste.waste_type) : '-'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Weight</span>
            <p className="font-medium">
              {form.waste
                ? Number(form.waste.weight) >= 1000
                  ? `${(Number(form.waste.weight) / 1000).toFixed(2)} kg`
                  : `${form.waste.weight.toString()} g`
                : '-'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Status</span>
            <p className="font-medium">
              {form.waste?.is_confirmed ? 'Confirmed' : 'Unconfirmed'}
            </p>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex-1">
              <span className="text-muted-foreground">From</span>
              <p className="font-mono text-xs">{formatAddress(senderAddress)}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-muted-foreground">To</span>
              <p className="font-mono text-xs">{formatAddress(form.recipientAddress)}</p>
            </div>
          </div>
        </div>

        {form.transferNotes && (
          <div className="border-t pt-3">
            <span className="text-xs text-muted-foreground">Transfer Notes</span>
            <p className="text-sm">{form.transferNotes}</p>
          </div>
        )}

        {form.conditionNotes && (
          <div className="border-t pt-3">
            <span className="text-xs text-muted-foreground">Condition Notes</span>
            <p className="text-sm">{form.conditionNotes}</p>
          </div>
        )}

        {form.handlingInstructions && (
          <div className="border-t pt-3">
            <span className="text-xs text-muted-foreground">Handling Instructions</span>
            <p className="text-sm">{form.handlingInstructions}</p>
          </div>
        )}

        {(form.beforePhotos.length > 0 || form.afterPhotos.length > 0) && (
          <div className="border-t pt-3">
            <span className="text-xs text-muted-foreground">Documentation Photos</span>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span>
                {form.beforePhotos.length} before, {form.afterPhotos.length} after
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Signature / confirmation */}
      <SignaturePad onSign={onConfirmChange} signed={form.senderConfirmed} />

      <div className="flex items-start gap-2">
        <input
          id="confirm-checkbox"
          type="checkbox"
          checked={form.senderConfirmed}
          onChange={(e) => onConfirmChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border"
          aria-label="Confirm transfer details are correct"
        />
        <label htmlFor="confirm-checkbox" className="text-sm">
          I confirm that all transfer details are correct and I authorize this material transfer
          to the specified recipient.
        </label>
      </div>
    </div>
  )
}

// ── Transfer status timeline ────────────────────────────────────────────────

const STATUS_ORDER: TransferStatus[] = ['pending', 'in-transit', 'delivered', 'confirmed']

const STATUS_CONFIG: Record<
  TransferStatus,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="h-4 w-4" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  'in-transit': {
    label: 'In Transit',
    icon: <Truck className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  delivered: {
    label: 'Delivered',
    icon: <Package className="h-4 w-4" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  confirmed: {
    label: 'Confirmed',
    icon: <ShieldCheck className="h-4 w-4" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
}

function StatusTimeline({ status }: { status: TransferStatus }) {
  const currentIdx = STATUS_ORDER.indexOf(status)

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Transfer status timeline">
      {STATUS_ORDER.map((s, idx) => {
        const config = STATUS_CONFIG[s]
        const isCompleted = idx <= currentIdx
        const isCurrent = idx === currentIdx

        return (
          <div key={s} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  isCompleted ? `${config.bgColor} ${config.color}` : 'bg-muted text-muted-foreground'
                } ${isCurrent ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                aria-label={`${config.label}${isCurrent ? ' (current)' : isCompleted ? ' (completed)' : ''}`}
              >
                {config.icon}
              </div>
              <span
                className={`text-[10px] sm:text-xs ${
                  isCompleted ? 'font-medium' : 'text-muted-foreground'
                }`}
              >
                {config.label}
              </span>
            </div>
            {idx < STATUS_ORDER.length - 1 && (
              <div
                className={`mx-1 h-0.5 flex-1 rounded ${
                  idx < currentIdx ? 'bg-emerald-400' : 'bg-muted'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Transfer history tab ────────────────────────────────────────────────────

function TransferHistoryTab() {
  const { address } = useWallet()
  const [localHistory] = useState<LocalTransferRecord[]>(getTransferHistory())

  if (localHistory.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
        <History className="h-10 w-10 opacity-30" />
        <p className="text-sm">No transfers recorded this session.</p>
        <p className="text-xs">Completed transfers will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {localHistory.map((record, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Waste #{record.wasteId}</span>
                </div>
                <Badge
                  variant="secondary"
                  className={`${STATUS_CONFIG[record.status].bgColor} ${STATUS_CONFIG[record.status].color}`}
                >
                  {STATUS_CONFIG[record.status].label}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex-1">
                  <span className="text-muted-foreground">From</span>
                  <p className="font-mono">
                    {record.from === address ? 'You' : formatAddress(record.from)}
                  </p>
                </div>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-muted-foreground">To</span>
                  <p className="font-mono">
                    {record.to === address ? 'You' : formatAddress(record.to)}
                  </p>
                </div>
              </div>

              {record.notes && (
                <p className="text-xs text-muted-foreground">{record.notes}</p>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDate(record.transferredAt)}</span>
              </div>

              <StatusTimeline status={record.status} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── On-chain history for a specific waste ───────────────────────────────────

function WasteChainHistory({ wasteId }: { wasteId: bigint }) {
  const { data: history = [], isLoading } = useWasteTransferHistory(wasteId)

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-lg bg-muted" />
  }

  if (history.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No on-chain transfer history for this waste.</p>
    )
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">On-chain Transfer History</h4>
      <div className="relative space-y-0 pl-4">
        {/* Timeline line */}
        <div className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-border" />
        {history.map((transfer, idx) => (
          <div key={idx} className="relative flex items-start gap-3 pb-4">
            <div className="absolute left-[-12px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
            <div className="flex-1 text-xs">
              <div className="flex items-center gap-1">
                <span className="font-mono">{formatAddress(transfer.from)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono">{formatAddress(transfer.to)}</span>
              </div>
              <p className="text-muted-foreground">{formatDate(transfer.transferred_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function MaterialTransferPage() {
  useAppTitle('Material Transfer')
  const { address } = useWallet()
  const { data: wastes = [], isLoading } = useParticipantWastes()
  const transfer = useTransferWaste()

  const [step, setStep] = useState<TransferStep>('select')
  const [form, setForm] = useState<TransferFormData>(INITIAL_FORM)
  const [showHistory, setShowHistory] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const updateForm = useCallback((updates: Partial<TransferFormData>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleSelectWaste = useCallback(
    (waste: Waste) => {
      updateForm({ wasteId: waste.waste_id, waste })
    },
    [updateForm]
  )

  const stepIdx = STEPS.findIndex((s) => s.key === step)

  const canProceed = (() => {
    switch (step) {
      case 'select':
        return form.wasteId !== null
      case 'destination':
        return isValidStellarAddress(form.recipientAddress)
      case 'documentation':
        return true // documentation is optional
      case 'review':
        return form.senderConfirmed
      default:
        return false
    }
  })()

  const handleNext = useCallback(() => {
    const nextIdx = stepIdx + 1
    if (nextIdx < STEPS.length) {
      setStep(STEPS[nextIdx].key)
    }
  }, [stepIdx])

  const handlePrev = useCallback(() => {
    const prevIdx = stepIdx - 1
    if (prevIdx >= 0) {
      setStep(STEPS[prevIdx].key)
    }
  }, [stepIdx])

  const handleStepClick = useCallback((targetStep: TransferStep) => {
    setStep(targetStep)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!form.wasteId || !address) return

    // Combine notes for the on-chain note field
    const combinedNote = [
      form.transferNotes,
      form.conditionNotes ? `Condition: ${form.conditionNotes}` : '',
      form.handlingInstructions ? `Handling: ${form.handlingInstructions}` : '',
    ]
      .filter(Boolean)
      .join(' | ')

    try {
      await transfer.mutateAsync({
        wasteId: form.wasteId,
        to: form.recipientAddress,
        note: combinedNote || 'Transfer',
      })

      addTransferRecord({
        wasteId: Number(form.wasteId),
        from: address,
        to: form.recipientAddress,
        transferredAt: Math.floor(Date.now() / 1000),
        notes: form.transferNotes,
        conditionNotes: form.conditionNotes,
        handlingInstructions: form.handlingInstructions,
        status: 'pending',
      })

      setShowSuccess(true)
    } catch {
      // Error is handled by the mutation state
    }
  }, [form, address, transfer])

  const handleReset = useCallback(() => {
    setForm(INITIAL_FORM)
    setStep('select')
    setShowSuccess(false)
  }, [])

  // Reset success banner after navigating away
  useEffect(() => {
    if (showHistory) setShowSuccess(false)
  }, [showHistory])

  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Connect your wallet to access material transfers.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Material Transfer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transfer waste materials to other participants on the network.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowHistory((h) => !h)}
          aria-pressed={showHistory}
        >
          <History className="h-4 w-4" />
          History
        </Button>
      </div>

      {showHistory ? (
        <TransferHistoryTab />
      ) : showSuccess ? (
        /* Success state */
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold">Transfer Submitted</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Waste #{form.wasteId?.toString()} has been transferred to{' '}
                {formatAddress(form.recipientAddress)}.
              </p>
            </div>
            <StatusTimeline status="pending" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} aria-label="Start new transfer">
                New Transfer
              </Button>
              <Button
                onClick={() => {
                  setShowHistory(true)
                  setShowSuccess(false)
                }}
                aria-label="View transfer history"
              >
                View History
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Step indicator */}
          <StepIndicator currentStep={step} onStepClick={handleStepClick} />

          {/* Step content */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                {STEPS[stepIdx].icon}
                {STEPS[stepIdx].label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {step === 'select' && (
                <div className="space-y-4">
                  <SelectWasteStep
                    wastes={wastes}
                    isLoading={isLoading}
                    selectedId={form.wasteId}
                    onSelect={handleSelectWaste}
                  />
                  {form.wasteId !== null && (
                    <WasteChainHistory wasteId={form.wasteId} />
                  )}
                </div>
              )}
              {step === 'destination' && (
                <DestinationStep
                  recipientAddress={form.recipientAddress}
                  onRecipientChange={(addr) => updateForm({ recipientAddress: addr })}
                />
              )}
              {step === 'documentation' && (
                <DocumentationStep form={form} onChange={updateForm} />
              )}
              {step === 'review' && (
                <ReviewStep
                  form={form}
                  senderAddress={address}
                  onConfirmChange={(confirmed) => updateForm({ senderConfirmed: confirmed })}
                />
              )}
            </CardContent>
          </Card>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={stepIdx === 0}
              className="gap-2"
              aria-label="Go to previous step"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {step === 'review' ? (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed || transfer.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                aria-label="Submit transfer"
              >
                {transfer.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Transfer
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                className="gap-2"
                aria-label="Go to next step"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Mutation error display */}
          {transfer.isError && (
            <div
              className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>
                Transfer failed:{' '}
                {transfer.error instanceof Error
                  ? transfer.error.message
                  : 'An unexpected error occurred'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
