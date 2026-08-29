import { useState, useCallback } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  History,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useContract } from '@/context/ContractContext'
import { useWallet } from '@/context/WalletContext'
import { networkConfig } from '@/lib/stellar'
import { wasteTypeLabel, formatDate, formatAddress } from '@/lib/helpers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAppTitle } from '@/hooks/useAppTitle'
import type { Material } from '@/api/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface VerificationRecord {
  materialId: number
  decision: 'approved' | 'rejected'
  notes: string
  contaminated: boolean
  grade: QualityGrade
  verifiedAt: number
  verifier: string
}

// ── Local verification history (session) ─────────────────────────────────────

const _history: VerificationRecord[] = []

export function addVerificationRecord(record: VerificationRecord) {
  _history.unshift(record)
  if (_history.length > 100) _history.pop()
}

export function getVerificationHistory(): VerificationRecord[] {
  return [..._history]
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function usePendingMaterials() {
  const { config } = useContract()
  const { address } = useWallet()

  return useQuery<Material[]>({
    queryKey: ['pending-verifications', address],
    queryFn: async () => {
      if (!address) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      // Fetch participant's materials and filter unverified
      const ids = await client.getParticipantWastes(address)
      const results = await Promise.all(
        ids.slice(-20).map((id) => client.getMaterial(BigInt(id as unknown as number)))
      )
      return results.filter((m): m is Material => m !== null && !m.verified)
    },
    enabled: !!address,
    staleTime: 30_000,
  })
}

function useVerifyMaterial() {
  const { config } = useContract()
  const { address } = useWallet()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ materialId }: { materialId: bigint }) => {
      if (!address) throw new Error('No wallet connected.')
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.verifyMaterial(materialId, address, address)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-verifications'] })
    },
  })
}

// ── Quality grade selector ────────────────────────────────────────────────────

const GRADES: QualityGrade[] = ['A', 'B', 'C', 'D', 'F']
const GRADE_COLOR: Record<QualityGrade, string> = {
  A: 'bg-emerald-500 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-yellow-500 text-white',
  D: 'bg-orange-500 text-white',
  F: 'bg-destructive text-destructive-foreground',
}

function GradeSelector({
  value,
  onChange,
}: {
  value: QualityGrade
  onChange: (g: QualityGrade) => void
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Quality grade">
      {GRADES.map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          aria-pressed={value === g}
          aria-label={`Grade ${g}`}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            GRADE_COLOR[g]
          } ${value === g ? 'opacity-100 ring-2 ring-offset-1 ring-ring' : 'opacity-40 hover:opacity-70'}`}
        >
          {g}
        </button>
      ))}
    </div>
  )
}

// ── Image gallery with zoom ───────────────────────────────────────────────────

function ImageGallery({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(1)

  if (images.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No images available
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border bg-muted">
        <img
          src={images[idx]}
          alt={`Waste image ${idx + 1}`}
          className="mx-auto block max-h-64 object-contain transition-transform"
          style={{ transform: `scale(${zoom})` }}
        />
        <div className="absolute bottom-2 right-2 flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            disabled={zoom <= 0.5}
            aria-label="Zoom out image"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            disabled={zoom >= 3}
            aria-label="Zoom in image"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {idx + 1} / {images.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))}
            disabled={idx === images.length - 1}
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Verification panel ────────────────────────────────────────────────────────

function VerificationPanel({
  material,
  onDone,
}: {
  material: Material
  onDone: (record: VerificationRecord) => void
}) {
  const [notes, setNotes] = useState('')
  const [contaminated, setContaminated] = useState(false)
  const [grade, setGrade] = useState<QualityGrade>('B')
  const { address } = useWallet()
  const verify = useVerifyMaterial()

  const handleDecision = useCallback(
    async (decision: 'approved' | 'rejected') => {
      if (decision === 'approved') {
        await verify.mutateAsync({ materialId: BigInt(material.id) })
      }
      const record: VerificationRecord = {
        materialId: material.id,
        decision,
        notes,
        contaminated,
        grade,
        verifiedAt: Math.floor(Date.now() / 1000),
        verifier: address ?? '',
      }
      addVerificationRecord(record)
      onDone(record)
    },
    [verify, material.id, notes, contaminated, grade, address, onDone]
  )

  // Keyboard shortcuts: a = approve, r = reject
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'a') handleDecision('approved')
      if (e.key === 'r') handleDecision('rejected')
    },
    [handleDecision]
  )

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={-1}>
      <ImageGallery images={[]} />

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Type</span>
          <p className="font-medium">{wasteTypeLabel(material.waste_type)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Weight</span>
          <p className="font-medium">
            {material.weight >= 1000
              ? `${(material.weight / 1000).toFixed(2)} kg`
              : `${material.weight} g`}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Submitter</span>
          <p className="font-mono text-xs">{formatAddress(material.submitter)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Submitted</span>
          <p className="font-medium">{formatDate(material.submitted_at)}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Quality Grade</label>
        <GradeSelector value={grade} onChange={setGrade} />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="contaminated"
          type="checkbox"
          checked={contaminated}
          onChange={(e) => setContaminated(e.target.checked)}
          className="h-4 w-4 rounded border"
          aria-label="Mark as contaminated"
        />
        <label htmlFor="contaminated" className="flex items-center gap-1.5 text-sm">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
          Mark as contaminated
        </label>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Verification notes</label>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={3}
          placeholder="Optional notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-label="Verification notes"
        />
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => handleDecision('approved')}
          disabled={verify.isPending}
          aria-label="Approve material"
        >
          <CheckCircle2 className="h-4 w-4" />
          Approve (A)
        </Button>
        <Button
          variant="destructive"
          className="flex-1 gap-2"
          onClick={() => handleDecision('rejected')}
          disabled={verify.isPending}
          aria-label="Reject material"
        >
          <XCircle className="h-4 w-4" />
          Reject (R)
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Keyboard shortcuts: <kbd>A</kbd> approve · <kbd>R</kbd> reject
      </p>
    </div>
  )
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const [history] = useState<VerificationRecord[]>(getVerificationHistory())

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No verifications recorded this session.</p>
    )
  }

  return (
    <div className="divide-y divide-border rounded-lg border">
      {history.map((rec, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
          <div>
            <p className="font-medium">
              Material #{rec.materialId}{' '}
              <span
                className={`ml-1 text-xs font-semibold ${
                  rec.decision === 'approved' ? 'text-emerald-600' : 'text-destructive'
                }`}
              >
                {rec.decision}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Grade {rec.grade}
              {rec.contaminated ? ' · Contaminated' : ''}
              {rec.notes ? ` · ${rec.notes}` : ''}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{formatDate(rec.verifiedAt)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function VerificationPage() {
  useAppTitle('Verification')
  const { address } = useWallet()
  const { data: queue = [], isLoading } = usePendingMaterials()
  const [queueIdx, setQueueIdx] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [done, setDone] = useState<number[]>([])

  const pending = queue.filter((m) => !done.includes(m.id))
  const current = pending[queueIdx] ?? null

  const handleDone = useCallback(
    (record: VerificationRecord) => {
      setDone((d) => [...d, record.materialId])
      setQueueIdx((i) => Math.max(0, i))
    },
    []
  )

  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Connect your wallet to access the verification queue.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Verification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and verify pending waste submissions.
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
        <HistoryTab />
      ) : (
        <>
          {/* Queue header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {isLoading ? 'Loading queue…' : `${pending.length} pending`}
              </span>
            </div>
            {pending.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQueueIdx((i) => Math.max(0, i - 1))}
                  disabled={queueIdx === 0}
                  aria-label="Previous item"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {queueIdx + 1} / {pending.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQueueIdx((i) => Math.min(pending.length - 1, i + 1))}
                  disabled={queueIdx >= pending.length - 1}
                  aria-label="Next item"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : current ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>Material #{current.id}</span>
                  <Badge variant="secondary">
                    <Clock className="mr-1 h-3 w-3" />
                    Pending
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VerificationPanel material={current} onDone={handleDone} />
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">Queue is empty. All caught up!</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
