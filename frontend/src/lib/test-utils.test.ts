/**
 * #963 – Unit tests for the shared E2E test-utils module.
 *
 * These tests run in Node (via Vitest / jsdom) and verify the pure-logic
 * parts of the shared utilities: default fixtures, data factory, and
 * backwards-compatible shim exports.
 *
 * Browser-only helpers (page.goto, page.route, etc.) are not tested here;
 * they are covered by the Playwright integration suite.
 */

import { describe, it, expect } from 'vitest';

import {
  TEST_WALLET_ADDRESS,
  TEST_CONTRACT_ID,
  defaultParticipant,
  defaultWaste,
  TestDataFactory,
  type MockParticipant,
  type MockWaste,
} from '../../e2e/test-utils';

// ─── Constants ────────────────────────────────────────────────────────────────

describe('Constants', () => {
  it('TEST_WALLET_ADDRESS is a non-empty string', () => {
    expect(typeof TEST_WALLET_ADDRESS).toBe('string');
    expect(TEST_WALLET_ADDRESS.length).toBeGreaterThan(0);
  });

  it('TEST_CONTRACT_ID is a non-empty string', () => {
    expect(typeof TEST_CONTRACT_ID).toBe('string');
    expect(TEST_CONTRACT_ID.length).toBeGreaterThan(0);
  });

  it('TEST_WALLET_ADDRESS and TEST_CONTRACT_ID are distinct', () => {
    expect(TEST_WALLET_ADDRESS).not.toBe(TEST_CONTRACT_ID);
  });
});

// ─── Default fixtures ─────────────────────────────────────────────────────────

describe('defaultParticipant', () => {
  it('has the correct shape', () => {
    const keys: (keyof MockParticipant)[] = [
      'address',
      'name',
      'role',
      'latitude',
      'longitude',
      'registered_at',
      'is_active',
    ];
    for (const key of keys) {
      expect(defaultParticipant).toHaveProperty(key);
    }
  });

  it('address matches TEST_WALLET_ADDRESS', () => {
    expect(defaultParticipant.address).toBe(TEST_WALLET_ADDRESS);
  });

  it('is_active is true', () => {
    expect(defaultParticipant.is_active).toBe(true);
  });

  it('registered_at is a recent Unix timestamp (within last 60 s)', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(defaultParticipant.registered_at).toBeLessThanOrEqual(now);
    expect(defaultParticipant.registered_at).toBeGreaterThan(now - 60);
  });
});

describe('defaultWaste', () => {
  it('has the correct shape', () => {
    const keys: (keyof MockWaste)[] = [
      'waste_id',
      'waste_type',
      'weight',
      'current_owner',
      'latitude',
      'longitude',
      'recycled_timestamp',
      'is_active',
      'is_confirmed',
      'confirmer',
    ];
    for (const key of keys) {
      expect(defaultWaste).toHaveProperty(key);
    }
  });

  it('current_owner matches TEST_WALLET_ADDRESS', () => {
    expect(defaultWaste.current_owner).toBe(TEST_WALLET_ADDRESS);
  });

  it('starts unconfirmed', () => {
    expect(defaultWaste.is_confirmed).toBe(false);
    expect(defaultWaste.confirmer).toBe('');
  });

  it('is_active is true', () => {
    expect(defaultWaste.is_active).toBe(true);
  });

  it('weight is a positive number', () => {
    expect(defaultWaste.weight).toBeGreaterThan(0);
  });
});

// ─── TestDataFactory ──────────────────────────────────────────────────────────

describe('TestDataFactory.generateWasteData', () => {
  it('returns an object with type, weight, latitude, longitude', () => {
    const data = TestDataFactory.generateWasteData();
    expect(data).toHaveProperty('type');
    expect(data).toHaveProperty('weight');
    expect(data).toHaveProperty('latitude');
    expect(data).toHaveProperty('longitude');
  });

  it('type is a non-empty string', () => {
    expect(TestDataFactory.generateWasteData().type.length).toBeGreaterThan(0);
  });

  it('weight parses to a positive integer', () => {
    const weight = parseInt(TestDataFactory.generateWasteData().weight, 10);
    expect(weight).toBeGreaterThan(0);
  });

  it('latitude is within -90..90', () => {
    const lat = parseFloat(TestDataFactory.generateWasteData().latitude);
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
  });

  it('longitude is within -180..180', () => {
    const lon = parseFloat(TestDataFactory.generateWasteData().longitude);
    expect(lon).toBeGreaterThanOrEqual(-180);
    expect(lon).toBeLessThanOrEqual(180);
  });

  it('two calls return different values (random)', () => {
    // Extremely unlikely to collide even with poor RNG.
    const a = TestDataFactory.generateWasteData();
    const b = TestDataFactory.generateWasteData();
    // At least one field differs on average
    const allSame =
      a.weight === b.weight && a.latitude === b.latitude && a.longitude === b.longitude;
    // We can't guarantee randomness 100% of the time in a unit test but this
    // practically never fires.
    expect(allSame).toBe(false);
  });
});

describe('TestDataFactory.generateParticipantData', () => {
  it('includes the provided role', () => {
    const data = TestDataFactory.generateParticipantData('Recycler');
    expect(data.role).toBe('Recycler');
  });

  it('name contains the role', () => {
    const data = TestDataFactory.generateParticipantData('Collector');
    expect(data.name).toContain('Collector');
  });

  it('latitude is within range', () => {
    const lat = parseFloat(TestDataFactory.generateParticipantData('Manufacturer').latitude);
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
  });
});

describe('TestDataFactory.generateIncentiveData', () => {
  it('returns wasteType, rewardPoints, budget', () => {
    const data = TestDataFactory.generateIncentiveData();
    expect(data).toHaveProperty('wasteType');
    expect(data).toHaveProperty('rewardPoints');
    expect(data).toHaveProperty('budget');
  });

  it('rewardPoints parses to a positive integer', () => {
    const pts = parseInt(TestDataFactory.generateIncentiveData().rewardPoints, 10);
    expect(pts).toBeGreaterThan(0);
  });

  it('budget parses to a positive integer', () => {
    const budget = parseInt(TestDataFactory.generateIncentiveData().budget, 10);
    expect(budget).toBeGreaterThan(0);
  });
});

// ─── Backwards-compat shim exports ───────────────────────────────────────────

describe('Backwards-compat shim: fixtures/seed.ts', () => {
  it('re-exports TEST_WALLET_ADDRESS from test-utils', async () => {
    const seed = await import('../../e2e/fixtures/seed');
    expect(seed.TEST_WALLET_ADDRESS).toBe(TEST_WALLET_ADDRESS);
  });

  it('re-exports TEST_CONTRACT_ID from test-utils', async () => {
    const seed = await import('../../e2e/fixtures/seed');
    expect(seed.TEST_CONTRACT_ID).toBe(TEST_CONTRACT_ID);
  });

  it('re-exports seedWalletConnection as a function', async () => {
    const seed = await import('../../e2e/fixtures/seed');
    expect(typeof seed.seedWalletConnection).toBe('function');
  });

  it('re-exports seedApiRoutes as a function', async () => {
    const seed = await import('../../e2e/fixtures/seed');
    expect(typeof seed.seedApiRoutes).toBe('function');
  });
});

describe('Backwards-compat shim: helpers/test-helpers.ts', () => {
  it('re-exports TestHelpers class', async () => {
    const helpers = await import('../../e2e/helpers/test-helpers');
    expect(typeof helpers.TestHelpers).toBe('function');
  });

  it('re-exports TestDataFactory', async () => {
    const helpers = await import('../../e2e/helpers/test-helpers');
    expect(typeof helpers.TestDataFactory).toBe('object');
  });

  it('re-exports PerformanceHelpers class', async () => {
    const helpers = await import('../../e2e/helpers/test-helpers');
    expect(typeof helpers.PerformanceHelpers).toBe('function');
  });

  it('re-exports VisualRegressionHelpers class', async () => {
    const helpers = await import('../../e2e/helpers/test-helpers');
    expect(typeof helpers.VisualRegressionHelpers).toBe('function');
  });
});
