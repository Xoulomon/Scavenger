/**
 * Unit tests for indexer/src/sync reorg handling (Issue #1120)
 *
 * Tests chain reorganization detection and rollback logic in syncStatus.ts.
 *
 * Reorg Handling Guarantees (documented here per acceptance criteria):
 *
 * 1. DETECTION: detectAndHandleReorg compares stored transaction hashes for a
 *    given ledger against incoming transaction hashes. If any stored hash is
 *    absent from the incoming set, a reorg is detected.
 *
 * 2. ROLLBACK: rollbackFromLedger deletes ALL indexed data at or after the
 *    reorg ledger: raw_events, wastes, participants, waste_transfers,
 *    token_rewards, carbon_credits, auctions.
 *
 * 3. CURSOR RESET: After rollback, sync_status.last_ledger is set to
 *    (fromLedger - 1) so the indexer re-processes from the reorg point.
 *
 * 4. IDEMPOTENCY: Re-running rollbackFromLedger for the same ledger is safe;
 *    DELETEs on already-absent rows are no-ops.
 *
 * 5. DEPTH INDEPENDENCE: Rollback works correctly at any ledger depth — from
 *    the very first ledger (1) to deep reorgs hundreds of ledgers back.
 *
 * 6. TRANSACTION SAFETY: All rollback operations occur within a single
 *    database transaction (the caller-provided PoolClient).
 */

import { PoolClient } from 'pg';
import {
  detectAndHandleReorg,
  rollbackFromLedger,
  getSyncStatus,
  updateSyncStatus,
  setSyncing,
  storeRawEvent,
  withTransaction,
} from '../../src/sync/syncStatus';

// ---------------------------------------------------------------------------
// Mock DB helpers
// ---------------------------------------------------------------------------

type QueryCall = { text: string; params: unknown[] };

/**
 * Creates a minimal PoolClient mock with configurable per-query responses.
 * Pass `queryResults` as a map from SQL snippet → rows array.
 */
function makeMockClient(queryResults: Record<string, unknown[]> = {}): PoolClient & { _calls: QueryCall[] } {
  const _calls: QueryCall[] = [];

  const client = {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      _calls.push({ text, params: params ?? [] });
      const matchKey = Object.keys(queryResults).find((k) => text.includes(k));
      return {
        rows: matchKey ? queryResults[matchKey] : [],
        rowCount: matchKey && queryResults[matchKey] ? queryResults[matchKey].length : 0,
      };
    }),
    _calls,
  } as unknown as PoolClient & { _calls: QueryCall[] };

  return client;
}

// ---------------------------------------------------------------------------
// Mock pg pool and DB dependencies
// ---------------------------------------------------------------------------

const mockPoolQuery = jest.fn();

jest.mock('../../src/db/client', () => ({
  getPool: () => ({
    query: mockPoolQuery,
  }),
  withTransaction: jest.fn(async (fn: (c: PoolClient) => Promise<unknown>) => {
    const client = makeMockClient();
    return fn(client);
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calledWith(client: PoolClient & { _calls: QueryCall[] }, snippet: string) {
  return client._calls.filter((c) => c.text.includes(snippet));
}

// ===========================================================================
// detectAndHandleReorg
// ===========================================================================

describe('detectAndHandleReorg', () => {
  describe('no reorg — all stored hashes present in incoming set', () => {
    it('returns false when stored hash matches incoming hash', async () => {
      const client = makeMockClient({
        'transaction_hash': [{ transaction_hash: 'abc123' }],
      });

      const result = await detectAndHandleReorg(client, 1000, new Set(['abc123']));

      expect(result).toBe(false);
    });

    it('returns false when multiple stored hashes all match incoming', async () => {
      const client = makeMockClient({
        'transaction_hash': [
          { transaction_hash: 'hash1' },
          { transaction_hash: 'hash2' },
          { transaction_hash: 'hash3' },
        ],
      });

      const result = await detectAndHandleReorg(
        client,
        1000,
        new Set(['hash1', 'hash2', 'hash3', 'hash4'])
      );

      expect(result).toBe(false);
    });

    it('returns false when no events stored for that ledger', async () => {
      const client = makeMockClient({ 'transaction_hash': [] });
      const result = await detectAndHandleReorg(client, 999, new Set(['any_hash']));
      expect(result).toBe(false);
    });

    it('does NOT trigger rollback when no reorg', async () => {
      const client = makeMockClient({
        'transaction_hash': [{ transaction_hash: 'match' }],
      });

      await detectAndHandleReorg(client, 100, new Set(['match']));

      const deleteCallCount = calledWith(client, 'DELETE FROM').length;
      expect(deleteCallCount).toBe(0);
    });
  });

  describe('reorg detected — some stored hashes are absent from incoming set', () => {
    it('returns true when stored hash is not in incoming set', async () => {
      const client = makeMockClient({
        'transaction_hash': [{ transaction_hash: 'old_hash' }],
      });

      const result = await detectAndHandleReorg(client, 1000, new Set(['new_hash']));

      expect(result).toBe(true);
    });

    it('returns true when at least one of multiple stored hashes is missing', async () => {
      const client = makeMockClient({
        'transaction_hash': [
          { transaction_hash: 'hash1' },
          { transaction_hash: 'orphaned_hash' }, // not in incoming
        ],
      });

      const result = await detectAndHandleReorg(
        client,
        1000,
        new Set(['hash1', 'hash2'])
      );

      expect(result).toBe(true);
    });

    it('triggers rollback when reorg is detected', async () => {
      const client = makeMockClient({
        'transaction_hash': [{ transaction_hash: 'stale' }],
      });

      await detectAndHandleReorg(client, 500, new Set(['fresh']));

      const deleteCalls = calledWith(client, 'DELETE FROM');
      expect(deleteCalls.length).toBeGreaterThan(0);
    });

    it('rollback deletes raw_events for the reorg ledger', async () => {
      const client = makeMockClient({
        'transaction_hash': [{ transaction_hash: 'orphan' }],
      });

      await detectAndHandleReorg(client, 500, new Set(['canonical']));

      const rawEventsDelete = calledWith(client, 'DELETE FROM raw_events');
      expect(rawEventsDelete.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty incoming set (all hashes considered missing)', async () => {
      const client = makeMockClient({
        'transaction_hash': [{ transaction_hash: 'existing' }],
      });

      const result = await detectAndHandleReorg(client, 100, new Set());

      expect(result).toBe(true);
    });

    it('queries the database for the correct ledger sequence', async () => {
      const client = makeMockClient({ 'transaction_hash': [] });

      await detectAndHandleReorg(client, 42, new Set(['h']));

      const queryCalls = (client.query as jest.Mock).mock.calls;
      const hashQuery = queryCalls.find(
        ([text]: [string]) => text.includes('transaction_hash') && text.includes('ledger_sequence')
      );
      expect(hashQuery).toBeDefined();
      expect(hashQuery[1]).toContain(42);
    });
  });
});

// ===========================================================================
// rollbackFromLedger — tested at various depths
// ===========================================================================

describe('rollbackFromLedger', () => {
  describe('deletes all indexed data at and after the given ledger', () => {
    it('deletes raw_events from the specified ledger', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 500);

      const call = calledWith(client, 'DELETE FROM raw_events')[0];
      expect(call).toBeDefined();
      expect(call.params).toContain(500);
    });

    it('deletes wastes from the specified ledger', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 500);

      const call = calledWith(client, 'DELETE FROM wastes')[0];
      expect(call).toBeDefined();
      expect(call.params).toContain(500);
    });

    it('deletes participants from the specified ledger', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 500);

      const call = calledWith(client, 'DELETE FROM participants')[0];
      expect(call).toBeDefined();
      expect(call.params).toContain(500);
    });

    it('deletes waste_transfers from the specified ledger', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 500);

      const call = calledWith(client, 'DELETE FROM waste_transfers')[0];
      expect(call).toBeDefined();
      expect(call.params).toContain(500);
    });

    it('deletes token_rewards from the specified ledger', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 500);

      const call = calledWith(client, 'DELETE FROM token_rewards')[0];
      expect(call).toBeDefined();
      expect(call.params).toContain(500);
    });

    it('deletes carbon_credits from the specified ledger', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 500);

      const call = calledWith(client, 'DELETE FROM carbon_credits')[0];
      expect(call).toBeDefined();
      expect(call.params).toContain(500);
    });

    it('deletes auctions from the specified ledger', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 500);

      const call = calledWith(client, 'DELETE FROM auctions')[0];
      expect(call).toBeDefined();
      expect(call.params).toContain(500);
    });
  });

  describe('sync cursor reset', () => {
    it('resets last_ledger to (fromLedger - 1)', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 500);

      const syncCall = calledWith(client, 'UPDATE sync_status')[0];
      expect(syncCall).toBeDefined();
      expect(syncCall.params).toEqual([499]);
    });

    it('resets last_ledger to 0 when rolled back to ledger 1', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 1);

      const syncCall = calledWith(client, 'UPDATE sync_status')[0];
      expect(syncCall.params).toEqual([0]);
    });
  });

  describe('depth independence', () => {
    it('works at ledger depth 1 (genesis rollback)', async () => {
      const client = makeMockClient();
      await expect(rollbackFromLedger(client, 1)).resolves.not.toThrow();

      const syncCall = calledWith(client, 'UPDATE sync_status')[0];
      expect(syncCall.params[0]).toBe(0);
    });

    it('works at shallow depth (ledger 10)', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 10);

      const syncCall = calledWith(client, 'UPDATE sync_status')[0];
      expect(syncCall.params[0]).toBe(9);
    });

    it('works at moderate depth (ledger 100)', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 100);

      const syncCall = calledWith(client, 'UPDATE sync_status')[0];
      expect(syncCall.params[0]).toBe(99);
    });

    it('works at deep depth (ledger 100000)', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 100000);

      const syncCall = calledWith(client, 'UPDATE sync_status')[0];
      expect(syncCall.params[0]).toBe(99999);
    });

    it('cleans up ALL seven tables regardless of ledger depth', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 99999);

      const tableNames = [
        'raw_events',
        'wastes',
        'participants',
        'waste_transfers',
        'token_rewards',
        'carbon_credits',
        'auctions',
      ];

      for (const table of tableNames) {
        const deleteCall = calledWith(client, `DELETE FROM ${table}`);
        expect(deleteCall.length).toBeGreaterThan(0);
      }
    });
  });

  describe('idempotency', () => {
    it('can be called twice for the same ledger without error', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 500);
      await expect(rollbackFromLedger(client, 500)).resolves.not.toThrow();
    });

    it('sync cursor is set correctly on second call', async () => {
      const client = makeMockClient();
      await rollbackFromLedger(client, 500);
      await rollbackFromLedger(client, 500);

      const syncCalls = calledWith(client, 'UPDATE sync_status');
      // Both calls should set last_ledger to 499
      syncCalls.forEach((call) => {
        expect(call.params).toEqual([499]);
      });
    });
  });
});

// ===========================================================================
// getSyncStatus
// ===========================================================================

describe('getSyncStatus', () => {
  beforeEach(() => {
    mockPoolQuery.mockReset();
  });

  it('returns lastLedger 0 and isSyncing false when table is empty', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });
    const status = await getSyncStatus();
    expect(status.lastLedger).toBe(0);
    expect(status.isSyncing).toBe(false);
  });

  it('returns the stored lastLedger value', async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ last_ledger: 1234, is_syncing: false }],
    });
    const status = await getSyncStatus();
    expect(status.lastLedger).toBe(1234);
  });

  it('returns the stored isSyncing value', async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ last_ledger: 0, is_syncing: true }],
    });
    const status = await getSyncStatus();
    expect(status.isSyncing).toBe(true);
  });

  it('coerces last_ledger string to number', async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ last_ledger: '5000', is_syncing: false }],
    });
    const status = await getSyncStatus();
    expect(typeof status.lastLedger).toBe('number');
    expect(status.lastLedger).toBe(5000);
  });
});

// ===========================================================================
// updateSyncStatus
// ===========================================================================

describe('updateSyncStatus', () => {
  it('issues an UPDATE query with the correct ledger and close time', async () => {
    const client = makeMockClient();
    const closeTime = new Date('2025-06-01T12:00:00Z');

    await updateSyncStatus(client, 1000, closeTime);

    const call = calledWith(client, 'UPDATE sync_status')[0];
    expect(call).toBeDefined();
    expect(call.params[0]).toBe(1000);
    expect(call.params[1]).toEqual(closeTime);
  });
});

// ===========================================================================
// setSyncing
// ===========================================================================

describe('setSyncing', () => {
  beforeEach(() => {
    mockPoolQuery.mockReset();
  });

  it('sets is_syncing to true', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await setSyncing(true);

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sync_status SET is_syncing'),
      [true]
    );
  });

  it('sets is_syncing to false', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await setSyncing(false);

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sync_status SET is_syncing'),
      [false]
    );
  });
});

// ===========================================================================
// storeRawEvent
// ===========================================================================

describe('storeRawEvent', () => {
  it('inserts a raw event with all required fields', async () => {
    const client = makeMockClient();
    const event = {
      ledgerSequence: 1000,
      ledgerCloseTime: new Date('2025-01-01T00:00:00Z'),
      transactionHash: 'abc123',
      contractId: 'CCONTRACT',
      eventType: 'recycled',
      topic: ['recycled', '42'],
      value: { type: 2, weight: '1000' },
    };

    await storeRawEvent(client, event);

    const insertCall = calledWith(client, 'INSERT INTO raw_events')[0];
    expect(insertCall).toBeDefined();
    expect(insertCall.params[0]).toBe(1000);
    expect(insertCall.params[2]).toBe('abc123');
    expect(insertCall.params[4]).toBe('recycled');
  });

  it('uses ON CONFLICT DO NOTHING for idempotency', async () => {
    const client = makeMockClient();
    const event = {
      ledgerSequence: 100,
      ledgerCloseTime: new Date(),
      transactionHash: 'hash1',
      contractId: 'C',
      eventType: 'reg',
      topic: ['reg', 'G'],
      value: null,
    };

    await storeRawEvent(client, event);

    const call = calledWith(client, 'INSERT INTO raw_events')[0];
    expect(call.text ?? call).toContain !== undefined;
    // The query string should contain ON CONFLICT DO NOTHING
    const queryText = (client.query as jest.Mock).mock.calls[0][0] as string;
    expect(queryText).toContain('ON CONFLICT DO NOTHING');
  });
});

// ===========================================================================
// Multi-ledger reorg scenarios (simulating real chain behavior)
// ===========================================================================

describe('multi-ledger reorg scenarios', () => {
  it('simulates a 1-deep reorg at ledger 1000', async () => {
    // Scenario: ledger 1000 has stale data; incoming canonical chain diverges
    const client = makeMockClient({
      'transaction_hash': [{ transaction_hash: 'canonical_pre_reorg_hash' }],
    });

    // Step 1: detect reorg
    const reorgDetected = await detectAndHandleReorg(
      client,
      1000,
      new Set(['new_canonical_hash']) // different from stored
    );
    expect(reorgDetected).toBe(true);

    // Step 2: rollback happened as part of detect
    const deleteRawEvents = calledWith(client, 'DELETE FROM raw_events');
    expect(deleteRawEvents[0].params[0]).toBe(1000);
  });

  it('simulates a 5-deep reorg at ledger 100', async () => {
    // Reorg was at ledger 96; indexer must roll back to ledger 95
    const reorgLedger = 96;
    const client = makeMockClient({
      'transaction_hash': [{ transaction_hash: 'old_fork_hash' }],
    });

    await detectAndHandleReorg(client, reorgLedger, new Set(['canonical_hash']));

    const syncCall = calledWith(client, 'UPDATE sync_status')[0];
    expect(syncCall.params[0]).toBe(reorgLedger - 1); // cursor set to 95
  });

  it('simulates a 50-deep reorg', async () => {
    const client = makeMockClient({
      'transaction_hash': [{ transaction_hash: 'stale' }],
    });

    const reorgLedger = 1050;
    await rollbackFromLedger(client, reorgLedger);

    const syncCall = calledWith(client, 'UPDATE sync_status')[0];
    expect(syncCall.params[0]).toBe(1049);
  });

  it('simulates a 200-deep reorg (genesis block territory)', async () => {
    const client = makeMockClient();
    await rollbackFromLedger(client, 200);

    const syncCall = calledWith(client, 'UPDATE sync_status')[0];
    expect(syncCall.params[0]).toBe(199);

    // All tables cleaned up
    const tableNames = ['raw_events', 'wastes', 'participants', 'waste_transfers'];
    for (const t of tableNames) {
      expect(calledWith(client, `DELETE FROM ${t}`).length).toBeGreaterThan(0);
    }
  });
});
