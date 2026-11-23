import { useState, useMemo } from 'react'
import {
  Award,
  Download,
  Share2,
  CheckCircle,
  XCircle,
  History,
  QrCode,
  Search
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAppTitle } from '@/hooks/useAppTitle'
import { wasteTypeLabel, formatDate } from '@/lib/helpers'
import { WasteType } from '@/api/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CertificateStatus = 'valid' | 'expired' | 'revoked'

export interface WasteCertificate {
  id: string
  wasteId: string
  wasteType: WasteType
  weight: number
  issuer: string
  holder: string
  issuedAt: number
  expiresAt: number
  status: CertificateStatus
  blockchainTxId: string
}

export interface CertificateHistoryEntry {
  certificateId: string
  action: 'issued' | 'verified' | 'revoked' | 'downloaded' | 'shared'
  actor: string
  timestamp: number
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

export function isCertificateValid(cert: WasteCertificate, now = Date.now() / 1000): boolean {
  return cert.status === 'valid' && cert.expiresAt > now
}

export function verifyCertificate(
  cert: WasteCertificate,
  now = Date.now() / 1000
): { authentic: boolean; reason: string } {
  if (cert.status === 'revoked') return { authentic: false, reason: 'Certificate has been revoked' }
  if (cert.expiresAt <= now) return { authentic: false, reason: 'Certificate has expired' }
  if (!cert.blockchainTxId) return { authentic: false, reason: 'No blockchain record found' }
  return { authentic: true, reason: 'Certificate is valid and verified on-chain' }
}

export function filterCertificates(
  certs: WasteCertificate[],
  query: string,
  status: CertificateStatus | 'all'
): WasteCertificate[] {
  return certs.filter((c) => {
    const matchesStatus = status === 'all' || c.status === status
    const matchesQuery =
      !query ||
      c.id.toLowerCase().includes(query.toLowerCase()) ||
      c.holder.toLowerCase().includes(query.toLowerCase()) ||
      wasteTypeLabel(c.wasteType).toLowerCase().includes(query.toLowerCase())
    return matchesStatus && matchesQuery
  })
}

export function getCertificateHistory(
  history: CertificateHistoryEntry[],
  certificateId: string
): CertificateHistoryEntry[] {
  return history.filter((h) => h.certificateId === certificateId)
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000)

const MOCK_CERTS: WasteCertificate[] = [
  {
    id: 'CERT-001',
    wasteId: 'W-101',
    wasteType: WasteType.Paper,
    weight: 120,
    issuer: 'GISSUER...001',
    holder: 'GHOLDER...001',
    issuedAt: NOW - 86400 * 10,
    expiresAt: NOW + 86400 * 355,
    status: 'valid',
    blockchainTxId: 'abc123def456'
  },
  {
    id: 'CERT-002',
    wasteId: 'W-102',
    wasteType: WasteType.Metal,
    weight: 200,
    issuer: 'GISSUER...001',
    holder: 'GHOLDER...002',
    issuedAt: NOW - 86400 * 400,
    expiresAt: NOW - 86400 * 35,
    status: 'expired',
    blockchainTxId: 'xyz789uvw012'
  },
  {
    id: 'CERT-003',
    wasteId: 'W-103',
    wasteType: WasteType.PetPlastic,
    weight: 80,
    issuer: 'GISSUER...002',
    holder: 'GHOLDER...001',
    issuedAt: NOW - 86400 * 5,
    expiresAt: NOW + 86400 * 360,
    status: 'valid',
    blockchainTxId: 'lmn345opq678'
  },
  {
    id: 'CERT-004',
    wasteId: 'W-104',
    wasteType: WasteType.Glass,
    weight: 60,
    issuer: 'GISSUER...003',
    holder: 'GHOLDER...003',
    issuedAt: NOW - 86400 * 20,
    expiresAt: NOW + 86400 * 345,
    status: 'revoked',
    blockchainTxId: 'rst901uvw234'
  }
]

const MOCK_HISTORY: CertificateHistoryEntry[] = [
  {
    certificateId: 'CERT-001',
    action: 'issued',
    actor: 'GISSUER...001',
    timestamp: NOW - 86400 * 10
  },
  {
    certificateId: 'CERT-001',
    action: 'verified',
    actor: 'GVERIFIER...001',
    timestamp: NOW - 86400 * 5
  },
  {
    certificateId: 'CERT-001',
    action: 'downloaded',
    actor: 'GHOLDER...001',
    timestamp: NOW - 86400 * 2
  },
  {
    certificateId: 'CERT-002',
    action: 'issued',
    actor: 'GISSUER...001',
    timestamp: NOW - 86400 * 400
  },
  {
    certificateId: 'CERT-003',
    action: 'issued',
    actor: 'GISSUER...002',
    timestamp: NOW - 86400 * 5
  },
  {
    certificateId: 'CERT-004',
    action: 'issued',
    actor: 'GISSUER...003',
    timestamp: NOW - 86400 * 20
  },
  {
    certificateId: 'CERT-004',
    action: 'revoked',
    actor: 'GADMIN...001',
    timestamp: NOW - 86400 * 3
  }
]

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CertificateStatus }) {
  if (status === 'valid')
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        Valid
      </Badge>
    )
  if (status === 'expired')
    return (
      <Badge variant="outline" className="gap-1">
        <XCircle className="h-3 w-3" />
        Expired
      </Badge>
    )
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />
      Revoked
    </Badge>
  )
}

function CertificateDetailPanel({
  cert,
  history,
  onClose
}: {
  cert: WasteCertificate
  history: CertificateHistoryEntry[]
  onClose: () => void
}) {
  const verification = verifyCertificate(cert)
  const certHistory = getCertificateHistory(history, cert.id)

  function handleDownload() {
    const content = `SCAVNGR WASTE CERTIFICATE\n\nID: ${cert.id}\nWaste Type: ${wasteTypeLabel(cert.wasteType)}\nWeight: ${cert.weight} kg\nHolder: ${cert.holder}\nIssuer: ${cert.issuer}\nIssued: ${formatDate(cert.issuedAt)}\nExpires: ${formatDate(cert.expiresAt)}\nStatus: ${cert.status.toUpperCase()}\nBlockchain TX: ${cert.blockchainTxId}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${cert.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleShare() {
    const text = `Waste Certificate ${cert.id} — ${wasteTypeLabel(cert.wasteType)} ${cert.weight}kg — TX: ${cert.blockchainTxId}`
    if (navigator.share) {
      navigator.share({ title: cert.id, text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Certificate details"
    >
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              {cert.id}
            </CardTitle>
            <StatusBadge status={cert.status} />
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Waste Type</span>
            <span>{wasteTypeLabel(cert.wasteType)}</span>
            <span className="text-muted-foreground">Weight</span>
            <span>{cert.weight} kg</span>
            <span className="text-muted-foreground">Holder</span>
            <span className="truncate font-mono text-xs">{cert.holder}</span>
            <span className="text-muted-foreground">Issuer</span>
            <span className="truncate font-mono text-xs">{cert.issuer}</span>
            <span className="text-muted-foreground">Issued</span>
            <span>{formatDate(cert.issuedAt)}</span>
            <span className="text-muted-foreground">Expires</span>
            <span>{formatDate(cert.expiresAt)}</span>
            <span className="text-muted-foreground">Blockchain TX</span>
            <span className="truncate font-mono text-xs">{cert.blockchainTxId}</span>
          </div>

          {/* Verification result */}
          <div
            className={`rounded-md border p-3 text-sm ${verification.authentic ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}
          >
            {verification.authentic ? (
              <CheckCircle className="mr-1.5 inline h-4 w-4" />
            ) : (
              <XCircle className="mr-1.5 inline h-4 w-4" />
            )}
            {verification.reason}
          </div>

          {/* QR placeholder */}
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-4">
            <QrCode className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">QR code for on-chain verification</p>
            <code className="text-xs break-all text-center">{cert.blockchainTxId}</code>
          </div>

          {/* History */}
          {certHistory.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium flex items-center gap-1">
                <History className="h-4 w-4" />
                Certificate History
              </p>
              <div className="space-y-1">
                {certHistory.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span className="capitalize">
                      {h.action} by {h.actor.slice(0, 12)}…
                    </span>
                    <span>{formatDate(h.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={handleDownload}>
              <Download className="mr-1.5 h-4 w-4" />
              Download
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={handleShare}>
              <Share2 className="mr-1.5 h-4 w-4" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WasteCertificationPage() {
  useAppTitle('Waste Certifications')

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<CertificateStatus | 'all'>('all')
  const [selected, setSelected] = useState<WasteCertificate | null>(null)

  const filtered = useMemo(
    () => filterCertificates(MOCK_CERTS, query, statusFilter),
    [query, statusFilter]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Waste Certifications</h1>
        <p className="mt-1 text-muted-foreground">
          View, verify, download and share waste compliance certificates
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by ID, holder, or waste type…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search certificates"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'valid', 'expired', 'revoked'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Certificate list */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">No certificates found.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cert) => (
            <Card
              key={cert.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelected(cert)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Award className="h-4 w-4 text-primary" />
                    {cert.id}
                  </CardTitle>
                  <StatusBadge status={cert.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  {wasteTypeLabel(cert.wasteType)} · {cert.weight} kg
                </p>
                <p className="text-xs text-muted-foreground">Issued: {formatDate(cert.issuedAt)}</p>
                <p className="text-xs text-muted-foreground">
                  Expires: {formatDate(cert.expiresAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <CertificateDetailPanel
          cert={selected}
          history={MOCK_HISTORY}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
