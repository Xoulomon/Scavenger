import { useState, useMemo, useCallback } from 'react'
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  BarChart3,
  Download,
  Filter,
  ChevronDown,
  ChevronRight,
  Search,
  TrendingUp,
  Activity,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAppTitle } from '@/hooks/useAppTitle'

// ── Mock data (would come from API) ─────────────────────────────────────────

type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending'

interface TestResult {
  id: string
  name: string
  suite: string
  status: TestStatus
  duration: number
  error?: string
  timestamp: string
}

interface TestRun {
  id: string
  name: string
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
  timestamp: string
  results: TestResult[]
}

function useTestRuns() {
  return useQuery<TestRun[]>({
    queryKey: ['test-runs'],
    queryFn: async () => {
      const runs: TestRun[] = [
        {
          id: 'run-001',
          name: 'Contract Integration Tests',
          total: 84,
          passed: 80,
          failed: 3,
          skipped: 1,
          duration: 45200,
          timestamp: '2026-06-25T10:30:00Z',
          results: Array.from({ length: 84 }, (_, i) => ({
            id: `test-${i}`,
            name: `test_${['waste_registration', 'participant_registration', 'waste_transfer', 'reward_distribution', 'incentive_creation', 'carbon_credits', 'verification_workflow', 'contract_upgrade', 'batch_operations', 'dispute_resolution'][i % 10]}`,
            suite: `suite_${['core', 'participants', 'waste', 'rewards', 'incentives', 'carbon', 'verification', 'upgrade', 'batch', 'disputes'][i % 10]}`,
            status: i < 3 ? 'failed' : i === 3 ? 'skipped' : 'passed',
            duration: Math.floor(Math.random() * 5000 + 100),
            error: i < 3 ? `AssertionError: Expected ${i + 1} to equal ${i}` : undefined,
            timestamp: '2026-06-25T10:30:00Z',
          })),
        },
        {
          id: 'run-002',
          name: 'Frontend Component Tests',
          total: 156,
          passed: 150,
          failed: 4,
          skipped: 2,
          duration: 32100,
          timestamp: '2026-06-25T09:00:00Z',
          results: [],
        },
        {
          id: 'run-003',
          name: 'E2E Playwright Tests',
          total: 48,
          passed: 45,
          failed: 2,
          skipped: 1,
          duration: 184500,
          timestamp: '2026-06-25T08:00:00Z',
          results: [],
        },
        {
          id: 'run-004',
          name: 'Backend API Tests',
          total: 72,
          passed: 72,
          failed: 0,
          skipped: 0,
          duration: 8900,
          timestamp: '2026-06-24T22:00:00Z',
          results: [],
        },
      ]
      return runs
    },
    staleTime: 60_000,
  })
}

type Tab = 'overview' | 'history' | 'details'

const STATUS_CONFIG: Record<TestStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  passed: { label: 'Passed', color: 'text-green-500 bg-green-500/10 border-green-500/20', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: XCircle },
  skipped: { label: 'Skipped', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20', icon: AlertCircle },
  pending: { label: 'Pending', color: 'text-muted-foreground bg-muted border-border', icon: Clock },
}

function StatusBadge({ status }: { status: TestStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <Badge className={`gap-1 border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  )
}

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: runs, isLoading } = useTestRuns()

  const totals = useMemo(() => {
    if (!runs) return { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 }
    return runs.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        passed: acc.passed + r.passed,
        failed: acc.failed + r.failed,
        skipped: acc.skipped + r.skipped,
        duration: acc.duration + r.duration,
      }),
      { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 }
    )
  }, [runs])

  const passRate = totals.total > 0 ? ((totals.passed / totals.total) * 100).toFixed(1) : '0'
  const trend = totals.failed === 0 ? 'up' : 'down'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Total Tests"
          value={isLoading ? '—' : String(totals.total)}
          isLoading={isLoading}
          variant="primary"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Passed"
          value={isLoading ? '—' : String(totals.passed)}
          variant="success"
          isLoading={isLoading}
        />
        <StatCard
          icon={<XCircle className="h-4 w-4" />}
          label="Failed"
          value={isLoading ? '—' : String(totals.failed)}
          variant={totals.failed > 0 ? 'destructive' : 'default'}
          isLoading={isLoading}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Pass Rate"
          value={isLoading ? '—' : `${passRate}%`}
          trend={trend}
          trendLabel={trend === 'up' ? 'All passing' : `${totals.failed} failures`}
          variant={totals.failed === 0 ? 'success' : totals.failed > 2 ? 'destructive' : 'warning'}
          isLoading={isLoading}
        />
      </div>

      {runs && runs.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Recent Test Runs</h2>
          <div className="divide-y divide-border rounded-lg border">
            {runs.map((run) => {
              const runPassRate = ((run.passed / run.total) * 100).toFixed(1)
              const totalWidth = 100
              const passedWidth = (run.passed / run.total) * totalWidth
              const failedWidth = (run.failed / run.total) * totalWidth
              return (
                <div key={run.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{run.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {run.total} tests · {Math.round(run.duration / 1000)}s · {new Date(run.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-2 w-32 overflow-hidden rounded-full bg-muted sm:w-40">
                      <div className="bg-green-500 transition-all" style={{ width: `${passedWidth}%` }} />
                      <div className="bg-red-500 transition-all" style={{ width: `${failedWidth}%` }} />
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${Number(runPassRate) >= 90 ? 'text-green-600' : Number(runPassRate) >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {runPassRate}%
                    </span>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        {run.passed}
                      </Badge>
                      {run.failed > 0 && (
                        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                          {run.failed}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No test runs yet"
          description="Test results will appear here once the CI pipeline runs."
          action={{ label: 'Run Tests', onClick: () => {} }}
        />
      )}
    </div>
  )
}

// ── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab() {
  const days = 30
  const data = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(Date.now() - (days - 1 - i) * 86400000)
      const total = Math.floor(Math.random() * 100 + 50)
      const passed = Math.floor(total * (0.8 + Math.random() * 0.2))
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total,
        passed,
        failed: total - passed,
        passRate: ((passed / total) * 100).toFixed(1),
      }
    })
  }, [])

  const maxTotal = Math.max(...data.map(d => d.total))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Test Pass Rate Trend (30 days)
          </CardTitle>
          <CardDescription>Historical view of test pass rates across all test suites</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative h-48">
            <div className="absolute inset-0 flex items-end gap-[3px]">
              {data.map((d) => {
                const height = (d.total / maxTotal) * 100
                const greenHeight = (d.passed / d.total) * height
                const redHeight = (d.failed / d.total) * height
                return (
                  <div
                    key={d.date}
                    className="flex flex-1 flex-col justify-end"
                    title={`${d.date}: ${d.passRate}% pass rate`}
                  >
                    <div className="w-full rounded-t-sm bg-red-400 transition-all" style={{ height: `${redHeight}%` }} />
                    <div className="w-full rounded-t-sm bg-green-400 transition-all" style={{ height: `${greenHeight}%` }} />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{data[0]?.date}</span>
            <span>{data[Math.floor(days / 2)]?.date}</span>
            <span>{data[days - 1]?.date}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Best Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {Math.max(...data.map(d => Number(d.passRate)))}%
            </p>
            <p className="text-xs text-muted-foreground">
              {data.find(d => Number(d.passRate) === Math.max(...data.map(x => Number(x.passRate))))?.date}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-red-500" />
              Worst Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {Math.min(...data.map(d => Number(d.passRate)))}%
            </p>
            <p className="text-xs text-muted-foreground">
              {data.find(d => Number(d.passRate) === Math.min(...data.map(x => Number(x.passRate))))?.date}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium text-right">Total</th>
              <th className="pb-2 font-medium text-right">Passed</th>
              <th className="pb-2 font-medium text-right">Failed</th>
              <th className="pb-2 font-medium text-right">Pass Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.slice(-14).map((d) => (
              <tr key={d.date} className="hover:bg-muted/50">
                <td className="py-2">{d.date}</td>
                <td className="py-2 text-right tabular-nums">{d.total}</td>
                <td className="py-2 text-right tabular-nums text-green-600">{d.passed}</td>
                <td className="py-2 text-right tabular-nums text-red-600">{d.failed}</td>
                <td className="py-2 text-right tabular-nums font-medium">{d.passRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Details Tab ─────────────────────────────────────────────────────────────

function DetailsTab() {
  const { data: runs } = useTestRuns()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [suiteFilter, setSuiteFilter] = useState<string>('all')
  const [expandedTest, setExpandedTest] = useState<string | null>(null)

  const allResults = useMemo(() => {
    if (!runs) return []
    return runs.flatMap(run => run.results.map(r => ({ ...r, runName: run.name })))
  }, [runs]) as (TestResult & { runName: string })[]

  const suites = useMemo(() => {
    return [...new Set(allResults.map(r => r.suite))]
  }, [allResults])

  const filtered = useMemo(() => {
    return allResults.filter(r => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (suiteFilter !== 'all' && r.suite !== suiteFilter) return false
      return true
    })
  }, [allResults, search, statusFilter, suiteFilter])

  const toggleExpand = useCallback((id: string) => {
    setExpandedTest(prev => prev === id ? null : id)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search tests"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="passed">Passed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={suiteFilter} onValueChange={setSuiteFilter}>
          <SelectTrigger className="w-40" aria-label="Filter by suite">
            <SelectValue placeholder="Suite" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suites</SelectItem>
            {suites.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); setSuiteFilter('all') }}>
          <Filter className="h-4 w-4 mr-1" />
          Clear
        </Button>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No matching tests"
          description="Try adjusting your search or filter criteria."
        />
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {filtered.map((test) => (
            <div key={test.id}>
              <button
                onClick={() => toggleExpand(test.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 transition-colors"
              >
                {expandedTest === test.id ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <StatusBadge status={test.status} />
                <span className="flex-1 truncate font-medium">{test.name}</span>
                <span className="text-xs text-muted-foreground">{test.suite}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{test.duration}ms</span>
              </button>
              {expandedTest === test.id && test.error && (
                <div className="border-t bg-muted/30 px-4 py-3">
                  <p className="text-xs font-medium text-destructive mb-1">Error:</p>
                  <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono">
                    {test.error}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export function TestReportsPage() {
  useAppTitle('Test Reports')
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'history', label: 'History', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'details', label: 'Details', icon: <FileText className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Test Reports</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Test result visualization and analysis
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Test report sections"
        className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'details' && <DetailsTab />}
      </div>
    </div>
  )
}
