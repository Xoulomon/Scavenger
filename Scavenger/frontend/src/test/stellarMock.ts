// =============================================================================
// Shared Stellar SDK mock for frontend tests (issue #1283)
//
// Usage for new test authors:
//   import { createStellarMock, resetStellarMock } from "../test/stellarMock";
//
//   vi.mock("@stellar/stellar-sdk", () => createStellarMock());
//
//   beforeEach(() => resetStellarMock());
//
// The mock exposes deterministic, chain-free stand-ins for the SDK surfaces
// used by wallet/contract call paths so tests never hit real SDK code paths.
// =============================================================================
import { vi } from "vitest";

export interface StellarMockOverrides {
  server?: Record<string, unknown>;
  contract?: Record<string, unknown>;
  keypair?: Record<string, unknown>;
}

/** Deterministic fake public key used by mocked keypairs. */
export const MOCK_PUBLIC_KEY =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/** Deterministic fake secret key used by mocked keypairs. */
export const MOCK_SECRET_KEY =
  "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Deterministic fake transaction hash returned by mocked submissions. */
export const MOCK_TX_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Build a fresh Stellar SDK mock module. Pass the result to `vi.mock`.
 * Overrides let individual suites customise specific SDK members.
 */
export function createStellarMock(overrides: StellarMockOverrides = {}) {
  const server = {
    getAccount: vi.fn().mockResolvedValue({
      accountId: () => MOCK_PUBLIC_KEY,
      sequenceNumber: () => "0",
      balances: [],
    }),
    getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1 }),
    simulateTransaction: vi.fn().mockResolvedValue({
      result: { retval: null },
      events: [],
    }),
    prepareTransaction: vi.fn().mockResolvedValue({ toXDR: () => "" }),
    sendTransaction: vi.fn().mockResolvedValue({
      status: "SUCCESS",
      hash: MOCK_TX_HASH,
    }),
    getTransaction: vi.fn().mockResolvedValue({
      status: "SUCCESS",
      hash: MOCK_TX_HASH,
    }),
    ...overrides.server,
  };

  const contract = {
    call: vi.fn().mockResolvedValue({ result: null }),
    ...overrides.contract,
  };

  const keypair = {
    publicKey: () => MOCK_PUBLIC_KEY,
    secret: () => MOCK_SECRET_KEY,
    sign: vi.fn().mockReturnValue(Buffer.from("")),
    ...overrides.keypair,
  };

  return {
    Keypair: {
      fromSecret: vi.fn().mockReturnValue(keypair),
      fromPublicKey: vi.fn().mockReturnValue(keypair),
      random: vi.fn().mockReturnValue(keypair),
    },
    Contract: vi.fn().mockImplementation(() => contract),
    TransactionBuilder: vi.fn().mockImplementation(() => ({
      addOperation: vi.fn().mockReturnThis(),
      setTimeout: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({ toXDR: () => "" }),
    })),
    Networks: {
      TESTNET: "Test SDF Network ; September 2015",
      PUBLIC: "Public Global Stellar Network ; September 2015",
    },
    SorobanRpc: { Server: vi.fn().mockImplementation(() => server) },
    rpc: { Server: vi.fn().mockImplementation(() => server) },
    Horizon: { Server: vi.fn().mockImplementation(() => server) },
    nativeToScVal: vi.fn().mockImplementation((value: unknown) => value),
    scValToNative: vi.fn().mockImplementation((value: unknown) => value),
    Address: { fromString: vi.fn().mockReturnValue({ toString: () => MOCK_PUBLIC_KEY }) },
    __server: server,
    __contract: contract,
    __keypair: keypair,
  };
}

/** Reset all mock call history between tests. */
export function resetStellarMock(): void {
  vi.clearAllMocks();
}
