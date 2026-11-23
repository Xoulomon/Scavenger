import { useState, useMemo } from 'react'
import { Star, Award, Trophy, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  type Contributor,
  TIER_COLORS,
  TIER_BG,
  TIER_THRESHOLDS,
  getTier,
  getPointsToNextTier,
  computeBadges,
  addNomination,
  generateTransparencyReport,
  type ContributorTier
} from '@/lib/contributorRecognition'

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_CONTRIBUTORS: Contributor[] = [
  {
    address: 'GAXYZ…001',
    name: 'Alice',
    points: 52000,
    wasteCount: 310,
    tier: 'legend',
    badges: computeBadges(310, 35, 1),
    joinedAt: Date.now() - 86400000 * 120,
    streak: 35
  },
  {
    address: 'GBDEF…002',
    name: 'Bob',
    points: 18500,
    wasteCount: 210,
    tier: 'platinum',
    badges: computeBadges(210, 28, 2),
    joinedAt: Date.now() - 86400000 * 90,
    streak: 28
  },
  {
    address: 'GCHIJ…003',
    points: 7200,
    wasteCount: 95,
    tier: 'gold',
    badges: computeBadges(95, 12, 3),
    joinedAt: Date.now() - 86400000 * 60,
    streak: 12
  },
  {
    address: 'GDKLM…004',
    points: 2800,
    wasteCount: 48,
    tier: 'silver',
    badges: computeBadges(48, 5, 4),
    joinedAt: Date.now() - 86400000 * 30,
    streak: 5
  },
  {
    address: 'GENOP…005',
    points: 450,
    wasteCount: 12,
    tier: 'bronze',
    badges: computeBadges(12, 2, 5),
    joinedAt: Date.now() - 86400000 * 10,
    streak: 2
  }
].map((c) => ({ ...c, tier: getTier(c.points) }))

// ── Sub-components ────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: ContributorTier }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${TIER_COLORS[tier]} ${TIER_BG[tier]}`}
    >
      {tier}
    </span>
  )
}

function TierProgressCard({ contributor }: { contributor: Contributor }) {
  const { next, needed } = getPointsToNextTier(contributor.points)
  const currentThreshold = TIER_THRESHOLDS[contributor.tier]
  const nextThreshold = next ? TIER_THRESHOLDS[next] : contributor.points
  const progress = next
    ? ((contributor.points - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    : 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Your Tier Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <TierBadge tier={contributor.tier} />
          {next && (
            <span className="text-xs text-muted-foreground">
              {needed.toLocaleString()} pts to {next}
            </span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {contributor.badges.map((b) => (
            <span key={b.id} title={b.description} className="text-lg cursor-help">
              {b.icon}
            </span>
          ))}
          {contributor.badges.length === 0 && (
            <span className="text-xs text-muted-foreground">No badges yet — start recycling!</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function NominationForm() {
  const [address, setAddress] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim() || !reason.trim()) return
    addNomination(address.trim(), 'self', reason.trim())
    setSubmitted(true)
    setAddress('')
    setReason('')
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4" />
          Nominate a Contributor
        </CardTitle>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <p className="text-sm text-green-600 dark:text-green-400">✓ Nomination submitted!</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground" htmlFor="nominee-addr">
                Nominee Address
              </label>
              <input
                id="nominee-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="GXXXXX…"
                className="mt-1 w-full rounded border px-3 py-1.5 text-sm bg-background"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground" htmlFor="nominee-reason">
                Reason
              </label>
              <textarea
                id="nominee-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why should this contributor be recognized?"
                className="mt-1 w-full rounded border px-3 py-1.5 text-sm bg-background resize-none"
                rows={2}
                required
              />
            </div>
            <Button type="submit" size="sm">
              Submit Nomination
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContributorRecognition() {
  const report = useMemo(() => generateTransparencyReport(MOCK_CONTRIBUTORS), [])
  const myContributor = MOCK_CONTRIBUTORS[3] // mock "current user"

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Contributor Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {MOCK_CONTRIBUTORS.map((c, i) => (
            <div
              key={c.address}
              className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <span className="w-6 text-center font-bold text-muted-foreground text-sm">
                #{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs">{c.address}</span>
                  {c.name && <span className="text-xs text-muted-foreground">({c.name})</span>}
                  <TierBadge tier={c.tier} />
                </div>
                <div className="flex gap-1 mt-1">
                  {c.badges.slice(0, 4).map((b) => (
                    <span key={b.id} title={b.name} className="text-sm cursor-help">
                      {b.icon}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-primary">{c.points.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{c.wasteCount} items</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <TierProgressCard contributor={myContributor} />
        <NominationForm />
      </div>

      {/* Transparency report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4" />
            Transparency Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{report.totalContributors}</div>
              <div className="text-xs text-muted-foreground">Contributors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{report.totalNominations}</div>
              <div className="text-xs text-muted-foreground">Nominations</div>
            </div>
            {(Object.entries(report.tierBreakdown) as [ContributorTier, number][])
              .filter(([, count]) => count > 0)
              .slice(0, 2)
              .map(([tier, count]) => (
                <div key={tier} className="text-center">
                  <div className={`text-2xl font-bold ${TIER_COLORS[tier]}`}>{count}</div>
                  <div className="text-xs text-muted-foreground capitalize">{tier}</div>
                </div>
              ))}
          </div>
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">
              Report generated: {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {(Object.entries(report.tierBreakdown) as [ContributorTier, number][]).map(
              ([tier, count]) => (
                <Badge key={tier} variant="secondary" className={`capitalize ${TIER_COLORS[tier]}`}>
                  {tier}: {count}
                </Badge>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
