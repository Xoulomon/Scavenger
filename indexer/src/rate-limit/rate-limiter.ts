import Redis from 'redis';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface UserTier {
  name: string;
  limits: Record<string, RateLimitConfig>;
}

export class RateLimiter {
  private client: Redis.RedisClient;
  private tiers: Map<string, UserTier>;
  private whitelist: Set<string>;
  private blacklist: Set<string>;

  constructor(redisClient: Redis.RedisClient) {
    this.client = redisClient;
    this.tiers = new Map();
    this.whitelist = new Set();
    this.blacklist = new Set();
  }

  registerTier(tier: UserTier): void {
    this.tiers.set(tier.name, tier);
  }

  addToWhitelist(identifier: string): void {
    this.whitelist.add(identifier);
  }

  removeFromWhitelist(identifier: string): void {
    this.whitelist.delete(identifier);
  }

  addToBlacklist(identifier: string): void {
    this.blacklist.add(identifier);
  }

  removeFromBlacklist(identifier: string): void {
    this.blacklist.delete(identifier);
  }

  async checkLimit(
    identifier: string,
    endpoint: string,
    tier: string = 'default'
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    if (this.blacklist.has(identifier)) {
      return { allowed: false, remaining: 0, resetTime: 0 };
    }

    if (this.whitelist.has(identifier)) {
      return { allowed: true, remaining: -1, resetTime: 0 };
    }

    const tierConfig = this.tiers.get(tier);
    if (!tierConfig) {
      return { allowed: true, remaining: -1, resetTime: 0 };
    }

    const endpointConfig = tierConfig.limits[endpoint];
    if (!endpointConfig) {
      return { allowed: true, remaining: -1, resetTime: 0 };
    }

    const key = `ratelimit:${identifier}:${endpoint}`;
    const now = Date.now();
    const windowStart = now - endpointConfig.windowMs;

    return new Promise((resolve, reject) => {
      this.client.zremrangebyscore(key, '-inf', windowStart, (err) => {
        if (err) {reject(err);}

        this.client.zcard(key, (err, count) => {
          if (err) {reject(err);}

          const remaining = Math.max(0, endpointConfig.maxRequests - (count || 0));
          const allowed = remaining > 0;

          if (allowed) {
            this.client.zadd(key, now, `${now}:${Math.random()}`, (err) => {
              if (err) {reject(err);}
              this.client.expire(key, Math.ceil(endpointConfig.windowMs / 1000), (err) => {
                if (err) {reject(err);}
                resolve({
                  allowed: true,
                  remaining: remaining - 1,
                  resetTime: now + endpointConfig.windowMs,
                });
              });
            });
          } else {
            resolve({
              allowed: false,
              remaining: 0,
              resetTime: now + endpointConfig.windowMs,
            });
          }
        });
      });
    });
  }

  async getRateLimitHeaders(
    identifier: string,
    endpoint: string,
    tier: string = 'default'
  ): Promise<Record<string, string>> {
    const result = await this.checkLimit(identifier, endpoint, tier);
    return {
      'X-RateLimit-Limit': String(this.tiers.get(tier)?.limits[endpoint]?.maxRequests || -1),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
    };
  }

  async reset(identifier: string, endpoint?: string): Promise<void> {
    const pattern = endpoint ? `ratelimit:${identifier}:${endpoint}` : `ratelimit:${identifier}:*`;
    return new Promise((resolve, reject) => {
      this.client.keys(pattern, (err, keys) => {
        if (err) {reject(err);}
        if (keys.length === 0) {
          resolve();
          return;
        }
        this.client.del(...keys, (err) => {
          if (err) {reject(err);}
          resolve();
        });
      });
    });
  }
}
