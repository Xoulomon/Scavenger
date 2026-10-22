/**
 * Centralised ScavengerClient mock factory — issue #1546.
 *
 * Import this file and call `vi.mock('@/api/client', mockClientModule)` (or
 * use the pre-wired `setupClientMock` helper) so every test file that needs a
 * ScavengerClient mock gets the same, type-safe shape.
 *
 * Why not MSW?
 * ScavengerClient speaks the Stellar Soroban JSON-RPC protocol, not a REST/HTTP
 * API.  MSW intercepts standard fetch calls (REST), but Soroban RPC requests
 * carry binary XDR and require special simulation/polling semantics.  Mocking
 * the ScavengerClient class directly is therefore the correct strategy here.
 * MSW IS used for the backend REST HTTP layer (see src/test-utils/msw/handlers.ts).
 *
 * Usage in a test file:
 *
 *   import { createMockClient, setupClientMock } from '@/test-utils/mockScavengerClient'
 *
 *   // Option A – full control (access to individual method spies):
 *   const mockGetParticipant = vi.fn()
 *   vi.mock('@/api/client', () => ({
 *     ScavengerClient: vi.fn().mockImplementation(() =>
 *       createMockClient({ getParticipant: mockGetParticipant })
 *     ),
 *   }))
 *
 *   // Option B – zero-boilerplate (methods default to vi.fn()):
 *   const { mocks } = setupClientMock()
 *   // mocks.getParticipant, mocks.getMetrics, etc. are all vi.fn()
 */

import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

/**
 * Partial record of ScavengerClient method spies.  Any method not listed will
 * be replaced with a default `vi.fn()` that resolves to `undefined`.
 */
export type ClientMethodOverrides = Partial<{
  // Admin
  initializeAdmin: ReturnType<typeof vi.fn>
  getAdmin: ReturnType<typeof vi.fn>
  transferAdmin: ReturnType<typeof vi.fn>
  setCharityContract: ReturnType<typeof vi.fn>
  setTokenAddress: ReturnType<typeof vi.fn>
  setPercentages: ReturnType<typeof vi.fn>

  // Participants
  registerParticipant: ReturnType<typeof vi.fn>
  getParticipant: ReturnType<typeof vi.fn>
  getParticipantInfo: ReturnType<typeof vi.fn>
  updateRole: ReturnType<typeof vi.fn>
  deregisterParticipant: ReturnType<typeof vi.fn>
  isParticipantRegistered: ReturnType<typeof vi.fn>

  // Waste / Materials
  submitMaterial: ReturnType<typeof vi.fn>
  submitMaterialsBatch: ReturnType<typeof vi.fn>
  verifyMaterial: ReturnType<typeof vi.fn>
  transferWaste: ReturnType<typeof vi.fn>
  confirmWasteDetails: ReturnType<typeof vi.fn>
  resetWasteConfirmation: ReturnType<typeof vi.fn>
  deactivateWaste: ReturnType<typeof vi.fn>
  getWaste: ReturnType<typeof vi.fn>
  getMaterial: ReturnType<typeof vi.fn>
  getParticipantWastes: ReturnType<typeof vi.fn>
  getWasteTransferHistory: ReturnType<typeof vi.fn>
  recycleWaste: ReturnType<typeof vi.fn>

  // Incentives
  createIncentive: ReturnType<typeof vi.fn>
  updateIncentive: ReturnType<typeof vi.fn>
  deactivateIncentive: ReturnType<typeof vi.fn>
  getIncentiveById: ReturnType<typeof vi.fn>
  getIncentives: ReturnType<typeof vi.fn>
  getActiveIncentives: ReturnType<typeof vi.fn>
  getActiveMfrIncentive: ReturnType<typeof vi.fn>
  donateToCharity: ReturnType<typeof vi.fn>
  distributeRewards: ReturnType<typeof vi.fn>

  // Stats & Metrics
  getMetrics: ReturnType<typeof vi.fn>
  getStats: ReturnType<typeof vi.fn>
  getSupplyChainStats: ReturnType<typeof vi.fn>
}>

/** All method names that the mock client exposes. */
const ALL_METHODS: Array<keyof ClientMethodOverrides> = [
  'initializeAdmin', 'getAdmin', 'transferAdmin', 'setCharityContract',
  'setTokenAddress', 'setPercentages',
  'registerParticipant', 'getParticipant', 'getParticipantInfo', 'updateRole',
  'deregisterParticipant', 'isParticipantRegistered',
  'submitMaterial', 'submitMaterialsBatch', 'verifyMaterial', 'transferWaste',
  'confirmWasteDetails', 'resetWasteConfirmation', 'deactivateWaste',
  'getWaste', 'getMaterial', 'getParticipantWastes', 'getWasteTransferHistory',
  'recycleWaste',
  'createIncentive', 'updateIncentive', 'deactivateIncentive', 'getIncentiveById',
  'getIncentives', 'getActiveIncentives', 'getActiveMfrIncentive',
  'donateToCharity', 'distributeRewards',
  'getMetrics', 'getStats', 'getSupplyChainStats',
]

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a mock ScavengerClient instance.
 *
 * Every method not listed in `overrides` is replaced with `vi.fn()` that
 * resolves to `undefined` by default — callers can `.mockResolvedValue(...)` it.
 */
export function createMockClient(
  overrides: ClientMethodOverrides = {}
): Record<string, ReturnType<typeof vi.fn>> {
  const client: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ALL_METHODS) {
    client[method] = overrides[method] ?? vi.fn()
  }
  return client
}

// ---------------------------------------------------------------------------
// Convenience helper
// ---------------------------------------------------------------------------

/**
 * Wire up `vi.mock('@/api/client')` and return the individual method spies so
 * tests can set return values without importing from the mocked module.
 *
 * Call this **outside** any describe/it block (module scope) so Vitest can
 * hoist the vi.mock call.
 *
 * @example
 * const { mocks } = setupClientMock()
 *
 * beforeEach(() => mocks.getMetrics.mockResolvedValue({ total_participants: 5n }))
 */
export function setupClientMock(overrides: ClientMethodOverrides = {}) {
  const mocks: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ALL_METHODS) {
    mocks[method] = overrides[method] ?? vi.fn()
  }

  // Return the factory so vi.mock can be wired externally.
  // Tests should call:
  //   vi.mock('@/api/client', () => ({
  //     ScavengerClient: vi.fn().mockImplementation(() => mocks),
  //   }))
  return { mocks }
}
