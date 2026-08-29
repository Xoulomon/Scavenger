import Redis from 'redis';

export interface AnalyticsEvent {
  type: string;
  userId: string;
  action: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

export interface FunnelStep {
  name: string;
  count: number;
  conversionRate: number;
}

export class AnalyticsService {
  private client: Redis.RedisClient;
  private events: AnalyticsEvent[] = [];

  constructor(redisClient: Redis.RedisClient) {
    this.client = redisClient;
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    this.events.push(event);

    return new Promise((resolve, reject) => {
      const key = `analytics:${event.type}:${event.action}`;
      this.client.hincrby(key, 'count', 1, (err) => {
        if (err) {reject(err);}

        this.client.zadd(
          `analytics:timeline:${event.type}`,
          event.timestamp,
          JSON.stringify(event),
          (err) => {
            if (err) {reject(err);}
            this.client.expire(key, 86400 * 30, (err) => {
              if (err) {reject(err);}
              resolve();
            });
          }
        );
      });
    });
  }

  async trackContractInteraction(
    userId: string,
    method: string,
    gasUsed: number,
    success: boolean
  ): Promise<void> {
    const event: AnalyticsEvent = {
      type: 'contract',
      userId,
      action: method,
      metadata: { gasUsed, success },
      timestamp: Date.now(),
    };
    return this.trackEvent(event);
  }

  async trackUserAction(userId: string, action: string, metadata: Record<string, unknown>): Promise<void> {
    const event: AnalyticsEvent = {
      type: 'user',
      userId,
      action,
      metadata,
      timestamp: Date.now(),
    };
    return this.trackEvent(event);
  }

  async getEventCount(type: string, action: string, _hours: number = 24): Promise<number> {
    return new Promise((resolve, reject) => {
      const key = `analytics:${type}:${action}`;
      this.client.hget(key, 'count', (err, count) => {
        if (err) {reject(err);}
        resolve(parseInt(count || '0', 10));
      });
    });
  }

  async getUsageReport(type: string, _hours: number = 24): Promise<Record<string, number>> {
    return new Promise((resolve, reject) => {
      const pattern = `analytics:${type}:*`;
      this.client.keys(pattern, (err, keys) => {
        if (err) {reject(err);}

        const report: Record<string, number> = {};
        let processed = 0;

        if (!keys || keys.length === 0) {
          resolve(report);
          return;
        }

        keys.forEach((key) => {
          this.client.hget(key, 'count', (err, count) => {
            if (!err && count) {
              const action = key.split(':')[2];
              report[action] = parseInt(count, 10);
            }
            processed++;
            if (processed === keys.length) {
              resolve(report);
            }
          });
        });
      });
    });
  }

  async getFunnelAnalysis(
    type: string,
    steps: string[],
    hours: number = 24
  ): Promise<FunnelStep[]> {

    const result: FunnelStep[] = [];
    let previousCount = 0;

    for (const step of steps) {
      const count = await this.getEventCount(type, step, hours);
      const conversionRate = previousCount > 0 ? (count / previousCount) * 100 : 100;

      result.push({
        name: step,
        count,
        conversionRate,
      });

      previousCount = count;
    }

    return result;
  }

  async exportAnalytics(type: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    const report = await this.getUsageReport(type);

    if (format === 'csv') {
      const rows = ['action,count'];
      for (const [action, count] of Object.entries(report)) {
        rows.push(`${action},${count}`);
      }
      return rows.join('\n');
    }

    return JSON.stringify(report, null, 2);
  }

  async getCustomMetric(metricName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.client.get(`metric:${metricName}`, (err, value) => {
        if (err) {reject(err);}
        resolve(parseInt(value || '0', 10));
      });
    });
  }

  async setCustomMetric(metricName: string, value: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.set(`metric:${metricName}`, String(value), (err) => {
        if (err) {reject(err);}
        resolve();
      });
    });
  }

  async incrementCustomMetric(metricName: string, amount: number = 1): Promise<number> {
    return new Promise((resolve, reject) => {
      this.client.incrby(`metric:${metricName}`, amount, (err, value) => {
        if (err) {reject(err);}
        resolve(value || 0);
      });
    });
  }

  getLocalEvents(): AnalyticsEvent[] {
    return this.events;
  }

  clearLocalEvents(): void {
    this.events = [];
  }
}
