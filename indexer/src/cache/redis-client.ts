import Redis from 'redis';

export interface CacheConfig {
  host: string;
  port: number;
  ttl: Record<string, number>;
}

export class RedisCache {
  private client: Redis.RedisClient;
  private ttl: Record<string, number>;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  constructor(config: CacheConfig) {
    this.client = Redis.createClient({
      host: config.host,
      port: config.port,
    });
    this.ttl = config.ttl;

    this.client.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.on('ready', () => resolve());
      this.client.on('error', reject);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, data) => {
        if (err) reject(err);
        if (data) {
          this.stats.hits++;
          resolve(JSON.parse(data));
        } else {
          this.stats.misses++;
          resolve(null);
        }
      });
    });
  }

  async set<T>(key: string, value: T, type?: string): Promise<void> {
    const ttl = type ? this.ttl[type] || 3600 : 3600;
    return new Promise((resolve, reject) => {
      this.client.setex(key, ttl, JSON.stringify(value), (err) => {
        if (err) reject(err);
        this.stats.sets++;
        resolve();
      });
    });
  }

  async del(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err) => {
        if (err) reject(err);
        this.stats.deletes++;
        resolve();
      });
    });
  }

  async invalidatePattern(pattern: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.keys(pattern, (err, keys) => {
        if (err) reject(err);
        if (keys.length === 0) {
          resolve();
          return;
        }
        this.client.del(...keys, (err) => {
          if (err) reject(err);
          this.stats.deletes += keys.length;
          resolve();
        });
      });
    });
  }

  async warmCache<T>(key: string, loader: () => Promise<T>, type?: string): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const data = await loader();
    await this.set(key, data, type);
    return data;
  }

  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.client.quit(() => resolve());
    });
  }
}
