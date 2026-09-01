import { RedisCache } from './redis-client';

export class CacheManager {
  private cache: RedisCache;

  constructor(cache: RedisCache) {
    this.cache = cache;
  }

  async getParticipant<T>(address: string): Promise<T | null> {
    return this.cache.get<T>(`participant:${address}`);
  }

  async setParticipant<T>(address: string, data: T): Promise<void> {
    return this.cache.set(`participant:${address}`, data, 'participant');
  }

  async invalidateParticipant(address: string) {
    return this.cache.del(`participant:${address}`);
  }

  async getWaste<T>(wasteId: string): Promise<T | null> {
    return this.cache.get<T>(`waste:${wasteId}`);
  }

  async setWaste<T>(wasteId: string, data: T): Promise<void> {
    return this.cache.set(`waste:${wasteId}`, data, 'waste');
  }

  async invalidateWaste(wasteId: string) {
    return this.cache.del(`waste:${wasteId}`);
  }

  async getIncentive<T>(incentiveId: string): Promise<T | null> {
    return this.cache.get<T>(`incentive:${incentiveId}`);
  }

  async setIncentive<T>(incentiveId: string, data: T): Promise<void> {
    return this.cache.set(`incentive:${incentiveId}`, data, 'incentive');
  }

  async invalidateIncentive(incentiveId: string) {
    return this.cache.del(`incentive:${incentiveId}`);
  }

  async getMetrics<T>(): Promise<T | null> {
    return this.cache.get<T>('metrics:global');
  }

  async setMetrics<T>(data: T): Promise<void> {
    return this.cache.set('metrics:global', data, 'metrics');
  }

  async invalidateMetrics() {
    return this.cache.del('metrics:global');
  }

  async invalidateAll() {
    return this.cache.invalidatePattern('*');
  }

  getStats() {
    return this.cache.getStats();
  }
}
