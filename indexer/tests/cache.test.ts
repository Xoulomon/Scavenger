import { RedisCache, CacheManager } from '../src/cache'

describe('RedisCache', () => {
  let cache: RedisCache

  beforeEach(() => {
    cache = new RedisCache({
      host: 'localhost',
      port: 6379,
      ttl: {
        participant: 3600,
        waste: 1800,
        incentive: 3600,
        metrics: 300
      }
    })
  })

  test('should set and get value', async () => {
    const key = 'test:key'
    const value = { id: 1, name: 'test' }
    await cache.set(key, value)
    const result = await cache.get(key)
    expect(result).toEqual(value)
  })

  test('should return null for non-existent key', async () => {
    const result = await cache.get('non:existent')
    expect(result).toBeNull()
  })

  test('should delete key', async () => {
    const key = 'test:delete'
    await cache.set(key, { data: 'test' })
    await cache.del(key)
    const result = await cache.get(key)
    expect(result).toBeNull()
  })

  test('should track cache statistics', async () => {
    await cache.set('stat:test', { value: 1 })
    await cache.get('stat:test')
    await cache.get('stat:test')
    await cache.get('non:existent')

    const stats = cache.getStats()
    expect(stats.hits).toBeGreaterThan(0)
    expect(stats.misses).toBeGreaterThan(0)
    expect(stats.sets).toBeGreaterThan(0)
  })

  test('should warm cache with loader', async () => {
    const loader = jest.fn(async () => ({ loaded: true }))
    const result = await cache.warmCache('warm:test', loader, 'participant')
    expect(result).toEqual({ loaded: true })
    expect(loader).toHaveBeenCalledTimes(1)

    const cached = await cache.warmCache('warm:test', loader, 'participant')
    expect(cached).toEqual({ loaded: true })
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('CacheManager', () => {
  let cache: RedisCache
  let manager: CacheManager

  beforeEach(() => {
    cache = new RedisCache({
      host: 'localhost',
      port: 6379,
      ttl: {
        participant: 3600,
        waste: 1800,
        incentive: 3600,
        metrics: 300
      }
    })
    manager = new CacheManager(cache)
  })

  test('should manage participant cache', async () => {
    const address = 'GTEST123'
    const data = { address, role: 'recycler' }
    await manager.setParticipant(address, data)
    const result = await manager.getParticipant(address)
    expect(result).toEqual(data)
  })

  test('should manage waste cache', async () => {
    const wasteId = 'waste:1'
    const data = { id: wasteId, weight: 100 }
    await manager.setWaste(wasteId, data)
    const result = await manager.getWaste(wasteId)
    expect(result).toEqual(data)
  })

  test('should manage incentive cache', async () => {
    const incentiveId = 'incentive:1'
    const data = { id: incentiveId, reward: 50 }
    await manager.setIncentive(incentiveId, data)
    const result = await manager.getIncentive(incentiveId)
    expect(result).toEqual(data)
  })

  test('should invalidate participant cache', async () => {
    const address = 'GTEST123'
    await manager.setParticipant(address, { address })
    await manager.invalidateParticipant(address)
    const result = await manager.getParticipant(address)
    expect(result).toBeNull()
  })

  test('should manage metrics cache', async () => {
    const metrics = { totalWaste: 1000, totalTokens: 5000 }
    await manager.setMetrics(metrics)
    const result = await manager.getMetrics()
    expect(result).toEqual(metrics)
  })
})
