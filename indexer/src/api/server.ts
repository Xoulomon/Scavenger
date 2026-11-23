import http from 'http'
import { logger } from '../utils/logger'
import {
  handleHealth,
  handleLiveness,
  handleReadiness,
  handleMetrics
} from '../controllers/healthController'
import { handleEventQuery, handleEventStream } from '../controllers/eventController'
import { handleReplay, handleReplayStatus } from '../controllers/replayController'
import { handleAlertQuery } from '../controllers/alertController'
import { handleListParticipants, handleGetParticipant } from '../controllers/participantController'

export interface ApiConfig {
  port: number
  host: string
}

export function createApiServer(config: ApiConfig) {
  const metrics = {
    eventsProcessed: 0,
    eventsFailed: 0,
    lastEventTimestamp: null as string | null,
    syncLag: 0,
    reorgsDetected: 0,
    alertsFired: 0,
    startTime: new Date().toISOString(),
    eventsByType: {} as Record<string, number>
  }

  const sseClients = new Set<http.ServerResponse>()

  function broadcastEvent(event: Record<string, unknown>) {
    const data = `data: ${JSON.stringify(event)}\n\n`
    for (const client of sseClients) {
      try {
        client.write(data)
      } catch {
        sseClients.delete(client)
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')

    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
      const path = url.pathname

      if (path === '/health') {
        handleHealth(req, res)
      } else if (path === '/health/liveness') {
        handleLiveness(req, res)
      } else if (path === '/health/readiness') {
        await handleReadiness(req, res)
      } else if (path === '/metrics') {
        handleMetrics(req, res, metrics)
      } else if (path === '/events/stream') {
        handleEventStream(req, res, sseClients)
      } else if (path.startsWith('/events')) {
        await handleEventQuery(req, res, url)
      } else if (path === '/replay') {
        await handleReplay(req, res)
      } else if (path.startsWith('/replay/status')) {
        await handleReplayStatus(req, res)
      } else if (path.startsWith('/alerts')) {
        await handleAlertQuery(req, res, url)
      } else if (path === '/participants') {
        await handleListParticipants(req, res, url)
      } else if (path.startsWith('/participants/')) {
        const address = path.slice('/participants/'.length)
        await handleGetParticipant(req, res, decodeURIComponent(address))
      } else {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Not found' }))
      }
    } catch (err) {
      logger.error('API request failed', { error: String(err) })
      res.writeHead(500)
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  })

  return {
    server,
    metrics,
    broadcastEvent,
    start() {
      return new Promise<void>((resolve) => {
        server.listen(config.port, config.host, () => {
          logger.info('API server started', { host: config.host, port: config.port })
          resolve()
        })
      })
    },
    stop() {
      return new Promise<void>((resolve) => {
        for (const client of sseClients) {
          try {
            client.end()
          } catch {
            /* ignore */
          }
        }
        sseClients.clear()
        server.close(() => resolve())
      })
    }
  }
}
