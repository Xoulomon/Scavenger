import { AnalyticsService } from '../src/analytics'
import Redis from 'redis'

describe('AnalyticsService', () => {
  let client: Redis.RedisClient
  let analytics: AnalyticsService

  beforeEach(() => {
    client = Redis.createClient({
      host: 'localhost',
      port: 6379
    })
    analytics = new AnalyticsService(client)
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      client.flushdb(() => resolve())
    })
  })

  test('should track user action', async () => {
    await analytics.trackUserAction('user1', 'login', { ip: '127.0.0.1' })
    const count = await analytics.getEventCount('user', 'login')
    expect(count).toBe(1)
  })

  test('should track contract interaction', async () => {
    await analytics.trackContractInteraction('user1', 'register_participant', 5000, true)
    const count = await analytics.getEventCount('contract', 'register_participant')
    expect(count).toBe(1)
  })

  test('should generate usage report', async () => {
    await analytics.trackUserAction('user1', 'login', {})
    await analytics.trackUserAction('user2', 'login', {})
    await analytics.trackUserAction('user1', 'logout', {})

    const report = await analytics.getUsageReport('user')
    expect(report['login']).toBe(2)
    expect(report['logout']).toBe(1)
  })

  test('should perform funnel analysis', async () => {
    await analytics.trackUserAction('user1', 'view_home', {})
    await analytics.trackUserAction('user1', 'view_signup', {})
    await analytics.trackUserAction('user1', 'signup', {})
    await analytics.trackUserAction('user2', 'view_home', {})

    const funnel = await analytics.getFunnelAnalysis('user', ['view_home', 'view_signup', 'signup'])
    expect(funnel[0].name).toBe('view_home')
    expect(funnel[0].count).toBe(2)
    expect(funnel[1].conversionRate).toBeLessThan(100)
  })

  test('should export analytics as JSON', async () => {
    await analytics.trackUserAction('user1', 'action1', {})
    await analytics.trackUserAction('user1', 'action2', {})

    const json = await analytics.exportAnalytics('user', 'json')
    const data = JSON.parse(json)
    expect(data['action1']).toBe(1)
    expect(data['action2']).toBe(1)
  })

  test('should export analytics as CSV', async () => {
    await analytics.trackUserAction('user1', 'action1', {})
    await analytics.trackUserAction('user1', 'action2', {})

    const csv = await analytics.exportAnalytics('user', 'csv')
    expect(csv).toContain('action,count')
    expect(csv).toContain('action1,1')
  })

  test('should manage custom metrics', async () => {
    await analytics.setCustomMetric('total_waste', 1000)
    let value = await analytics.getCustomMetric('total_waste')
    expect(value).toBe(1000)

    await analytics.incrementCustomMetric('total_waste', 500)
    value = await analytics.getCustomMetric('total_waste')
    expect(value).toBe(1500)
  })

  test('should track local events', async () => {
    await analytics.trackUserAction('user1', 'action1', { data: 'test' })
    const events = analytics.getLocalEvents()
    expect(events.length).toBe(1)
    expect(events[0].action).toBe('action1')
  })

  test('should clear local events', async () => {
    await analytics.trackUserAction('user1', 'action1', {})
    analytics.clearLocalEvents()
    const events = analytics.getLocalEvents()
    expect(events.length).toBe(0)
  })

  test('should handle multiple event types', async () => {
    await analytics.trackUserAction('user1', 'login', {})
    await analytics.trackContractInteraction('user1', 'submit_waste', 3000, true)

    const userCount = await analytics.getEventCount('user', 'login')
    const contractCount = await analytics.getEventCount('contract', 'submit_waste')

    expect(userCount).toBe(1)
    expect(contractCount).toBe(1)
  })
})
