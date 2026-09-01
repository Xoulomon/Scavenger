/**
 * Offline Storage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
    // Clear all data before each test
    const db = await initDB();
    await db.clear('queries');
    await db.clear('mutations');
    await db.clear('cache');
    await db.clear('settings');
  });

  describe('Query Cache', () => {
    it('should save and retrieve query data', async () => {
      const testData = { id: 1, name: 'Test' };
      await saveQuery('test-query', testData);

      const retrieved = await getQuery('test-query');
      expect(retrieved).toEqual(testData);
    });

    it('should delete query data', async () => {
      await saveQuery('test-query', { data: 'test' });
      await deleteQuery('test-query');

      const retrieved = await getQuery('test-query');
      expect(retrieved).toBeUndefined();
    });

    it('should clear all queries', async () => {
      await saveQuery('query1', { data: 'test1' });
      await saveQuery('query2', { data: 'test2' });
      await clearQueries();

      const query1 = await getQuery('query1');
      const query2 = await getQuery('query2');
      expect(query1).toBeUndefined();
      expect(query2).toBeUndefined();
    });
  });

  describe('Mutation Queue', () => {
    it('should queue mutation', async () => {
      const mutationId = await queueMutation({
        mutationKey: ['createUser'],
        variables: { name: 'John' },
      });

      expect(mutationId).toMatch(/^mutation-/);
    });

    it('should get pending mutations', async () => {
      await queueMutation({
        mutationKey: ['createUser'],
        variables: { name: 'John' },
      });

      const pending = await getPendingMutations();
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('pending');
    });

    it('should update mutation status', async () => {
      const mutationId = await queueMutation({
        mutationKey: ['createUser'],
        variables: { name: 'John' },
      });

      await updateMutationStatus(mutationId, 'syncing');

      const db = await initDB();
      const mutation = await db.get('mutations', mutationId);
      expect(mutation?.status).toBe('syncing');
      expect(mutation?.retries).toBe(1);
    });

    it('should delete mutation', async () => {
      const mutationId = await queueMutation({
        mutationKey: ['createUser'],
        variables: { name: 'John' },
      });

      await deleteMutation(mutationId);

      const db = await initDB();
      const mutation = await db.get('mutations', mutationId);
      expect(mutation).toBeUndefined();
    });
  });

  describe('General Cache', () => {
    it('should set and get cache', async () => {
      const testData = { value: 'cached' };
      await setCache('test-key', testData);

      const retrieved = await getCache('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should respect TTL', async () => {
      await setCache('test-key', { value: 'cached' }, 100); // 100ms TTL

      // Should be available immediately
      let retrieved = await getCache('test-key');
      expect(retrieved).toBeDefined();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      retrieved = await getCache('test-key');
      expect(retrieved).toBeUndefined();
    });

    it('should clear cache', async () => {
      await setCache('key1', { value: 'cached1' });
      await setCache('key2', { value: 'cached2' });
      await clearCache();

      const key1 = await getCache('key1');
      const key2 = await getCache('key2');
      expect(key1).toBeUndefined();
      expect(key2).toBeUndefined();
    });
  });
});
