/**
 * Fixture-based unit tests for AnalyticsService.
 *
 * These tests mock the Redis client to make assertions deterministic and
 * independent of a running Redis instance. Fixture data is constructed with
 * known expected outputs so that aggregation results can be cross-checked
 * manually.
 */

import { AnalyticsService, AnalyticsEvent } from '../src/analytics';

// ── Mock Redis Client ──────────────────────────────────────────────────────

interface MockRedisStore {
  hashes: Record<string, Record<string, string>>;
  sortedSets: Record<string, Record<string, number>>;
  strings: Record<string, string>;
  expires: Record<string, number>;
}

function createMockRedisClient(store: MockRedisStore) {
  const callLog: Array<{ method: string; args: unknown[] }> = [];

  const client = {
    hincrby: jest.fn(
      (key: string, field: string, increment: number, cb: (err: Error | null, result?: number) => void) => {
        callLog.push({ method: 'hincrby', args: [key, field, increment] });
        if (!store.hashes[key]) { store.hashes[key] = {}; }
        const current = parseInt(store.hashes[key][field] || '0', 10);
        store.hashes[key][field] = String(current + increment);
        cb(null, current + increment);
      }
    ),
    hget: jest.fn(
      (key: string, field: string, cb: (err: Error | null, result?: string) => void) => {
        callLog.push({ method: 'hget', args: [key, field] });
        const val = store.hashes[key]?.[field] ?? null;
        cb(null, val);
      }
    ),
    zadd: jest.fn(
      (key: string, score: number, member: string, cb: (err: Error | null, result?: number) => void) => {
        callLog.push({ method: 'zadd', args: [key, score, member] });
        if (!store.sortedSets[key]) { store.sortedSets[key] = {}; }
        store.sortedSets[key][member] = score;
        cb(null, 1);
      }
    ),
    expire: jest.fn(
      (key: string, seconds: number, cb: (err: Error | null) => void) => {
        callLog.push({ method: 'expire', args: [key, seconds] });
        store.expires[key] = seconds;
        cb(null);
      }
    ),
    keys: jest.fn(
      (pattern: string, cb: (err: Error | null, result?: string[]) => void) => {
        callLog.push({ method: 'keys', args: [pattern] });
        const prefix = pattern.replace('*', '');
        const matchingKeys = Object.keys(store.hashes).filter((k) => k.startsWith(prefix));
        cb(null, matchingKeys);
      }
    ),
    get: jest.fn(
      (key: string, cb: (err: Error | null, result?: string) => void) => {
        callLog.push({ method: 'get', args: [key] });
        cb(null, store.strings[key] ?? null);
      }
    ),
    set: jest.fn(
      (key: string, value: unknown, cb: (err: Error | null) => void) => {
        callLog.push({ method: 'set', args: [key, value] });
        store.strings[key] = String(value);
        cb(null);
      }
    ),
    incrby: jest.fn(
      (key: string, amount: number, cb: (err: Error | null, result?: number) => void) => {
        callLog.push({ method: 'incrby', args: [key, amount] });
        const current = parseInt(store.strings[key] || '0', 10);
        const newVal = current + amount;
        store.strings[key] = String(newVal);
        cb(null, newVal);
      }
    ),
    flushdb: jest.fn((cb: (err: Error | null) => void) => {
      callLog.push({ method: 'flushdb', args: [] });
      store.hashes = {};
      store.sortedSets = {};
      store.strings = {};
      store.expires = {};
      cb(null);
    }),
  } as unknown as import('redis').RedisClient;

  return { client, callLog, store };
}

function createStore(): MockRedisStore {
  return {
    hashes: {},
    sortedSets: {},
    strings: {},
    expires: {},
  };
}

// ── Fixture Data ───────────────────────────────────────────────────────────

const FIXTURE_EVENTS: AnalyticsEvent[] = [
  { type: 'user', userId: 'u1', action: 'login', metadata: {}, timestamp: 1000 },
  { type: 'user', userId: 'u2', action: 'login', metadata: {}, timestamp: 2000 },
  { type: 'user', userId: 'u1', action: 'logout', metadata: {}, timestamp: 3000 },
  { type: 'contract', userId: 'u1', action: 'submit_waste', metadata: { gasUsed: 5000 }, timestamp: 4000 },
  { type: 'user', userId: 'u3', action: 'login', metadata: {}, timestamp: 5000 },
  { type: 'user', userId: 'u2', action: 'logout', metadata: {}, timestamp: 6000 },
];

// Expected: user:login=3, user:logout=2, contract:submit_waste=1
const EXPECTED_USER_REPORT: Record<string, number> = { login: 3, logout: 2 };
const EXPECTED_CONTRACT_REPORT: Record<string, number> = { submit_waste: 1 };

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AnalyticsService – fixture-driven tests', () => {
  let store: MockRedisStore;
  let service: AnalyticsService;

  beforeEach(() => {
    store = createStore();
    const { client } = createMockRedisClient(store);
    service = new AnalyticsService(client);
  });

  // ── Empty dataset ───────────────────────────────────────────────────────

  describe('empty dataset', () => {
    test('getEventCount returns 0 for unknown action', async () => {
      const count = await service.getEventCount('user', 'login');
      expect(count).toBe(0);
    });

    test('getUsageReport returns empty object when no keys exist', async () => {
      const report = await service.getUsageReport('user');
      expect(report).toEqual({});
    });

    test('getFunnelAnalysis returns steps with zero counts', async () => {
      const funnel = await service.getFunnelAnalysis('user', ['view_home', 'signup']);
      expect(funnel).toHaveLength(2);
      expect(funnel[0].count).toBe(0);
      expect(funnel[0].conversionRate).toBe(100);
      expect(funnel[1].count).toBe(0);
      expect(funnel[1].conversionRate).toBe(100);
    });

    test('exportAnalytics returns empty JSON object', async () => {
      const json = await service.exportAnalytics('user', 'json');
      expect(JSON.parse(json)).toEqual({});
    });

    test('exportAnalytics returns CSV with header only', async () => {
      const csv = await service.exportAnalytics('user', 'csv');
      expect(csv).toBe('action,count');
    });

    test('getCustomMetric returns 0 for unknown metric', async () => {
      const value = await service.getCustomMetric('total_waste');
      expect(value).toBe(0);
    });

    test('getLocalEvents returns empty array initially', () => {
      expect(service.getLocalEvents()).toEqual([]);
    });
  });

  // ── Single record ───────────────────────────────────────────────────────

  describe('single record', () => {
    test('tracking one event increments count to 1', async () => {
      await service.trackUserAction('u1', 'login', {});
      const count = await service.getEventCount('user', 'login');
      expect(count).toBe(1);
    });

    test('single event appears in local events buffer', async () => {
      await service.trackUserAction('u1', 'login', {});
      const events = service.getLocalEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('user');
      expect(events[0].action).toBe('login');
    });

    test('single event is stored in Redis hash', async () => {
      await service.trackUserAction('u1', 'login', {});
      expect(store.hashes['analytics:user:login']?.['count']).toBe('1');
    });

    test('single event is added to timeline sorted set', async () => {
      await service.trackUserAction('u1', 'login', {});
      const timelineKey = 'analytics:timeline:user';
      expect(store.sortedSets[timelineKey]).toBeDefined();
      expect(Object.keys(store.sortedSets[timelineKey])).toHaveLength(1);
    });

    test('single event sets 30-day TTL', async () => {
      await service.trackUserAction('u1', 'login', {});
      expect(store.expires['analytics:user:login']).toBe(86400 * 30);
    });

    test('getUsageReport returns single action', async () => {
      await service.trackUserAction('u1', 'login', {});
      const report = await service.getUsageReport('user');
      expect(report).toEqual({ login: 1 });
    });
  });

  // ── Multiple records ────────────────────────────────────────────────────

  describe('multiple records', () => {
    beforeEach(async () => {
      for (const event of FIXTURE_EVENTS) {
        await service.trackEvent(event);
      }
    });

    test('total events tracked matches fixture count', () => {
      expect(service.getLocalEvents()).toHaveLength(FIXTURE_EVENTS.length);
    });

    test('usage report matches manually calculated expected values', async () => {
      const report = await service.getUsageReport('user');
      // Manually verified: u1→login, u2→login, u3→login = 3; u1→logout, u2→logout = 2
      expect(report).toEqual(EXPECTED_USER_REPORT);
    });

    test('contract usage report matches expected', async () => {
      const report = await service.getUsageReport('contract');
      expect(report).toEqual(EXPECTED_CONTRACT_REPORT);
    });

    test('event counts are correct per action', async () => {
      expect(await service.getEventCount('user', 'login')).toBe(3);
      expect(await service.getEventCount('user', 'logout')).toBe(2);
      expect(await service.getEventCount('contract', 'submit_waste')).toBe(1);
    });

    test('timeline sorted set contains all events of same type', () => {
      const userTimeline = store.sortedSets['analytics:timeline:user'];
      expect(Object.keys(userTimeline)).toHaveLength(5); // 5 user events
    });
  });

  // ── Duplicate timestamps ────────────────────────────────────────────────

  describe('duplicate timestamps', () => {
    test('events with same timestamp are tracked independently', async () => {
      const ts = 1000;
      await service.trackEvent({ type: 'user', userId: 'u1', action: 'login', metadata: {}, timestamp: ts });
      await service.trackEvent({ type: 'user', userId: 'u2', action: 'login', metadata: {}, timestamp: ts });
      await service.trackEvent({ type: 'user', userId: 'u3', action: 'login', metadata: {}, timestamp: ts });

      const count = await service.getEventCount('user', 'login');
      expect(count).toBe(3);
    });

    test('duplicate timestamps create separate sorted set entries', async () => {
      const ts = 999;
      await service.trackEvent({ type: 'user', userId: 'u1', action: 'login', metadata: {}, timestamp: ts });
      await service.trackEvent({ type: 'user', userId: 'u2', action: 'login', metadata: {}, timestamp: ts });

      const timeline = store.sortedSets['analytics:timeline:user'];
      // Both entries have same score but different member strings
      expect(Object.keys(timeline)).toHaveLength(2);
    });
  });

  // ── Normal aggregation ──────────────────────────────────────────────────

  describe('normal aggregation', () => {
    test('usage report aggregates correctly across multiple users', async () => {
      await service.trackUserAction('u1', 'login', {});
      await service.trackUserAction('u2', 'login', {});
      await service.trackUserAction('u3', 'login', {});
      await service.trackUserAction('u1', 'logout', {});

      const report = await service.getUsageReport('user');
      // Manually verified: login=3, logout=1
      expect(report['login']).toBe(3);
      expect(report['logout']).toBe(1);
    });

    test('funnel analysis computes correct conversion rates', async () => {
      // Funnel: view_home → view_signup → signup
      // Counts: 10 → 5 → 2
      await service.setCustomMetric('_test_funnel_view_home', 10);
      await service.setCustomMetric('_test_funnel_view_signup', 5);
      await service.setCustomMetric('_test_funnel_signup', 2);

      // We'll mock getEventCount behavior by pre-populating hashes
      store.hashes['analytics:user:view_home'] = { count: '10' };
      store.hashes['analytics:user:view_signup'] = { count: '5' };
      store.hashes['analytics:user:signup'] = { count: '2' };

      const funnel = await service.getFunnelAnalysis('user', ['view_home', 'view_signup', 'signup']);

      expect(funnel).toHaveLength(3);
      expect(funnel[0]).toEqual({ name: 'view_home', count: 10, conversionRate: 100 });
      expect(funnel[1]).toEqual({ name: 'view_signup', count: 5, conversionRate: 50 });
      expect(funnel[2]).toEqual({ name: 'signup', count: 2, conversionRate: 40 });
    });

    test('exportAnalytics JSON format matches usage report', async () => {
      await service.trackUserAction('u1', 'login', {});
      await service.trackUserAction('u1', 'logout', {});

      const json = await service.exportAnalytics('user', 'json');
      const data = JSON.parse(json);
      expect(data).toEqual({ login: 1, logout: 1 });
    });

    test('exportAnalytics CSV format includes header and rows', async () => {
      await service.trackUserAction('u1', 'login', {});
      await service.trackUserAction('u1', 'logout', {});

      const csv = await service.exportAnalytics('user', 'csv');
      const lines = csv.split('\n');
      expect(lines[0]).toBe('action,count');
      expect(lines.length).toBe(3); // header + 2 rows
    });
  });

  // ── Boundary / zero-value cases ─────────────────────────────────────────

  describe('boundary and zero-value cases', () => {
    test('incrementCustomMetric with amount 0 does not change value', async () => {
      await service.setCustomMetric('counter', 5);
      const result = await service.incrementCustomMetric('counter', 0);
      expect(result).toBe(5);
    });

    test('incrementCustomMetric defaults to amount 1', async () => {
      await service.setCustomMetric('counter', 10);
      const result = await service.incrementCustomMetric('counter');
      expect(result).toBe(11);
    });

    test('getCustomMetric after set returns correct value', async () => {
      await service.setCustomMetric('waste_total', 42);
      expect(await service.getCustomMetric('waste_total')).toBe(42);
    });

    test('multiple setCustomMetric calls overwrite value', async () => {
      await service.setCustomMetric('key', 1);
      await service.setCustomMetric('key', 2);
      expect(await service.getCustomMetric('key')).toBe(2);
    });

    test('clearLocalEvents removes all buffered events', async () => {
      await service.trackUserAction('u1', 'login', {});
      await service.trackUserAction('u2', 'login', {});
      expect(service.getLocalEvents()).toHaveLength(2);
      service.clearLocalEvents();
      expect(service.getLocalEvents()).toHaveLength(0);
    });

    test('funnel with single step returns 100% conversion', async () => {
      store.hashes['analytics:user:login'] = { count: '5' };
      const funnel = await service.getFunnelAnalysis('user', ['login']);
      expect(funnel).toHaveLength(1);
      expect(funnel[0].conversionRate).toBe(100);
    });

    test('funnel with zero first step has 100% conversion for second step', async () => {
      store.hashes['analytics:user:login'] = { count: '0' };
      store.hashes['analytics:user:signup'] = { count: '0' };
      const funnel = await service.getFunnelAnalysis('user', ['login', 'signup']);
      expect(funnel[0].conversionRate).toBe(100);
      expect(funnel[1].conversionRate).toBe(100);
    });

    test('trackContractInteraction stores correct metadata', async () => {
      await service.trackContractInteraction('u1', 'register_participant', 5000, true);
      const events = service.getLocalEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('contract');
      expect(events[0].metadata).toEqual({ gasUsed: 5000, success: true });
    });
  });

  // ── Manual cross-verification ───────────────────────────────────────────

  describe('manual cross-verification of aggregation results', () => {
    test('login count matches manually counted fixture data', async () => {
      // From FIXTURE_EVENTS: u1→login (ts=1000), u2→login (ts=2000), u3→login (ts=5000)
      // Manual count: 3 login events
      for (const event of FIXTURE_EVENTS) {
        await service.trackEvent(event);
      }
      const count = await service.getEventCount('user', 'login');
      expect(count).toBe(3);
    });

    test('logout count matches manually counted fixture data', async () => {
      // From FIXTURE_EVENTS: u1→logout (ts=3000), u2→logout (ts=6000)
      // Manual count: 2 logout events
      for (const event of FIXTURE_EVENTS) {
        await service.trackEvent(event);
      }
      const count = await service.getEventCount('user', 'logout');
      expect(count).toBe(2);
    });

    test('total user events matches fixture length', async () => {
      // FIXTURE_EVENTS has 6 total events, 5 of type 'user'
      for (const event of FIXTURE_EVENTS) {
        await service.trackEvent(event);
      }
      const userReport = await service.getUsageReport('user');
      const totalUserActions = Object.values(userReport).reduce((sum, n) => sum + n, 0);
      expect(totalUserActions).toBe(5);
    });
  });
});
