import http from 'http'
import { getRecentAlerts } from '../services/alertService'
import { validateOptionalInt, RequestValidationError } from '../validation'

export async function handleAlertQuery(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<void> {
  try {
    const limit = validateOptionalInt(url.searchParams.get('limit'), 'limit', { min: 1, max: 200 })
    const alerts = await getRecentAlerts(limit !== undefined ? String(limit) : null)
    res.writeHead(200)
    res.end(JSON.stringify({ alerts }))
  } catch (err) {
    if (err instanceof RequestValidationError) {
      res.writeHead(400)
      res.end(JSON.stringify(err.toResponse()))
      return
    }
    throw err
  }
}
