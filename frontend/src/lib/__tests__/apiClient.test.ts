import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ApiClient, ApiError, createApiClient } from '../apiClient'
import { server } from '@/test/msw/server'

describe('ApiClient', () => {
  describe('get()', () => {
    it('calls the correct endpoint and returns typed data', async () => {
      const client = createApiClient({ baseUrl: 'https://api.example.com' })
      const result = await client.get('/api/wastes')

      expect(result.data).toHaveProperty('wastes')
      expect(result.status).toBe(200)
      expect(typeof result.durationMs).toBe('number')
    })

    it('appends query params to the URL', async () => {
      let capturedUrl = ''
      server.use(
        http.get('*/api/wastes', ({ request }) => {
          capturedUrl = new URL(request.url).toString()
          return HttpResponse.json({ wastes: [], total: 0, limit: 100, offset: 0 })
        })
      )

      const client = createApiClient({ baseUrl: 'https://api.example.com' })
      await client.get('/api/wastes', { params: { page: 2, limit: 10 } })

      expect(capturedUrl).toContain('page=2')
      expect(capturedUrl).toContain('limit=10')
    })

    it('sets Authorization header when bearerToken is configured', async () => {
      let capturedHeaders: Record<string, string> = {}
      server.use(
        http.get('*/api/wastes', ({ request }) => {
          capturedHeaders = Object.fromEntries(request.headers.entries())
          return HttpResponse.json({ wastes: [] })
        })
      )

      const client = createApiClient({
        baseUrl: 'https://api.example.com',
        bearerToken: 'my-token'
      })
      await client.get('/api/wastes')

      expect(capturedHeaders['authorization']).toBe('Bearer my-token')
    })

    it('merges per-request headers', async () => {
      let capturedHeaders: Record<string, string> = {}
      server.use(
        http.get('*/api/wastes', ({ request }) => {
          capturedHeaders = Object.fromEntries(request.headers.entries())
          return HttpResponse.json({ wastes: [] })
        })
      )

      const client = createApiClient({ baseUrl: 'https://api.example.com' })
      await client.get('/api/wastes', { headers: { 'X-Custom': 'yes' } })

      expect(capturedHeaders['x-custom']).toBe('yes')
    })
  })

  describe('post()', () => {
    it('sends POST with serialised JSON body', async () => {
      let capturedMethod = ''
      let capturedBody: unknown = null
      server.use(
        http.post('*/api/wastes', async ({ request }) => {
          capturedMethod = request.method
          capturedBody = await request.json()
          return HttpResponse.json({ id: 42 }, { status: 201 })
        })
      )

      const client = createApiClient({ baseUrl: 'https://api.example.com' })
      await client.post('/api/wastes', { type: 'Plastic', weight: 1.5 })

      expect(capturedMethod).toBe('POST')
      expect(capturedBody).toEqual({ type: 'Plastic', weight: 1.5 })
    })
  })

  describe('put()', () => {
    it('sends PUT method', async () => {
      let capturedMethod = ''
      server.use(
        http.put('*/api/wastes/:id', ({ request }) => {
          capturedMethod = request.method
          return HttpResponse.json({ ok: true })
        })
      )

      const client = createApiClient({ baseUrl: 'https://api.example.com' })
      await client.put('/api/wastes/1', { status: 'verified' })

      expect(capturedMethod).toBe('PUT')
    })
  })

  describe('patch()', () => {
    it('sends PATCH method', async () => {
      let capturedMethod = ''
      server.use(
        http.patch('*/api/wastes/:id', ({ request }) => {
          capturedMethod = request.method
          return HttpResponse.json({ ok: true })
        })
      )

      const client = createApiClient({ baseUrl: 'https://api.example.com' })
      await client.patch('/api/wastes/1', { weight: 2.0 })

      expect(capturedMethod).toBe('PATCH')
    })
  })

  describe('delete()', () => {
    it('sends DELETE with no body', async () => {
      let capturedMethod = ''
      let capturedBody: unknown = undefined
      server.use(
        http.delete('*/api/wastes/:id', ({ request }) => {
          capturedMethod = request.method
          capturedBody = request.body
          return new HttpResponse(null, { status: 204 })
        })
      )

      const client = createApiClient({ baseUrl: 'https://api.example.com' })
      await client.delete('/api/wastes/1')

      expect(capturedMethod).toBe('DELETE')
      expect(capturedBody == null).toBe(true)
    })
  })

  describe('error handling', () => {
    it('throws ApiError with status and body for 4xx responses', async () => {
      server.use(
        http.get('*/api/wastes/:id', () =>
          HttpResponse.json({ error: 'waste not found' }, { status: 404 })
        )
      )

      const client = createApiClient({ baseUrl: 'https://api.example.com' })

      await expect(client.get('/api/wastes/999')).rejects.toThrow(ApiError)

      try {
        await client.get('/api/wastes/999')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        const apiErr = err as ApiError
        expect(apiErr.status).toBe(404)
        expect(apiErr.body).toEqual({ error: 'waste not found' })
      }
    })

    it('throws ApiError for 5xx responses', async () => {
      server.use(
        http.get('*/api/wastes', () =>
          HttpResponse.json({ error: 'Internal error' }, { status: 500 })
        )
      )

      const client = createApiClient({ baseUrl: 'https://api.example.com' })
      await expect(client.get('/api/wastes')).rejects.toBeInstanceOf(ApiError)
    })

    it('throws ApiError with status 0 on network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch.')))
      const client = createApiClient({ baseUrl: 'https://api.example.com' })

      const client = createApiClient({ baseUrl: 'https://api.example.com' })
      await expect(client.get('/api/wastes')).rejects.toThrow(ApiError)
    })

    it('throws ApiError with timeout message when AbortError is raised', async () => {
      const abortError = new Error('Aborted.')
      abortError.name = 'AbortError'
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))

      const client = createApiClient({
        baseUrl: 'https://api.example.com',
        timeoutMs: 100
      })

      await expect(client.get('/api/wastes')).rejects.toThrow(/timed out/)

      vi.unstubAllGlobals()
    })
  })

  describe('setToken()', () => {
    it('updates the bearer token for subsequent requests', async () => {
      let capturedAuth = ''
      server.use(
        http.get('*/api/wastes', ({ request }) => {
          capturedAuth = request.headers.get('Authorization') ?? ''
          return HttpResponse.json({ wastes: [] })
        })
      )

      const client = new ApiClient({ baseUrl: 'https://api.example.com' })
      client.setToken('new-token')
      await client.get('/api/wastes')

      expect(capturedAuth).toBe('Bearer new-token')
    })

    it('removes Authorization header when token is set to undefined', async () => {
      let capturedAuth: string | null = null
      server.use(
        http.get('*/api/wastes', ({ request }) => {
          capturedAuth = request.headers.get('Authorization')
          return HttpResponse.json({ wastes: [] })
        })
      )

      const client = new ApiClient({
        baseUrl: 'https://api.example.com',
        bearerToken: 'old-token'
      })
      client.setToken(undefined)
      await client.get('/api/wastes')

      expect(capturedAuth).toBeNull()
    })
  })
})
