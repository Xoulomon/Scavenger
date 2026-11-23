import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useGamification } from '@/hooks/useGamification'
import { Badge as BadgeType, Challenge, LeaderboardEntry, Level } from '@/lib/gamification'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Trophy, Star, Zap, Calendar } from 'lucide-react'
import { cn } from '@/lib/cn'

// ── Confetti ──────────────────────────────────────────────────────────────────

function useConfetti(trigger: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!trigger || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      r: Math.random() * 6 + 3,
      d: Math.random() * 4 + 1,
      color: `hsl(${Math.random() * 360},80%,60%)`,
      tilt: Math.random() * 10 - 5
    }))

    let frame: number
    let elapsed = 0

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
        p.y += p.d
        p.x += p.tilt * 0.3
        if (p.y > canvas.height) {
          p.y = -10
          p.x = Math.random() * canvas.width
        }
      })
      elapsed += 16
      if (elapsed < 3000) frame = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [trigger])

  return canvasRef
}

// ── Level progress bar ────────────────────────────────────────────────────────

function LevelCard({ level }: { level: Level }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-warning" />
          {t('gamification.level.title', { level: level.level, title: level.title })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t('gamification.level.xp', { xp: level.xp.toLocaleString() })}</span>
          <span>{t('gamification.level.next', { xp: level.xpForNext.toLocaleString() })}</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-warning transition-all duration-700"
            style={{ width: `${level.progressPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right">
          {t('gamification.level.progress', { pct: level.progressPct })}
        </p>
      </CardContent>
    </Card>
  )
}

// ── Badge grid ────────────────────────────────────────────────────────────────

function BadgeGrid({ badges }: { badges: BadgeType[] }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('gamification.badges.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 xs:grid-cols-3 xs:gap-3 tablet:grid-cols-5">
          {badges.map((b) => (
            <div
              key={b.id}
              title={b.description}
              className={cn(
                'flex min-w-0 flex-col items-center gap-1 rounded-lg border p-2 text-center transition-opacity xs:p-3',
                b.earned ? 'border-warning bg-warning/10' : 'opacity-40'
              )}
            >
              <span className="text-2xl">{b.icon}</span>
              <span className="break-words text-xs font-medium leading-tight">{b.name}</span>
              {b.earned && (
                <Badge variant="default" className="px-1 py-0 text-[10px]">
                  {t('gamification.badges.earned')}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Challenge card ────────────────────────────────────────────────────────────

function ChallengeRow({ challenge }: { challenge: Challenge }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1 rounded-md border px-3 py-3 xs:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="min-w-0 break-words font-medium">{challenge.title}</span>
        <Badge variant={challenge.completed ? 'default' : 'secondary'} className="shrink-0 text-xs">
          {challenge.completed
            ? t('gamification.challenges.done')
            : t('gamification.challenges.progress', {
                current: challenge.current,
                target: challenge.target
              })}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{challenge.description}</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            challenge.completed ? 'bg-success' : 'bg-primary'
          )}
          style={{ width: `${challenge.progressPct}%` }}
        />
      </div>
    </div>
  )
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

function LeaderboardSection({ entries }: { entries: LeaderboardEntry[] }) {
  const { t } = useTranslation()
  const MEDALS = ['🥇', '🥈', '🥉']
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-warning" /> {t('gamification.leaderboard.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map((e) => (
          <div
            key={e.address}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm xs:px-4"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span>{MEDALS[e.rank - 1] ?? `#${e.rank}`}</span>
              <span className="truncate font-medium">{e.displayName}</span>
              <Badge variant="outline" className="shrink-0 text-xs">
                {t('gamification.leaderboard.level', { level: e.level })}
              </Badge>
            </div>
            <span className="shrink-0 font-bold">
              {t('gamification.level.xp', { xp: e.xp.toLocaleString() })}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Achievement toast ─────────────────────────────────────────────────────────

function NewBadgeToast({ badges, onDismiss }: { badges: BadgeType[]; onDismiss: () => void }) {
  const { t } = useTranslation()
  useEffect(() => {
    if (badges.length === 0) return
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [badges, onDismiss])

  if (badges.length === 0) return null
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 xs:inset-x-auto xs:bottom-6 xs:right-6">
      {badges.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg animate-in slide-in-from-right"
        >
          <span className="text-2xl">{b.icon}</span>
          <div>
            <p className="text-sm font-semibold">{t('gamification.badges.unlocked')}</p>
            <p className="text-xs text-muted-foreground">{b.name}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GamificationPage() {
  const { t } = useTranslation()
  useAppTitle(t('gamification.pageTitle'))
  const { badges, level, challenges, leaderboard, newBadges, clearNewBadges, isLoading } =
    useGamification()

  const hasNewBadges = newBadges.length > 0
  const canvasRef = useConfetti(hasNewBadges)

  const daily = challenges.filter((c) => c.type === 'daily')
  const weekly = challenges.filter((c) => c.type === 'weekly')

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 px-3 py-6 xs:px-4 tablet:px-0 tablet:py-0">
      {/* Confetti canvas */}
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-40" />

      <h1 className="text-xl font-bold xs:text-2xl sm:text-2xl">{t('gamification.pageTitle')}</h1>

      {/* Level */}
      <LevelCard level={level} />

      {/* Badges */}
      <BadgeGrid badges={badges} />

      {/* Challenges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-warning" /> {t('gamification.challenges.daily')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {daily.map((c) => (
            <ChallengeRow key={c.id} challenge={c} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-info" /> {t('gamification.challenges.weekly')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {weekly.map((c) => (
            <ChallengeRow key={c.id} challenge={c} />
          ))}
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <LeaderboardSection entries={leaderboard} />

      {/* Achievement notification toast */}
      <NewBadgeToast badges={newBadges} onDismiss={clearNewBadges} />
    </div>
  )
}
