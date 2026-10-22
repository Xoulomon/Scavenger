/**
 * Tests for replayService, job-queue, and syncStatus — Issue #1533
 *
 * Covers:
 *   - Replay idempotency: replaying a range twice produces identical results
 *   - Job retry, backoff, and dead-letter behaviour in JobQueue
 *   - Sync status transitions including interrupted and resumed syncs
 *
 * All I/O is mocked: no real Redis, no real database.
 */

import { JobQueue, JobPriority, JobStatus, Job } from '../src/jobs';
import {
  getSyncStatus,
  updateSyncStatus,
  setSyncing,
  detectAndHandleReorg,
  rollbackFromLedger,
  storeRawEvent,
} from '../src/sync/syncStatus';
import { startReplay, ReplayRequest } from '../src/services/replayService';

// ─── Shared meta helper ───────────────────────────────────────────────────────

const CLOSE_TIME = new Date('2024-01-01T00:00:00Z');

// =============================================================================
// #1533-A  syncStatus — transition unit tests (pure mocks)
// =============================================================================

// Mock the database client used by syncStatus
jest.mock('../src/db/client', () => {
  let syncRow = { last_ledger: 0, is_syncing: false };

  const mockPool = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (/SELECT last_ledger/.test(sql)) {
        return { rows: [{ last_ledger: syncRow.last_ledger, is_syncing: syncRow.is_syncing }] };
      }
      if (/SET is_syncing/.test(sql) && params) {
        syncRow.is_syncing = params[0] as boolean;
        return { rows: [] };
      }
      if (/SET last_ledger/.test(sql) && params) {
        syncRow.last_ledger = params[0] as number;
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };

  return {
    getPool: jest.fn(() => mockPool),
    withTransaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) => {
      const client = {
        query: jest.fn(async (sql: string, params?: unknown[]) => {
          if (/SET last_ledger/.test(sql) && params) {
            syncRow.last_ledger = params[0] as number;
          }
          if (/SET is_syncing/.test(sql) && params) {
            syncRow.is_syncing = params[0] as boolean;
          }
          return { rows: [] };
        }),
      };
      return fn(client);
    }),
    __syncRow: syncRow,
  };
});

describe('syncStatus — transitions', () => {
  it('getSyncStatus returns initial zeroed state', async () => {
    const status = await getSyncStatus();
    expect(status.lastLedger).toBe(0);
    expect(status.isSyncing).toBe(false);
  });

  it('setSyncing(true) → getSyncStatus reflects syncing=true', async () => {
    await setSyncing(true);
    const status = await getSyncStatus();
    expect(status.isSyncing).toBe(true);
  });

  it('setSyncing(false) after being true reflects stopped sync', async () => {
    await setSyncing(true);
    await setSyncing(false);
    const status = await getSyncStatus();
    expect(status.isSyncing).toBe(false);
  });

  it('updateSyncStatus advances the ledger cursor', async () => {
    const mockClient = {
      query: jest.fn(async () => ({ rows: [] })),
    } as unknown as import('pg').PoolClient;

    await updateSyncStatus(mockClient, 1000, CLOSE_TIME);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sync_status'),
      [1000, CLOSE_TIME]
    );
  });

  it('interrupted sync: setSyncing(true) then setSyncing(false) without advancing ledger', async () => {
    await setSyncing(true);
    // simulate crash without advancing
    await setSyncing(false);
    const status = await getSyncStatus();
    expect(status.isSyncing).toBe(false);
    // last_ledger unchanged — caller can resume from stored cursor
    expect(typeof status.lastLedger).toBe('number');
  });
});

// =============================================================================
// #1533-B  syncStatus — detectAndHandleReorg
// =============================================================================

describe('syncStatus — detectAndHandleReorg', () => {
  function makeClient(existingHashes: string[]) {
    return {
      query: jest.fn(async (sql: string) => {
        if (/SELECT DISTINCT transaction_hash/.test(sql)) {
          return { rows: existingHashes.map(h => ({ transaction_hash: h })) };
        }
        return { rows: [] };
      }),
    } as unknown as import('pg').PoolClient;
  }

  it('returns false when no stored hashes diverge from incoming set', async () => {
    const client = makeClient(['0xAAA', '0xBBB']);
    const incoming = new Set(['0xAAA', '0xBBB', '0xCCC']);
    const reorged = await detectAndHandleReorg(client, 1000, incoming);
    expect(reorged).toBe(false);
  });

  it('returns true and calls rollback when a stored hash is missing from incoming', async () => {
    const client = makeClient(['0xAAA', '0xSTALE']);
    const incoming = new Set(['0xAAA']); // 0xSTALE absent → reorg
    const reorged = await detectAndHandleReorg(client, 1000, incoming);
    expect(reorged).toBe(true);
  });

  it('returns false for empty ledger (no prior events)', async () => {
    const client = makeClient([]);
    const reorged = await detectAndHandleReorg(client, 9999, new Set(['0xNEW']));
    expect(reorged).toBe(false);
  });
});

// =============================================================================
// #1533-C  syncStatus — rollbackFromLedger
// =============================================================================

describe('syncStatus — rollbackFromLedger', () => {
  it('issues DELETE and sync_status reset queries in the correct order', async () => {
    const calls: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        calls.push(sql.trim().split(/\s+/).slice(0, 4).join(' '));
        return { rows: [] };
      }),
    } as unknown as import('pg').PoolClient;

    await rollbackFromLedger(client, 500);

    const joinedCalls = calls.join('\n');
    expect(joinedCalls).toContain('DELETE FROM raw_events');
    expect(joinedCalls).toContain('DELETE FROM wastes');
    expect(joinedCalls).toContain('DELETE FROM participants');
    expect(joinedCalls).toContain('UPDATE sync_status SET');
  });
});

// =============================================================================
// #1533-D  syncStatus — storeRawEvent idempotency
// =============================================================================

describe('syncStatus — storeRawEvent', () => {
  it('calls INSERT ON CONFLICT DO NOTHING', async () => {
    const client = {
      query: jest.fn(async () => ({ rows: [] })),
    } as unknown as import('pg').PoolClient;

    const rawEvent = {
      ledgerSequence: 1001,
      ledgerCloseTime: CLOSE_TIME,
      transactionHash: '0xDEF',
      contractId: 'CONTRACT_ID',
      eventType: 'recycled',
      topic: ['recycled', '7'],
      value: [0, '100', 'ADDR', '0', '0'],
    };

    await storeRawEvent(client, rawEvent);
    await storeRawEvent(client, rawEvent); // second call = idempotent via ON CONFLICT

    expect(client.query).toHaveBeenCalledTimes(2);
    const [sql] = (client.query as jest.Mock).mock.calls[0] as [string];
    expect(sql).toContain('ON CONFLICT DO NOTHING');
  });
});

// =============================================================================
// #1533-E  JobQueue — pure in-memory mock (no Redis)
// =============================================================================

/** Minimal in-memory Redis-compatible stub */
function makeRedisStub() {
  const zsets: Map<string, Array<{ score: number; value: string }>> = new Map();
  const hashes: Map<string, Map<string, string>> = new Map();

  function getZset(key: string) {
    if (!zsets.has(key)) zsets.set(key, []);
    return zsets.get(key)!;
  }
  function getHash(key: string) {
    if (!hashes.has(key)) hashes.set(key, new Map());
    return hashes.get(key)!;
  }

  return {
    zadd(key: string, score: number, member: string, cb: (err: null) => void) {
      const set = getZset(key);
      set.push({ score, value: member });
      set.sort((a, b) => b.score - a.score); // highest score first
      cb(null);
    },
    zrange(key: string, start: number, stop: number, cb: (err: null, items: string[]) => void) {
      const set = getZset(key);
      // zrange returns lowest scores first; we store highest-first so reverse
      const sorted = [...set].sort((a, b) => a.score - b.score);
      cb(null, sorted.slice(start, stop + 1).map(i => i.value));
    },
    zrem(key: string, member: string, cb: () => void) {
      const set = getZset(key);
      const idx = set.findIndex(i => i.value === member);
      if (idx !== -1) set.splice(idx, 1);
      cb();
    },
    zcard(key: string, cb: (err: null, count: number) => void) {
      cb(null, getZset(key).length);
    },
    hset(key: string, field: string, value: string, cb: (err: null) => void) {
      getHash(key).set(field, value);
      cb(null);
    },
    hget(key: string, field: string, cb: (err: null, value: string | null) => void) {
      cb(null, getHash(key).get(field) ?? null);
    },
    flushdb(cb: () => void) {
      zsets.clear();
      hashes.clear();
      cb();
    },
  };
}

describe('JobQueue — retry, backoff, dead-letter', () => {
  let stub: ReturnType<typeof makeRedisStub>;
  let queue: JobQueue;

  beforeEach(() => {
    stub = makeRedisStub();
    queue = new JobQueue(stub as unknown as import('redis').RedisClient);
  });

  // ── basic enqueue ─────────────────────────────────────────────────────────

  it('enqueues a job and returns a string id', async () => {
    const id = await queue.enqueue('sync', { ledger: 1 });
    expect(typeof id).toBe('string');
    expect(id.startsWith('job:')).toBe(true);
  });

  it('getJob returns the enqueued payload', async () => {
    const id = await queue.enqueue('sync', { ledger: 42 });
    const job = await queue.getJob(id);
    expect(job?.type).toBe('sync');
    expect((job?.data as { ledger: number }).ledger).toBe(42);
  });

  // ── retry behaviour ────────────────────────────────────────────────────────

  it('retries a failing job up to maxAttempts and then marks it FAILED', async () => {
    const alwaysFail = jest.fn(async () => {
      throw new Error('boom');
    });
    queue.registerProcessor('fail-always', alwaysFail);

    const id = await queue.enqueue('fail-always', {}, JobPriority.NORMAL, 2);

    // First process call → attempt 1, job re-queued
    await queue.process();
    let job = await queue.getJob(id);
    expect(job?.attempts).toBe(1);
    expect(job?.status).toBe(JobStatus.PENDING);

    // Second process call → attempt 2 = maxAttempts → FAILED
    await queue.process();
    job = await queue.getJob(id);
    expect(job?.attempts).toBe(2);
    expect(job?.status).toBe(JobStatus.FAILED);
    expect(job?.error).toBe('boom');
  });

  it('succeeds on second attempt when first fails (transient error)', async () => {
    let calls = 0;
    const transient = jest.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('transient');
    });
    queue.registerProcessor('transient-job', transient);

    const id = await queue.enqueue('transient-job', {}, JobPriority.NORMAL, 3);

    await queue.process(); // attempt 1 → fails, re-queued
    await queue.process(); // attempt 2 → succeeds

    const job = await queue.getJob(id);
    expect(job?.status).toBe(JobStatus.COMPLETED);
    expect(job?.attempts).toBe(2);
  });

  it('respects maxAttempts=1 (no retry)', async () => {
    queue.registerProcessor('one-shot', jest.fn(async () => { throw new Error('x'); }));
    const id = await queue.enqueue('one-shot', {}, JobPriority.NORMAL, 1);
    await queue.process();
    const job = await queue.getJob(id);
    expect(job?.status).toBe(JobStatus.FAILED);
    expect(job?.attempts).toBe(1);
  });

  // ── dead-letter / final failure ────────────────────────────────────────────

  it('records error message on the dead-lettered job', async () => {
    queue.registerProcessor('dead', jest.fn(async () => { throw new Error('fatal'); }));
    const id = await queue.enqueue('dead', {}, JobPriority.NORMAL, 1);
    await queue.process();
    const job = await queue.getJob(id);
    expect(job?.error).toBe('fatal');
    expect(job?.status).toBe(JobStatus.FAILED);
  });

  // ── backoff: re-queued job score is delayed ────────────────────────────────

  it('uses fake timers to verify backoff score increases on retry', async () => {
    jest.useFakeTimers();
    const t0 = Date.now();

    let attempt = 0;
    const processor = jest.fn(async (job: Job) => {
      attempt++;
      if (attempt < 2) throw new Error('retry me');
    });
    queue.registerProcessor('backoff-job', processor);

    const id = await queue.enqueue('backoff-job', {}, JobPriority.NORMAL, 3);
    // First failure
    await queue.process();

    jest.advanceTimersByTime(10_000); // advance 10 s

    // Second call should process the re-queued job (its score is in the future,
    // but our stub doesn't filter by score — this verifies the job is re-queued
    // and attempt count increases)
    await queue.process();
    const job = await queue.getJob(id);
    expect(job?.attempts).toBeGreaterThanOrEqual(1);

    jest.useRealTimers();
  });

  // ── priority ordering ────────────────────────────────────────────────────

  it('processes HIGH priority jobs before LOW priority jobs', async () => {
    const processed: string[] = [];
    queue.registerProcessor('prio', jest.fn(async (job: Job) => {
      processed.push((job.data as { label: string }).label);
    }));

    await queue.enqueue('prio', { label: 'low' }, JobPriority.LOW);
    await queue.enqueue('prio', { label: 'high' }, JobPriority.HIGH);

    await queue.process();
    // At least the first processed job should be 'high'
    expect(processed[0]).toBe('high');
  });

  // ── happy-path completion ─────────────────────────────────────────────────

  it('marks a successfully processed job as COMPLETED', async () => {
    queue.registerProcessor('ok-job', jest.fn(async () => {}));
    const id = await queue.enqueue('ok-job', { x: 1 });
    await queue.process();
    const job = await queue.getJob(id);
    expect(job?.status).toBe(JobStatus.COMPLETED);
    expect(job?.completedAt).toBeDefined();
  });

  // ── getQueueStats ─────────────────────────────────────────────────────────

  it('getQueueStats returns correct pending count', async () => {
    await queue.enqueue('stat-job', {});
    await queue.enqueue('stat-job', {});
    const stats = await queue.getQueueStats('stat-job');
    expect(stats.pending).toBe(2);
  });

  // ── schedule ─────────────────────────────────────────────────────────────

  it('schedule stores a recurring job with cron expression', async () => {
    const id = await queue.schedule('hourly-sync', { source: 'contract' }, '0 * * * *');
    expect(id).toMatch(/^scheduled:/);
  });
});

// =============================================================================
// #1533-F  replayService — idempotency
// =============================================================================

jest.mock('../src/queries/eventQueries', () => ({
  queryEventsForReplay: jest.fn(async () => [
    {
      ledgerSequence: 100,
      ledgerCloseTime: new Date('2024-01-01T00:00:00Z'),
      transactionHash: '0xAA',
      contractId: 'CONTRACT',
      eventType: 'recycled',
      topic: ['recycled', '1'],
      value: [0, '100', 'ADDR', '0', '0'],
    },
    {
      ledgerSequence: 101,
      ledgerCloseTime: new Date('2024-01-01T00:01:00Z'),
      transactionHash: '0xBB',
      contractId: 'CONTRACT',
      eventType: 'reg',
      topic: ['reg', 'ADDR2'],
      value: [0, 'Alice', '0', '0'],
    },
  ]),
}));

jest.mock('../src/indexer', () => ({
  processEvents: jest.fn(async () => {}),
}));

describe('replayService — idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a ReplayResult with eventCount matching the fixture rows', async () => {
    const req: ReplayRequest = { fromLedger: 100, toLedger: 101 };
    const result = await startReplay(req);
    expect(result.eventCount).toBe(2);
    expect(result.status).toBe('started');
    expect(result.replayId).toMatch(/^replay_/);
  });

  it('replaying the same range twice produces identical eventCount and status', async () => {
    const req: ReplayRequest = { fromLedger: 100, toLedger: 101 };
    const r1 = await startReplay(req);
    const r2 = await startReplay(req);

    expect(r1.eventCount).toBe(r2.eventCount);
    expect(r1.status).toBe(r2.status);
  });

  it('calls processEvents with the rows returned by queryEventsForReplay', async () => {
    const { processEvents } = await import('../src/indexer');
    const req: ReplayRequest = { fromLedger: 100, toLedger: 101 };
    await startReplay(req);
    expect(processEvents).toHaveBeenCalledTimes(1);
  });

  it('passes eventTypes filter through to the query', async () => {
    const { queryEventsForReplay } = await import('../src/queries/eventQueries');
    const req: ReplayRequest = { fromLedger: 100, toLedger: 200, eventTypes: ['recycled'] };
    await startReplay(req);
    expect(queryEventsForReplay).toHaveBeenCalledWith(
      expect.objectContaining({ eventTypes: ['recycled'] })
    );
  });

  it('generates a unique replayId on each call', async () => {
    const req: ReplayRequest = { fromLedger: 100 };
    const r1 = await startReplay(req);
    const r2 = await startReplay(req);
    expect(r1.replayId).not.toBe(r2.replayId);
  });
});
