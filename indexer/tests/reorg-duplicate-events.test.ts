/**
 * Reorg detection + duplicate-event handling tests — issue #1756
 *
 * - `detectAndHandleReorg`: triggers a rollback when stored tx hashes are
 *   absent from the incoming batch; stays quiet when they all match.
 * - `rollbackFromLedger`: deletes raw events and state rows, resets the
 *   sync cursor.
 * - `storeRawEvent`: inserts with `ON CONFLICT DO NOTHING` so duplicate
 *   events are not inserted twice.
 *
 * All DB access goes through a lightweight mock PoolClient; no database needed.
 */

import { detectAndHandleReorg, rollbackFromLedger, storeRawEvent } from '../src/sync/syncStatus';

// Mock the DB layer: the functions under test take the PoolClient as a
// parameter and never touch the real pool. Mocking keeps the suite
// deterministic (and free of DB access) per issue #1756.
jest.mock('../src/db/client', () => ({
  getPool: jest.fn(),
  withTransaction: jest.fn(),
}));

function makeClient() {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const client = {
    query: jest.fn().mockImplementation((text: string, values: unknown[]) => {
      queries.push({ text, values });
      return Promise.resolve({ rows: [] });
    }),
    _queries: queries,
  };
  return client;
}

function sqlTexts(client: ReturnType<typeof makeClient>): string[] {
  return client._queries.map((q) => q.text);
}

describe('detectAndHandleReorg (issue #1756)', () => {
  it('rolls back when a stored tx hash is missing from the incoming batch', async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [{ transaction_hash: '0xstale' }] });

    const result = await detectAndHandleReorg(client as any, 100, new Set(['0xfresh']));

    expect(result).toBe(true);
    expect(sqlTexts(client).some((t) => t.includes('DELETE FROM raw_events'))).toBe(true);
  });

  it('does not roll back when every stored hash is present in the incoming batch', async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({
      rows: [{ transaction_hash: '0xok' }, { transaction_hash: '0xok2' }],
    });

    const result = await detectAndHandleReorg(client as any, 100, new Set(['0xok', '0xok2']));

    expect(result).toBe(false);
    expect(sqlTexts(client).some((t) => t.includes('DELETE FROM raw_events'))).toBe(false);
  });
});

describe('rollbackFromLedger (issue #1756)', () => {
  it('deletes raw events, state rows and resets the sync cursor', async () => {
    const client = makeClient();

    await rollbackFromLedger(client as any, 100);

    const texts = sqlTexts(client);
    expect(texts.some((t) => t.includes('DELETE FROM raw_events'))).toBe(true);
    expect(texts.some((t) => t.includes('DELETE FROM wastes'))).toBe(true);
    expect(texts.some((t) => t.includes('DELETE FROM participants'))).toBe(true);
    expect(texts.some((t) => t.includes('DELETE FROM waste_transfers'))).toBe(true);
    expect(texts.some((t) => t.includes('DELETE FROM token_rewards'))).toBe(true);
    expect(texts.some((t) => t.includes('DELETE FROM carbon_credits'))).toBe(true);
    expect(texts.some((t) => t.includes('DELETE FROM auctions'))).toBe(true);
    expect(texts.some((t) => t.includes('UPDATE sync_status SET last_ledger = $1'))).toBe(true);
  });
});

describe('storeRawEvent — duplicate events (issue #1756)', () => {
  it('inserts with ON CONFLICT DO NOTHING so duplicate events are ignored', async () => {
    const client = makeClient();

    await storeRawEvent(client as any, {
      ledgerSequence: 100,
      ledgerCloseTime: new Date('2024-01-01T00:00:00Z'),
      transactionHash: '0xabc',
      contractId: 'C',
      eventType: 'recycled',
      topic: ['recycled', 'w1'],
      value: ['Plastic', '1'],
    });

    const firstQuery = client._queries[0];
    expect(firstQuery?.text).toContain('INSERT INTO raw_events');
    expect(firstQuery?.text).toContain('ON CONFLICT DO NOTHING');
  });
});
