/**
 * Centralized React Query key factory.
 *
 * Every useQuery / useMutation / invalidateQueries call in the app builds its
 * key here. Factories drop trailing `undefined` parts, so calling a factory
 * with no arguments yields a prefix key that matches every entry for the
 * resource (e.g. `cacheKeys.participantWastes()` invalidates all of them).
 */

type KeyPart = string | number | boolean | object | null | undefined

function key(...parts: KeyPart[]): readonly unknown[] {
  const trimmed = [...parts]
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === undefined) {
    trimmed.pop()
  }
  return trimmed
}

export const cacheKeys = {
  participant: (address?: string) => key('participant', address),
  participantStats: (address?: string) => key('participant-stats', address),
  participantWastes: (address?: string, filters?: object) =>
    key('participant-wastes', address, filters),
  transferHistory: (wasteId?: string) => key('transfer-history', wasteId),
  wasteTransferHistory: (wasteId?: string) => key('waste-transfer-history', wasteId),
  waste: (id?: string) => key('waste', id),
  wastes: (address?: string, filters?: object) => key('wastes', address, filters),
  mapWastes: (address?: string, filters?: object) => key('map-wastes', address, filters),
  mapParticipant: (address?: string, filters?: object) =>
    key('map-participant', address, filters),
  materialTransfers: (materialId?: string) => key('material-transfers', materialId),
  dashboardMaterials: (address?: string) => key('dashboard-materials', address),
  pendingVerifications: (address?: string) => key('pending-verifications', address),
  rewards: (address?: string) => key('rewards', address),
  metrics: () => key('metrics'),
  incentives: (wasteType?: string) => ['incentives', wasteType ?? 'all'] as const,
  incentivesRoot: () => key('incentives'),
  activeIncentives: () => ['incentives', 'active'] as const,
  supplyChainStats: () => key('supply-chain-stats'),
  reportTemplates: () => key('report-templates'),
  reportHistory: () => key('report-history'),
  scheduledReports: () => key('scheduled-reports'),
  adminMetrics: () => key('admin-metrics'),
  adminIncentives: () => key('admin-incentives'),
  adminWaste: (wasteId?: string) => key('admin-waste', wasteId),
  testRuns: () => key('test-runs'),
} as const
