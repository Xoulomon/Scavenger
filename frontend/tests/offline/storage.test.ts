/**
 * Offline Storage Tests
 *
 * # Offline-mocking pattern
 *
 * All IndexedDB interactions are provided by the `fake-indexeddb` in-memory
 * shim that is registered in the vitest environment.  No real browser storage
 * is touched.
 *
 * ## Deterministic time control
 *
 * Tests that exercise TTL expiry use `vi.useFakeTimers()` / `vi.runAllTimers()`
 * instead of `setTimeout` + real-clock waits.  This makes the suite
 * completely deterministic and eliminates the ~150 ms flake that occurred when
 * the CI runner was under CPU load.
 *
 * ### Rule for future test authors
 * Never use `await new Promise(resolve => setTimeout(resolve, N))` in this
 * suite.  If you need time to advance, call `vi.advanceTimersByTime(N)` (or
 * `vi.runAllTimers()`) after enabling fake timers with `vi.useFakeTimers()`.
 * Remember to restore real timers in `afterEach` via `vi.useRealTimers()`.
 *
 * ## Coverage guidance
 * Unit-level tests for the same IndexedDB helpers already exist in
 * `frontend/src/lib/offline.test.tsx`.  Tests that would simply duplicate
 * coverage from that file have been intentionally omitted here to avoid
 * redundancy.  This file focuses on the integration behaviour of the storage
 * layer (multi-operation sequences, status transitions, TTL semantics).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initDB,
  saveQuery,
  getQuery,
  deleteQuery,
  clearQueries,
  queueMutation,
  getPendingMutations,
  updateMutationStatus,
  deleteMutation,
  setCache,
  getCache,
  clearCache,
} from '../../src/lib/offline/storage';

describe('Offline Storage', () => {
  beforeEach(async () => {
    // Clear all data before each test for full isolation
    const db = await initDB();
    await db.clear('queries');
    await db.clear('mutations');
    await db.clear('cache');
    await db.clear('settings');
  });

  afterEach(() => {
    // Always restore real timers, even if a test threw
    vi.useRealTimers();
  });

  // ── Query Cache ────────────────────────────────────────────────────────────

  describe('Query Cache', () => {
    it('should save and retrieve query data', async () => {
      const testData = { id: 1, name: 'Test' };
      await saveQuery('test-query', testData);

      const retrieved = await getQuery('test-query');
      expect(retrieved).toEqual(testData);
    });

    it('should return undefined for a key that was never saved', async () => {
      const retrieved = await getQuery('nonexistent-key');
      expect(retrieved).toBeUndefined();
    });

    it('should overwrite existing query data on re-save', async () => {
      await saveQuery('key', { version: 1 });
      await saveQuery('key', { version: 2 });

      const retrieved = await getQuery('key');
      expect(retrieved).toEqual({ version: 2 });
    });

    it('should delete query data', async () => {
      await saveQuery('test-query', { data: 'test' });
      await deleteQuery('test-query');

      const retrieved = await getQuery('test-query');
      expect(retrieved).toBeUndefined();
    });

    it('should clear all queries without affecting other stores', async () => {
      await saveQuery('query1', { data: 'test1' });
      await saveQuery('query2', { data: 'test2' });
      // Also add a mutation so we can verify it is untouched
      await queueMutation({ mutationKey: ['noop'], variables: {} });

      await clearQueries();

      expect(await getQuery('query1')).toBeUndefined();
      expect(await getQuery('query2')).toBeUndefined();

      // Mutations store should be unaffected
      const pending = await getPendingMutations();
      expect(pending).toHaveLength(1);
    });
  });

  // ── Mutation Queue ─────────────────────────────────────────────────────────

  describe('Mutation Queue', () => {
    it('should queue a mutation and return an id matching the expected pattern', async () => {
      const mutationId = await queueMutation({
        mutationKey: ['createUser'],
        variables: { name: 'John' },
      });

      expect(mutationId).toMatch(/^mutation-/);
    });

    it('should persist queued mutation with status "pending"', async () => {
      await queueMutation({
        mutationKey: ['createUser'],
        variables: { name: 'John' },
      });

      const pending = await getPendingMutations();
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('pending');
    });

    it('should queue multiple mutations and retrieve them all', async () => {
      await queueMutation({ mutationKey: ['op1'], variables: { a: 1 } });
      await queueMutation({ mutationKey: ['op2'], variables: { b: 2 } });
      await queueMutation({ mutationKey: ['op3'], variables: { c: 3 } });

      const pending = await getPendingMutations();
      expect(pending).toHaveLength(3);
    });

    it('should update mutation status from pending to syncing', async () => {
      const mutationId = await queueMutation({
        mutationKey: ['createUser'],
        variables: { name: 'John' },
      });

      await updateMutationStatus(mutationId, 'syncing');

      const db = await initDB();
      const mutation = await db.get('mutations', mutationId);
      expect(mutation?.status).toBe('syncing');
    });

    it('should increment retries counter on status update', async () => {
      const mutationId = await queueMutation({
        mutationKey: ['createUser'],
        variables: { name: 'John' },
      });

      await updateMutationStatus(mutationId, 'syncing');

      const db = await initDB();
      const mutation = await db.get('mutations', mutationId);
      expect(mutation?.retries).toBe(1);
    });

    it('should delete a specific mutation by id', async () => {
      const mutationId = await queueMutation({
        mutationKey: ['createUser'],
        variables: { name: 'John' },
      });

      await deleteMutation(mutationId);

      const db = await initDB();
      const mutation = await db.get('mutations', mutationId);
      expect(mutation).toBeUndefined();
    });

    it('should not delete other mutations when deleting one', async () => {
      const id1 = await queueMutation({ mutationKey: ['op1'], variables: {} });
      const id2 = await queueMutation({ mutationKey: ['op2'], variables: {} });

      await deleteMutation(id1);

      const pending = await getPendingMutations();
      expect(pending).toHaveLength(1);
      expect(pending[0].id ?? pending[0].mutationKey).toBeTruthy();
      // Verify id2 is still present
      const db = await initDB();
      expect(await db.get('mutations', id2)).toBeDefined();
    });
  });

  // ── General Cache (with TTL) ───────────────────────────────────────────────

  describe('General Cache', () => {
    it('should set and get cache without TTL', async () => {
      const testData = { value: 'cached' };
      await setCache('test-key', testData);

      const retrieved = await getCache('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should return undefined for a key that was never cached', async () => {
      expect(await getCache('never-set')).toBeUndefined();
    });

    it('should overwrite existing cache entry on re-set', async () => {
      await setCache('k', { v: 1 });
      await setCache('k', { v: 2 });
      expect(await getCache('k')).toEqual({ v: 2 });
    });

    /**
     * TTL expiry — deterministic version
     *
     * `setCache` stores `Date.now() + ttl_ms` as the expiry timestamp.
     * `getCache` compares that against `Date.now()` and returns `undefined`
     * when the entry has expired.
     *
     * We freeze time with `vi.useFakeTimers()` so the test is immune to
     * real-clock jitter.  After saving the entry we advance the fake clock
     * past the TTL, then assert the entry is gone.
     */
    it('should respect TTL — entry available before expiry and absent after', async () => {
      vi.useFakeTimers();
      const TTL_MS = 100;

      await setCache('ttl-key', { value: 'temporary' }, TTL_MS);

      // Entry must be present immediately (0 ms elapsed)
      expect(await getCache('ttl-key')).toBeDefined();

      // Advance time just past the TTL boundary
      vi.advanceTimersByTime(TTL_MS + 1);

      // Entry must now be expired
      expect(await getCache('ttl-key')).toBeUndefined();
    });

    it('should not expire entry before TTL elapses', async () => {
      vi.useFakeTimers();
      const TTL_MS = 500;

      await setCache('long-lived', { v: 42 }, TTL_MS);

      // Advance to just before expiry
      vi.advanceTimersByTime(TTL_MS - 1);

      expect(await getCache('long-lived')).toEqual({ v: 42 });
    });

    it('should clear all cache entries', async () => {
      await setCache('key1', { value: 'cached1' });
      await setCache('key2', { value: 'cached2' });
      await clearCache();

      expect(await getCache('key1')).toBeUndefined();
      expect(await getCache('key2')).toBeUndefined();
    });

    it('should not affect mutation queue when clearing cache', async () => {
      await setCache('tmp', { v: 1 });
      await queueMutation({ mutationKey: ['op'], variables: {} });

      await clearCache();

      expect(await getCache('tmp')).toBeUndefined();
      const pending = await getPendingMutations();
      expect(pending).toHaveLength(1);
    });
  });

  // ── Cross-store isolation ──────────────────────────────────────────────────

  describe('Store isolation', () => {
    it('clearing queries does not affect cache or mutations', async () => {
      await saveQuery('q', { v: 1 });
      await setCache('c', { v: 2 });
      await queueMutation({ mutationKey: ['m'], variables: {} });

      await clearQueries();

      expect(await getQuery('q')).toBeUndefined();
      expect(await getCache('c')).toEqual({ v: 2 });
      expect(await getPendingMutations()).toHaveLength(1);
    });

    it('clearing cache does not affect queries or mutations', async () => {
      await saveQuery('q', { v: 1 });
      await setCache('c', { v: 2 });
      await queueMutation({ mutationKey: ['m'], variables: {} });

      await clearCache();

      expect(await getQuery('q')).toEqual({ v: 1 });
      expect(await getCache('c')).toBeUndefined();
      expect(await getPendingMutations()).toHaveLength(1);
    });
  });
});
