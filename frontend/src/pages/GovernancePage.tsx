import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Vote, FileText, Shield, BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAppTitle } from '@/hooks/useAppTitle'
import { StatusBadge } from '@/design-system'
import {
  createProposal,
  getProposals,
  castVote,
  vetoProposal,
  tallyVotes,
  getGovernanceStats,
  type Proposal,
  type ProposalCategory,
  type VoteChoice
} from '@/lib/governance'

const MOCK_VOTER = 'GVOTER…001'

function ProposalCard({
  proposal,
  onVote,
  onVeto
}: {
  proposal: Proposal
  onVote: (id: string, choice: VoteChoice) => void
  onVeto: (id: string) => void
}) {
  const { t } = useTranslation()
  const tally = tallyVotes(proposal)
  const total = tally.total || 1

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{proposal.title}</CardTitle>
          <div className="shrink-0">
            <StatusBadge status={proposal.status} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground capitalize">{proposal.category}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{proposal.description}</p>

        {/* Vote bars */}
        <div className="space-y-1 text-xs">
          {(['for', 'against', 'abstain'] as VoteChoice[]).map((choice) => (
            <div key={choice} className="space-y-0.5">
              <div className="flex justify-between">
                <span className="capitalize">{t(`governance.voteChoices.${choice}`)}</span>
                <span>
                  {tally[choice]} ({Math.round((tally[choice] / total) * 100)}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${choice === 'for' ? 'bg-success' : choice === 'against' ? 'bg-destructive' : 'bg-muted-foreground'}`}
                  style={{ width: `${(tally[choice] / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-muted-foreground">
            {t('governance.quorumProgress', {
              total: tally.total,
              quorum: proposal.quorum,
              status: tally.quorumMet ? '✓' : '✗'
            })}
          </p>
        </div>

        {proposal.status === 'active' && (
          <div className="flex flex-wrap gap-2 xs:gap-1.5">
            {(['for', 'against', 'abstain'] as VoteChoice[]).map((choice) => (
              <Button
                key={choice}
                size="sm"
                variant={choice === 'for' ? 'default' : 'outline'}
                onClick={() => onVote(proposal.id, choice)}
                className="capitalize text-xs xs:px-2"
              >
                {choice === 'for' ? '✓' : choice === 'against' ? '✗' : '—'}{' '}
                {t(`governance.voteChoices.${choice}`)}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onVeto(proposal.id)}
              className="text-xs text-destructive border-destructive hover:bg-destructive/10 xs:px-2"
            >
              <Shield className="h-3 w-3 mr-1" /> {t('governance.veto')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NewProposalForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ProposalCategory>('community')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return
    createProposal({
      title: title.trim(),
      description: description.trim(),
      category,
      authorAddress: MOCK_VOTER
    })
    setTitle('')
    setDescription('')
    setOpen(false)
    onCreated()
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <FileText className="h-4 w-4 mr-2" /> {t('governance.newProposal')}
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('governance.createProposal')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('governance.proposalTitlePlaceholder')}
            className="w-full rounded border px-3 py-1.5 text-sm bg-background"
            required
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProposalCategory)}
            className="w-full rounded border px-3 py-1.5 text-sm bg-background"
          >
            {(
              ['protocol', 'community', 'treasury', 'technical', 'other'] as ProposalCategory[]
            ).map((c) => (
              <option key={c} value={c} className="capitalize">
                {t(`governance.categories.${c}`)}
              </option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('governance.proposalDescriptionPlaceholder')}
            className="w-full rounded border px-3 py-1.5 text-sm bg-background resize-none"
            rows={3}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              {t('common.submit')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GovernancePage() {
  const { t } = useTranslation()
  useAppTitle(t('governance.title'))
  const [refresh, setRefresh] = useState(0)
  const [filter, setFilter] = useState<'all' | 'active' | 'passed' | 'rejected'>('all')

  const proposals = useMemo(
    () => getProposals(filter === 'all' ? undefined : filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, refresh]
  )

  const stats = useMemo(() => getGovernanceStats(), [refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleVote(id: string, choice: VoteChoice) {
    try {
      castVote(id, MOCK_VOTER, choice)
      setRefresh((r) => r + 1)
    } catch {
      // voting errors (e.g. ended) are surfaced via disabled state
    }
  }

  function handleVeto(id: string) {
    try {
      vetoProposal(id, MOCK_VOTER, 'Community veto exercised')
      setRefresh((r) => r + 1)
    } catch {
      // already vetoed
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xs:gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold xs:text-2xl">{t('governance.heading')}</h1>
          <p className="mt-1 text-muted-foreground">{t('governance.subtitle')}</p>
        </div>
        <NewProposalForm onCreated={() => setRefresh((r) => r + 1)} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xs:gap-2 sm:grid-cols-4 tablet:grid-cols-4">
        {[
          {
            key: 'totalProposals',
            label: t('governance.stats.totalProposals'),
            value: stats.totalProposals
          },
          { key: 'active', label: t('governance.stats.active'), value: stats.activeProposals },
          { key: 'passed', label: t('governance.stats.passed'), value: stats.passedProposals },
          {
            key: 'participation',
            label: t('governance.stats.participation'),
            value: `${Math.round(stats.participationRate * 100)}%`
          }
        ].map(({ key, label, value }) => (
          <Card key={key}>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap xs:gap-1.5">
        {(['all', 'active', 'passed', 'rejected'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {t(`governance.filters.${f}`)}
          </Button>
        ))}
      </div>

      {/* Proposals */}
      {proposals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Vote className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p>{t('governance.emptyState')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xs:gap-3 md:grid-cols-2 tablet:grid-cols-2">
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} onVote={handleVote} onVeto={handleVeto} />
          ))}
        </div>
      )}

      {/* Governance model reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-4 w-4" />
            {t('governance.model.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none text-sm space-y-2 text-muted-foreground">
          <p>
            <strong className="text-foreground">{t('governance.model.quorumLabel')}</strong>{' '}
            {t('governance.model.quorumDescription')}
          </p>
          <p>
            <strong className="text-foreground">{t('governance.model.thresholdLabel')}</strong>{' '}
            {t('governance.model.thresholdDescription')}
          </p>
          <p>
            <strong className="text-foreground">{t('governance.model.vetoLabel')}</strong>{' '}
            {t('governance.model.vetoDescription')}
          </p>
          <p>
            <strong className="text-foreground">{t('governance.model.votingPeriodLabel')}</strong>{' '}
            {t('governance.model.votingPeriodDescription')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
