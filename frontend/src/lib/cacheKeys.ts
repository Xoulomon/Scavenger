/**
 * Centralized React Query key factory.
 *
 * Every useQuery / useMutation / invalidateQueries call in the app builds its
 * key here. Factories drop trailing `undefined` parts, so calling a factory
 * with no arguments yields a prefix key that matches every entry for the
 * resource (e.g. `cacheKeys.participantWastes()` invalidates all of them).
 */

type KeyPart = string | number | boolean | object | null | undefined

/**
 * A query key is an array whose first element is the resource name and whose
 * remaining elements are the resource's parameters. Typed as `QueryKey` so it
 * can be passed directly to TanStack Query APIs.
 */
export type CacheKey = readonly unknown[]

function key(...parts: KeyPart[]): CacheKey {
  const trimmed = [...parts]
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === undefined) {
    trimmed.pop()
  }
  return trimmed
}

/**
 * Typed factory functions for every query key in the app.
 *
 * Conventions:
 * - The first element is always the resource name (a stable string literal).
 * - Optional parameters are appended in a fixed order; trailing `undefined`
 *   values are dropped so a no-argument call returns the resource prefix key.
 * - Prefix keys (e.g. `cacheKeys.wastes()`) match every parameterized entry for
 *   that resource, which is what invalidation should target.
 */
export const cacheKeys = {
  // Participants
  participant: (address?: string): CacheKey => key('participant', address),
  participantStats: (address?: string): CacheKey => key('participant-stats', address),
  participantWastes: (address?: string, filters?: object): CacheKey =>
    key('participant-wastes', address, filters),

  // Wastes & transfers
  waste: (id?: string): CacheKey => key('waste', id),
  wastes: (address?: string, filters?: object): CacheKey => key('wastes', address, filters),
  transferHistory: (wasteId?: string): CacheKey => key('transfer-history', wasteId),
  wasteTransferHistory: (wasteId?: string): CacheKey => key('waste-transfer-history', wasteId),
  materialTransfers: (materialId?: string): CacheKey => key('material-transfers', materialId),

  // Maps
  mapWastes: (address?: string, filters?: object): CacheKey => key('map-wastes', address, filters),
  mapParticipant: (address?: string, filters?: object): CacheKey =>
    key('map-participant', address, filters),

  // Dashboard
  dashboardMaterials: (address?: string): CacheKey => key('dashboard-materials', address),
  pendingVerifications: (address?: string): CacheKey => key('pending-verifications', address),
  rewards: (address?: string): CacheKey => key('rewards', address),
  metrics: (): CacheKey => key('metrics'),

  // Incentives
  incentives: (wasteType?: string): CacheKey => key('incentives', wasteType ?? 'all'),
  incentivesRoot: (): CacheKey => key('incentives'),
  activeIncentives: (): CacheKey => key('incentives', 'active'),

  // Supply chain
  supplyChainStats: (): CacheKey => key('supply-chain-stats'),

  // Reports
  reportTemplates: (): CacheKey => key('report-templates'),
  reportHistory: (): CacheKey => key('report-history'),
  scheduledReports: (): CacheKey => key('scheduled-reports'),

  // Admin
  adminMetrics: (): CacheKey => key('admin-metrics'),
  adminIncentives: (): CacheKey => key('admin-incentives'),
  adminWaste: (wasteId?: string): CacheKey => key('admin-waste', wasteId),

  // Testing
  testRuns: (): CacheKey => key('test-runs')
} as const

export type CacheKeys = typeof cacheKeys
