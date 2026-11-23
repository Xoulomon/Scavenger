import { createApiServer } from '../src/api/server'

describe('API Server', () => {
  let api: ReturnType<typeof createApiServer>

  beforeAll(async () => {
    api = createApiServer({ port: 0, host: '127.0.0.1' })
    await api.start()
  })

  afterAll(async () => {
    await api.stop()
  })

  it('health endpoint returns ok', async () => {
    const res = await fetch('http://127.0.0.1:3001/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('metrics endpoint returns metrics object', async () => {
    const res = await fetch('http://127.0.0.1:3001/metrics')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('eventsProcessed')
    expect(body).toHaveProperty('eventsFailed')
    expect(body).toHaveProperty('startTime')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await fetch('http://127.0.0.1:3001/unknown')
    expect(res.status).toBe(404)
  })

  it('events stream endpoint returns SSE headers', async () => {
    const res = await fetch('http://127.0.0.1:3001/events/stream')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream')
  })

  it('replay endpoint returns 405 for GET', async () => {
    const res = await fetch('http://127.0.0.1:3001/replay')
    expect(res.status).toBe(405)
  })

  it('replay endpoint returns 400 without body', async () => {
    const res = await fetch('http://127.0.0.1:3001/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    expect(res.status).toBe(400)
  })

  it('broadcastEvent adds event to SSE clients', () => {
    const event = { type: 'test', data: 'hello' }
    expect(() => api.broadcastEvent(event)).not.toThrow()
  })
})
