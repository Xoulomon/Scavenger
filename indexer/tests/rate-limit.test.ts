import { RateLimiter } from '../src/rate-limit';

/**
 * In-memory mock Redis client that simulates sorted-set operations
 * used by RateLimiter. Supports the callback-based `redis` v3 API.
 */
function createMockRedisClient() {
  const store = new Map<string, { score: number; member: string }[]>();
  const expiry = new Map<string, number>();

  function zremrangebyscore(
    key: string,
    _min: string,
    max: number,
    cb: (err: Error | null) => void
  ) {
    const entries = store.get(key) || [];
    store.set(
      key,
      entries.filter((e) => e.score > max)
    );
    cb(null);
  }

  function zcard(key: string, cb: (err: Error | null, count: number) => void) {
    const entries = store.get(key) || [];
    cb(null, entries.length);
  }

  function zadd(
    key: string,
    score: number,
    member: string,
    cb: (err: Error | null) => void
  ) {
    const entries = store.get(key) || [];
    entries.push({ score, member });
    store.set(key, entries);
    cb(null);
  }

  function expire(
    key: string,
    _seconds: number,
    cb: (err: Error | null) => void
  ) {
    expiry.set(key, Date.now() + _seconds * 1000);
    cb(null);
  }

  function keys(pattern: string, cb: (err: Error | null, keys: string[]) => void) {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    const matched = Array.from(store.keys()).filter((k) => regex.test(k));
    cb(null, matched);
  }

  function del(...args: any[]) {
    const cb = args[args.length - 1] as (err: Error | null) => void;
    const keysToRemove = args.slice(0, -1) as string[];
    keysToRemove.forEach((k) => {
      store.delete(k);
      expiry.delete(k);
    });
    cb(null);
  }

  function flushdb(cb: (err: Error | null) => void) {
    store.clear();
    expiry.clear();
    cb(null);
  }

  return {
    zremrangebyscore,
    zcard,
    zadd,
    expire,
    keys,
    del,
    flushdb,
    _store: store,
  } as any;
}

describe('RateLimiter', () => {
  let client: ReturnType<typeof createMockRedisClient>;
  let limiter: RateLimiter;

  beforeEach(() => {
    client = createMockRedisClient();
    limiter = new RateLimiter(client);

    limiter.registerTier({
      name: 'free',
      limits: {
        '/api/participants': { windowMs: 60000, maxRequests: 10 },
        '/api/waste': { windowMs: 60000, maxRequests: 20 },
      },
    });

    limiter.registerTier({
      name: 'premium',
      limits: {
        '/api/participants': { windowMs: 60000, maxRequests: 100 },
        '/api/waste': { windowMs: 60000, maxRequests: 200 },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Limit-exceeded behavior ────────────────────────────────────────────────

  describe('limit-exceeded behavior', () => {
    test('should allow requests below the limit', async () => {
      const result = await limiter.checkLimit('user1', '/api/participants', 'free');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    test('should track remaining count correctly across multiple requests', async () => {
      for (let i = 0; i < 5; i++) {
        await limiter.checkLimit('user-track', '/api/participants', 'free');
      }
      const result = await limiter.checkLimit('user-track', '/api/participants', 'free');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    test('should reject the request that exceeds the configured limit', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user2', '/api/participants', 'free');
      }
      const result = await limiter.checkLimit('user2', '/api/participants', 'free');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should return resetTime when limit is exceeded', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user-rt', '/api/participants', 'free');
      }
      const result = await limiter.checkLimit('user-rt', '/api/participants', 'free');
      expect(result.resetTime).toBeGreaterThan(0);
    });

    test('should respect different tier limits', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user3', '/api/participants', 'free');
      }
      const freeResult = await limiter.checkLimit('user3', '/api/participants', 'free');
      expect(freeResult.allowed).toBe(false);

      const premiumResult = await limiter.checkLimit('user3', '/api/participants', 'premium');
      expect(premiumResult.allowed).toBe(true);
    });

    test('should track different endpoints separately', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user6', '/api/participants', 'free');
      }
      const participantsResult = await limiter.checkLimit('user6', '/api/participants', 'free');
      expect(participantsResult.allowed).toBe(false);

      const wasteResult = await limiter.checkLimit('user6', '/api/waste', 'free');
      expect(wasteResult.allowed).toBe(true);
    });
  });

  // ── Window reset ───────────────────────────────────────────────────────────

  describe('window reset', () => {
    test('should expire old entries outside the window', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user-wr', '/api/participants', 'free');
      }
      const blocked = await limiter.checkLimit('user-wr', '/api/participants', 'free');
      expect(blocked.allowed).toBe(false);

      jest.setSystemTime(now + 60001);
      const allowed = await limiter.checkLimit('user-wr', '/api/participants', 'free');
      expect(allowed.allowed).toBe(true);
    });

    test('should allow all requests after full window reset', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user-wr2', '/api/participants', 'free');
      }

      jest.setSystemTime(now + 60001);
      for (let i = 0; i < 10; i++) {
        const result = await limiter.checkLimit('user-wr2', '/api/participants', 'free');
        expect(result.allowed).toBe(true);
      }
    });

    test('should reset using explicit reset method', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user5', '/api/participants', 'free');
      }
      let result = await limiter.checkLimit('user5', '/api/participants', 'free');
      expect(result.allowed).toBe(false);

      await limiter.reset('user5', '/api/participants');
      result = await limiter.checkLimit('user5', '/api/participants', 'free');
      expect(result.allowed).toBe(true);
    });

    test('should reset all endpoints when no endpoint specified', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('user-re', '/api/participants', 'free');
      }
      for (let i = 0; i < 20; i++) {
        await limiter.checkLimit('user-re', '/api/waste', 'free');
      }

      await limiter.reset('user-re');

      const pResult = await limiter.checkLimit('user-re', '/api/participants', 'free');
      expect(pResult.allowed).toBe(true);
      const wResult = await limiter.checkLimit('user-re', '/api/waste', 'free');
      expect(wResult.allowed).toBe(true);
    });
  });

  // ── Per-client isolation ───────────────────────────────────────────────────

  describe('per-client isolation', () => {
    test('client A exhausting its allowance should not affect client B', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('clientA', '/api/participants', 'free');
      }
      const resultA = await limiter.checkLimit('clientA', '/api/participants', 'free');
      expect(resultA.allowed).toBe(false);

      const resultB = await limiter.checkLimit('clientB', '/api/participants', 'free');
      expect(resultB.allowed).toBe(true);
      expect(resultB.remaining).toBe(9);
    });

    test('multiple clients should have independent counters', async () => {
      for (let i = 0; i < 5; i++) {
        await limiter.checkLimit('c1', '/api/waste', 'free');
      }
      for (let i = 0; i < 18; i++) {
        await limiter.checkLimit('c2', '/api/waste', 'free');
      }

      const r1 = await limiter.checkLimit('c1', '/api/waste', 'free');
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(14);

      const r2 = await limiter.checkLimit('c2', '/api/waste', 'free');
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);
    });
  });

  // ── Burst then cooldown ────────────────────────────────────────────────────

  describe('burst then cooldown', () => {
    test('burst of requests hits limit, cooldown restores allowance', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('burst-user', '/api/participants', 'free');
      }
      const burstResult = await limiter.checkLimit('burst-user', '/api/participants', 'free');
      expect(burstResult.allowed).toBe(false);

      jest.setSystemTime(now + 60001);
      const cooldownResult = await limiter.checkLimit('burst-user', '/api/participants', 'free');
      expect(cooldownResult.allowed).toBe(true);
      expect(cooldownResult.remaining).toBe(9);
    });
  });

  // ── Whitelist / Blacklist ──────────────────────────────────────────────────

  describe('whitelist', () => {
    test('should bypass rate limit for whitelisted users', async () => {
      limiter.addToWhitelist('whitelisted-user');
      for (let i = 0; i < 100; i++) {
        const result = await limiter.checkLimit('whitelisted-user', '/api/participants', 'free');
        expect(result.allowed).toBe(true);
      }
    });

    test('should return remaining -1 for whitelisted users', async () => {
      limiter.addToWhitelist('wl-user');
      const result = await limiter.checkLimit('wl-user', '/api/participants', 'free');
      expect(result.remaining).toBe(-1);
    });

    test('should remove from whitelist and enforce limits again', async () => {
      limiter.addToWhitelist('wl-removable');
      limiter.removeFromWhitelist('wl-removable');

      for (let i = 0; i < 10; i++) {
        await limiter.checkLimit('wl-removable', '/api/participants', 'free');
      }
      const result = await limiter.checkLimit('wl-removable', '/api/participants', 'free');
      expect(result.allowed).toBe(false);
    });
  });

  describe('blacklist', () => {
    test('should reject blacklisted users immediately', async () => {
      limiter.addToBlacklist('blacklisted-user');
      const result = await limiter.checkLimit('blacklisted-user', '/api/participants', 'free');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should reject blacklisted users regardless of tier', async () => {
      limiter.addToBlacklist('bl-user');
      const result = await limiter.checkLimit('bl-user', '/api/participants', 'premium');
      expect(result.allowed).toBe(false);
    });

    test('should remove from blacklist and allow requests again', async () => {
      limiter.addToBlacklist('bl-removable');
      limiter.removeFromBlacklist('bl-removable');
      const result = await limiter.checkLimit('bl-removable', '/api/participants', 'free');
      expect(result.allowed).toBe(true);
    });
  });

  // ── Headers ────────────────────────────────────────────────────────────────

  describe('getRateLimitHeaders', () => {
    test('should return correct rate limit headers', async () => {
      const headers = await limiter.getRateLimitHeaders('user4', '/api/participants', 'free');
      expect(headers['X-RateLimit-Limit']).toBe('10');
      expect(headers['X-RateLimit-Remaining']).toBe('9');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
      expect(Number(headers['X-RateLimit-Reset'])).toBeGreaterThan(0);
    });

    test('should return -1 remaining for whitelisted users', async () => {
      limiter.addToWhitelist('wl-headers');
      const headers = await limiter.getRateLimitHeaders('wl-headers', '/api/participants', 'free');
      expect(headers['X-RateLimit-Remaining']).toBe('-1');
    });

    test('should return -1 for unknown tier', async () => {
      const headers = await limiter.getRateLimitHeaders('user', '/api/participants', 'nonexistent');
      expect(headers['X-RateLimit-Limit']).toBe('-1');
      expect(headers['X-RateLimit-Remaining']).toBe('-1');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    test('should allow requests for unknown tier (no config)', async () => {
      const result = await limiter.checkLimit('user', '/api/participants', 'unknown-tier');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1);
    });

    test('should allow requests for unknown endpoint (no config)', async () => {
      const result = await limiter.checkLimit('user', '/api/unknown', 'free');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1);
    });

    test('should handle reset for user with no existing keys', async () => {
      await expect(limiter.reset('nonexistent-user')).resolves.toBeUndefined();
    });

    test('should handle reset for specific endpoint with no existing keys', async () => {
      await expect(limiter.reset('nonexistent', '/api/participants')).resolves.toBeUndefined();
    });
  });
});
