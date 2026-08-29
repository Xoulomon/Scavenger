import { RedisCache } from './redis-client';

export class CacheManager {
  private cache: RedisCache;

  constructor(cache: RedisCache) {
    this.cache = cache;
  }

  async getParticipant(address: string) {
    return this.cache.get(`participant:${address}`);
  }

  async setParticipant(address: string, data: Record<string, unknown>) {
    return this.cache.set(`participant:${address}`, data, 'participant');
  }

  async invalidateParticipant(address: string) {
    return this.cache.del(`participant:${address}`);
  }

  async getWaste(wasteId: string) {
    return this.cache.get(`waste:${wasteId}`);
  }

  async setWaste(wasteId: string, data: Record<string, unknown>) {
    return this.cache.set(`waste:${wasteId}`, data, 'waste');
  }

  async invalidateWaste(wasteId: string) {
    return this.cache.del(`waste:${wasteId}`);
  }

  async getIncentive(incentiveId: string) {
    return this.cache.get(`incentive:${incentiveId}`);
  }

  async setIncentive(incentiveId: string, data: Record<string, unknown>) {
    return this.cache.set(`incentive:${incentiveId}`, data, 'incentive');
  }

  async invalidateIncentive(incentiveId: string) {
    return this.cache.del(`incentive:${incentiveId}`);
  }

  async getMetrics() {
    return this.cache.get('metrics:global');
  }

  async setMetrics(data: Record<string, unknown>) {
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
