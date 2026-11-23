/**
 * #963 – Backwards-compatibility re-export shim.
 *
 * All exports previously defined in this file now live in `../test-utils`.
 * This file re-exports everything so existing import paths continue to work
 * during the migration period.
 *
 * Prefer importing directly from `../test-utils` in new tests.
 */

export {
  TEST_WALLET_ADDRESS,
  TEST_CONTRACT_ID,
  defaultParticipant,
  defaultWaste,
  seedWalletConnection,
  seedApiRoutes,
  seedLocalStorageAuth,
  clearLocalStorageAuth,
  waitForAppReady,
  dismissNotifications,
  type MockParticipant,
  type MockWaste,
  type SeedApiOptions
} from '../test-utils'
