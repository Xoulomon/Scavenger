import http from 'http'
import { checkDatabaseHealth, checkRpcHealth } from '../services/healthService'

/**
 * GET /health
 * Shallow ping – always returns 200 while the process is alive.
 */
export function handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): void {
  res.writeHead(200)
  res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
}

/**
 * GET /health/liveness
 * Indicates that the process is running.
 * Returns 200 as long as the process is alive (no external checks).
 */
export function handleLiveness(_req: http.IncomingMessage, res: http.ServerResponse): void {
  res.writeHead(200)
  res.end(
    JSON.stringify({
      status: 'alive',
      timestamp: new Date().toISOString()
    })
  )
}

/**
 * GET /health/readiness
 * Indicates that the process is ready to serve traffic.
 * Verifies DB connectivity and Soroban RPC reachability.
 * Returns 200 when all dependencies are healthy, 503 when any are degraded.
 */
export async function handleReadiness(
  _req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const [db, rpc] = await Promise.all([checkDatabaseHealth(), checkRpcHealth()])

  const allHealthy = db.healthy && rpc.healthy
  const status = allHealthy ? 'ready' : 'degraded'
  const httpStatus = allHealthy ? 200 : 503

  res.writeHead(httpStatus)
  res.end(
    JSON.stringify({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: db,
        rpc: rpc
      }
    })
  )
}

export function handleMetrics(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  metrics: Record<string, unknown>
): void {
  res.writeHead(200)
  res.end(JSON.stringify(metrics))
}
