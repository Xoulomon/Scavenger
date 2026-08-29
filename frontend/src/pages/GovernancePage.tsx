import { useState, useMemo } from 'react'
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
  type VoteChoice,
} from '@/lib/governance'

const MOCK_VOTER = 'GVOTER…001'

function ProposalCard({
  proposal,
  onVote,
  onVeto,
}: {
  proposal: Proposal
  onVote: (id: string, choice: VoteChoice) => void
  onVeto: (id: string) => void
}) {
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
                <span className="capitalize">{choice}</span>
                <span>{tally[choice]} ({Math.round((tally[choice] / total) * 100)}%)</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${choice === 'for' ? 'bg-green-500' : choice === 'against' ? 'bg-red-500' : 'bg-gray-400'}`}
                  style={{ width: `${(tally[choice] / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-muted-foreground">
            Quorum: {tally.total}/{proposal.quorum} {tally.quorumMet ? '✓' : '✗'}
          </p>
        </div>

        {proposal.status === 'active' && (
          <div className="flex flex-wrap gap-2">
            {(['for', 'against', 'abstain'] as VoteChoice[]).map((choice) => (
              <Button
                key={choice}
                size="sm"
                variant={choice === 'for' ? 'default' : 'outline'}
                onClick={() => onVote(proposal.id, choice)}
                className="capitalize text-xs"
              >
                {choice === 'for' ? '✓' : choice === 'against' ? '✗' : '—'} {choice}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onVeto(proposal.id)}
              className="text-xs text-destructive border-destructive hover:bg-destructive/10"
            >
              <Shield className="h-3 w-3 mr-1" /> Veto
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NewProposalForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ProposalCategory>('community')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return
    createProposal({ title: title.trim(), description: description.trim(), category, authorAddress: MOCK_VOTER })
    setTitle('')
    setDescription('')
    setOpen(false)
    onCreated()
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <FileText className="h-4 w-4 mr-2" /> New Proposal
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create Proposal</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Proposal title"
            className="w-full rounded border px-3 py-1.5 text-sm bg-background"
            required
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProposalCategory)}
            className="w-full rounded border px-3 py-1.5 text-sm bg-background"
          >
            {(['protocol', 'community', 'treasury', 'technical', 'other'] as ProposalCategory[]).map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the proposal..."
            className="w-full rounded border px-3 py-1.5 text-sm bg-background resize-none"
            rows={3}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">Submit</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GovernancePage() {
  useAppTitle('Governance')
  const [refresh, setRefresh] = useState(0)
  const [filter, setFilter] = useState<'all' | 'active' | 'passed' | 'rejected'>('all')

  const proposals = useMemo(
    () => getProposals(filter === 'all' ? undefined : filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, refresh],
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Community Governance</h1>
          <p className="mt-1 text-muted-foreground">
            Vote on proposals and shape the direction of Scavngr
          </p>
        </div>
        <NewProposalForm onCreated={() => setRefresh((r) => r + 1)} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Proposals', value: stats.totalProposals },
          { label: 'Active', value: stats.activeProposals },
          { label: 'Passed', value: stats.passedProposals },
          { label: 'Participation', value: `${Math.round(stats.participationRate * 100)}%` },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'passed', 'rejected'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Proposals */}
      {proposals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Vote className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p>No proposals yet. Create the first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
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
            Governance Model
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none text-sm space-y-2 text-muted-foreground">
          <p><strong className="text-foreground">Quorum:</strong> 5 votes required for a proposal to be valid.</p>
          <p><strong className="text-foreground">Passing threshold:</strong> &gt;50% of decisive votes (for/against).</p>
          <p><strong className="text-foreground">Veto:</strong> Any admin can veto an active proposal with a stated reason.</p>
          <p><strong className="text-foreground">Voting period:</strong> 7 days from proposal creation.</p>
        </CardContent>
      </Card>
    </div>
  )
}
