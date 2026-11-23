import { getPool } from '../db/client'
import { config } from '../config'

export interface HealthCheckResult {
  healthy: boolean
  latencyMs?: number
  error?: string
}

/**
 * Verifies PostgreSQL connectivity by running a lightweight SELECT 1 query.
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const pool = getPool()
    await pool.query('SELECT 1')
    return { healthy: true, latencyMs: Date.now() - start }
  } catch (err) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Verifies Soroban RPC reachability by calling getLatestLedger.
 * Uses a 5-second timeout to avoid blocking the readiness check.
 */
export async function checkRpcHealth(): Promise<HealthCheckResult> {
  const start = Date.now()
  const rpcUrl = config.stellar.rpcUrl

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestLedger', params: [] }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: `RPC returned HTTP ${response.status}`
      }
    }

    return { healthy: true, latencyMs: Date.now() - start }
  } catch (err) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}
