import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Coins,
  Package,
  ArrowRightLeft,
  Star,
  AlertCircle,
  RefreshCw,
  Recycle,
  CheckCircle2,
  Lock,
  Clock,
  XCircle,
  Pencil,
  Upload,
} from 'lucide-react'
import { useParticipant } from '@/hooks/useParticipant'
import { useProfileStats } from '@/hooks/useProfileStats'
import {
  generateAvatarUrl,
  computeReputationScore,
  computeMilestones,
  validateProfileImage,
  getStoredProfileName,
  setStoredProfileName,
  getStoredProfileImage,
  setStoredProfileImage,
} from '@/lib/profile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatCard } from '@/components/ui/StatCard'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { StatCardSkeleton } from '@/components/ui/Skeletons'
import { EmptyState } from '@/components/ui/EmptyState'
import { WasteDetailsModal } from '@/components/modals/WasteDetailsModal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog'
import { WasteType, Waste, ParticipantStats } from '@/api/types'
import { wasteTypeLabel, formatDate } from '@/lib/helpers'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useWallet } from '@/context/WalletContext'
import { useToast } from '@/hooks/useToast'

const WASTE_TYPE_LABELS: Record<number, string> = {
  [WasteType.Paper]: 'Paper',
  [WasteType.PetPlastic]: 'PET Plastic',
  [WasteType.Plastic]: 'Plastic',
  [WasteType.Metal]: 'Metal',
  [WasteType.Glass]: 'Glass',
  [WasteType.Organic]: 'Organic',
  [WasteType.Electronic]: 'Electronic',
}

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

// ─── Skeleton helpers ────────────────────────────────────────────────────────

function ProfileHeaderSkeleton() {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="h-20 w-20 animate-pulse rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div className="h-6 w-40 animate-pulse rounded bg-muted mx-auto sm:mx-0" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted mx-auto sm:mx-0" />
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-28 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <div className="h-48 w-full animate-pulse rounded-lg bg-muted" />
  )
}

// ─── ProfileHeader ────────────────────────────────────────────────────────────

interface ProfileHeaderProps {
  name: string
  address: string
  role: string
  registeredAt: number
  profileImageUrl?: string | null
  canEdit?: boolean
  onEditClick?: () => void
}

function ProfileHeader({ name, address, role, registeredAt, profileImageUrl, canEdit, onEditClick }: ProfileHeaderProps) {
  const avatarUrl = profileImageUrl || generateAvatarUrl(address)
  const formattedDate = new Date(registeredAt * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <img
          src={avatarUrl}
          alt={`${name} avatar`}
          className="h-20 w-20 rounded-full border-2 border-primary/20 bg-muted shrink-0 object-cover"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-bold sm:text-2xl">{name}</h1>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEditClick}
                aria-label="Edit profile"
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit Profile
              </Button>
            )}
          </div>
          <AddressDisplay address={address} chars={6} showExplorer />
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <Badge variant="secondary">{role}</Badge>
            <span className="text-xs text-muted-foreground self-center">
              Joined {formattedDate}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── StatsSection ─────────────────────────────────────────────────────────────

interface StatsSectionProps {
  totalEarned: bigint
  materialsSubmitted: number
  transfersCount: number
  reputationScore: number
  wastes: import('@/api/types').Waste[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

function StatsSection({
  totalEarned,
  materialsSubmitted,
  transfersCount,
  reputationScore,
  wastes,
  isLoading,
  isError,
  onRetry,
}: StatsSectionProps) {
  // Waste type breakdown for PieChart
  const pieData = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const w of wastes) {
      counts[w.waste_type] = (counts[w.waste_type] ?? 0) + 1
    }
    return Object.entries(counts).map(([type, count]) => ({
      name: WASTE_TYPE_LABELS[Number(type)] ?? `Type ${type}`,
      value: count,
    }))
  }, [wastes])

  // Submissions over time for BarChart (group by month)
  const barData = useMemo(() => {
    const byMonth: Record<string, number> = {}
    for (const w of wastes) {
      const d = new Date(w.recycled_timestamp * 1000)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      byMonth[key] = (byMonth[key] ?? 0) + 1
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, count]) => ({ month, count }))
  }, [wastes])

  if (isError) {
    return (
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load statistics.</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={<Coins className="h-4 w-4" />}
              label="Total Earned"
              value={`${totalEarned.toString()} tokens`}
              variant="success"
            />
            <StatCard
              icon={<Package className="h-4 w-4" />}
              label="Materials Submitted"
              value={materialsSubmitted}
              variant="primary"
            />
            <StatCard
              icon={<ArrowRightLeft className="h-4 w-4" />}
              label="Transfers"
              value={transfersCount}
            />
            <StatCard
              icon={<Star className="h-4 w-4" />}
              label="Reputation Score"
              value={reputationScore}
              variant="warning"
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Waste by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : pieData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submissions Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : barData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── WasteTimeline ────────────────────────────────────────────────────────────

const WASTE_TYPE_ICONS: Record<number, string> = {
  [WasteType.Paper]: '📰',
  [WasteType.PetPlastic]: '♻️',
  [WasteType.Plastic]: '🧴',
  [WasteType.Metal]: '🔩',
  [WasteType.Glass]: '🫙',
  [WasteType.Organic]: '🌱',
  [WasteType.Electronic]: '💻',
}

const TIMELINE_PAGE_SIZE = 10

interface WasteTimelineItemProps {
  waste: Waste
  onClick: (waste: Waste) => void
}

function WasteTimelineItem({ waste, onClick }: WasteTimelineItemProps) {
  const isConfirmed = waste.is_confirmed
  const isActive = waste.is_active

  let statusIcon: React.ReactNode
  let statusClass: string
  if (!isActive) {
    statusIcon = <XCircle className="h-3.5 w-3.5" />
    statusClass = 'bg-muted text-muted-foreground border-border'
  } else if (isConfirmed) {
    statusIcon = <CheckCircle2 className="h-3.5 w-3.5" />
    statusClass =
      'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
  } else {
    statusIcon = <Clock className="h-3.5 w-3.5" />
    statusClass =
      'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
  }

  const statusLabel = !isActive ? 'Inactive' : isConfirmed ? 'Confirmed' : 'Pending'
  const weightNum = Number(waste.weight)
  const weightStr = weightNum >= 1000 ? `${(weightNum / 1000).toFixed(2)} kg` : `${weightNum} g`

  return (
    <button
      type="button"
      onClick={() => onClick(waste)}
      className="w-full text-left rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl shrink-0" aria-hidden="true">
          {WASTE_TYPE_ICONS[waste.waste_type] ?? '🗑️'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">
              {wasteTypeLabel(waste.waste_type)} — #{waste.waste_id.toString()}
            </span>
            <Badge
              className={cn(
                'inline-flex shrink-0 items-center gap-1 border text-xs font-medium',
                statusClass
              )}
            >
              {statusIcon}
              {statusLabel}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{weightStr}</span>
            <span>·</span>
            <span>{formatDate(waste.recycled_timestamp)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

interface WasteTimelineProps {
  wastes: Waste[]
  isLoading: boolean
}

export function WasteTimeline({ wastes, isLoading }: WasteTimelineProps) {
  const [visibleCount, setVisibleCount] = useState(TIMELINE_PAGE_SIZE)
  const [selectedWaste, setSelectedWaste] = useState<Waste | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Sort descending by recycled_timestamp (most recent first)
  const sorted = useMemo(
    () => [...wastes].sort((a, b) => b.recycled_timestamp - a.recycled_timestamp),
    [wastes]
  )

  const visible = sorted.slice(0, visibleCount)
  const hasMore = visibleCount < sorted.length

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + TIMELINE_PAGE_SIZE)
  }, [])

  // Intersection Observer for lazy loading
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '100px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const handleItemClick = (waste: Waste) => {
    setSelectedWaste(waste)
    setModalOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Waste History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Recycle}
            title="No waste items yet"
            description="Submit your first waste item to start building your recycling history."
          />
        ) : (
          <div className="space-y-2">
            {visible.map((waste) => (
              <WasteTimelineItem
                key={waste.waste_id.toString()}
                waste={waste}
                onClick={handleItemClick}
              />
            ))}
            {/* Sentinel element for Intersection Observer */}
            {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
          </div>
        )}
      </CardContent>

      <WasteDetailsModal
        waste={selectedWaste}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </Card>
  )
}

// ─── AchievementsSection ──────────────────────────────────────────────────────

interface AchievementsSectionProps {
  stats: ParticipantStats | null
}

function AchievementsSection({ stats }: AchievementsSectionProps) {
  const milestones = useMemo(
    () =>
      stats
        ? computeMilestones(stats)
        : [
            { id: 'first_submission', label: 'First Submission', description: 'Submit your first waste item', reached: false },
            { id: 'ten_transfers', label: '10 Transfers', description: 'Complete 10 waste transfers', reached: false },
            { id: 'hundred_tokens', label: '100 Tokens', description: 'Earn 100 tokens', reached: false },
            { id: 'fifty_materials', label: '50 Submissions', description: 'Submit 50 waste items', reached: false },
          ],
    [stats]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Achievements</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                milestone.reached
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                  : 'border-border bg-muted/30 opacity-60'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  milestone.reached
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                )}
                aria-label={milestone.reached ? 'Achieved' : 'Not yet achieved'}
              >
                {milestone.reached ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{milestone.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{milestone.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── EditProfileModal ─────────────────────────────────────────────────────────

interface EditProfileModalProps {
  open: boolean
  onClose: () => void
  currentName: string
  address: string
  onSave: (name: string, imageDataUrl: string | null) => Promise<void>
}

function EditProfileModal({ open, onClose, currentName, address, onSave }: EditProfileModalProps) {
  const [name, setName] = useState(currentName)
  const [nameError, setNameError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    getStoredProfileImage(address)
  )
  const [imageError, setImageError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setName(currentName)
      setNameError(null)
      setImageFile(null)
      setImagePreview(getStoredProfileImage(address))
      setImageError(null)
    }
  }, [open, currentName, address])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = validateProfileImage(file)
    if (!result.valid) {
      setImageError(result.error ?? 'Invalid file.')
      setImageFile(null)
      setImagePreview(getStoredProfileImage(address))
      e.target.value = ''
      return
    }

    setImageError(null)
    setImageFile(file)

    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Name cannot be empty.')
      return
    }
    setNameError(null)

    setIsSaving(true)
    try {
      let dataUrl: string | null = null
      if (imageFile) {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (ev) => resolve(ev.target?.result as string)
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })
      }
      await onSave(trimmed, dataUrl)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Name field */}
          <div className="space-y-1.5">
            <label htmlFor="edit-profile-name" className="text-sm font-medium">
              Display Name
            </label>
            <Input
              id="edit-profile-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(null)
              }}
              placeholder="Enter your name"
              aria-describedby={nameError ? 'edit-name-error' : undefined}
              aria-invalid={!!nameError}
            />
            {nameError && (
              <p id="edit-name-error" className="text-xs text-destructive" role="alert">
                {nameError}
              </p>
            )}
          </div>

          {/* Image upload */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Profile Image</label>
            <div className="flex items-center gap-3">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Profile preview"
                  className="h-16 w-16 rounded-full border-2 border-primary/20 object-cover shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted border-2 border-border shrink-0 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  Choose Image
                </Button>
                <p className="text-xs text-muted-foreground">JPEG or PNG, max 2 MB</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Upload profile image"
            />
            {imageError && (
              <p className="text-xs text-destructive" role="alert">
                {imageError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { address } = useWallet()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { participant, isLoading: isLoadingParticipant, isError: isParticipantError } = useParticipant()
  const { stats, wastes, isLoadingStats, isLoadingWastes, isStatsError } = useProfileStats()

  const [editModalOpen, setEditModalOpen] = useState(false)

  // Resolve displayed name: localStorage override takes precedence
  const displayName = useMemo(() => {
    if (!participant) return ''
    return getStoredProfileName(participant.address) ?? participant.name
  }, [participant])

  // Resolve displayed profile image
  const displayImage = useMemo(() => {
    if (!participant) return null
    return getStoredProfileImage(participant.address)
  }, [participant])

  const reputationScore = useMemo(
    () => (stats ? computeReputationScore(stats) : 0),
    [stats]
  )

  const retryParticipant = () => {
    queryClient.invalidateQueries({ queryKey: ['participant', address] })
  }

  const retryStats = () => {
    queryClient.invalidateQueries({ queryKey: ['participant-stats', address] })
    queryClient.invalidateQueries({ queryKey: ['participant-wastes', address] })
  }

  // Whether the authenticated wallet owns this profile
  const isOwnProfile = !!address && !!participant && address === participant.address

  const handleSaveProfile = async (newName: string, imageDataUrl: string | null) => {
    if (!participant) return

    // Snapshot previous cache value for rollback
    const previousData = queryClient.getQueryData<typeof participant>(['participant', address])

    // Optimistic update in TanStack Query cache
    queryClient.setQueryData(['participant', address], (old: typeof participant) => {
      if (!old) return old
      return { ...old, name: newName }
    })

    try {
      // Persist to localStorage
      setStoredProfileName(participant.address, newName)
      if (imageDataUrl) {
        setStoredProfileImage(participant.address, imageDataUrl)
      }
    } catch (err) {
      // Revert optimistic update on error
      queryClient.setQueryData(['participant', address], previousData)
      toast.error(err)
      throw err
    }
  }

  // Participant loading state
  if (isLoadingParticipant) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <ProfileHeaderSkeleton />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    )
  }

  // Participant error state
  if (isParticipantError || !participant) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold">Failed to load profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {!participant && !isParticipantError
                  ? 'No profile found for this wallet address.'
                  : 'There was an error loading your profile data.'}
              </p>
            </div>
            <Button onClick={retryParticipant} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <ProfileHeader
        name={displayName}
        address={participant.address}
        role={participant.role}
        registeredAt={participant.registered_at}
        profileImageUrl={displayImage}
        canEdit={isOwnProfile}
        onEditClick={() => setEditModalOpen(true)}
      />

      <StatsSection
        totalEarned={stats?.total_earned ?? 0n}
        materialsSubmitted={stats?.materials_submitted ?? 0}
        transfersCount={stats?.transfers_count ?? 0}
        reputationScore={reputationScore}
        wastes={wastes}
        isLoading={isLoadingStats || isLoadingWastes}
        isError={isStatsError}
        onRetry={retryStats}
      />

      <WasteTimeline wastes={wastes} isLoading={isLoadingWastes} />

      <AchievementsSection stats={stats} />

      <EditProfileModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        currentName={displayName}
        address={participant.address}
        onSave={handleSaveProfile}
      />
    </div>
  )
}
