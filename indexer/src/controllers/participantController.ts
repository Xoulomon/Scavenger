import http from 'http'
import {
  getParticipant,
  listParticipants,
  ValidationError,
  NotFoundError
} from '../services/participantService'

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status)
  res.end(JSON.stringify(body))
}

/**
 * GET /participants?role=&isActive=&limit=&offset=
 */
export async function handleListParticipants(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<void> {
  try {
    const result = await listParticipants({
      role: url.searchParams.get('role'),
      isActive: url.searchParams.get('isActive'),
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset')
    })
    sendJson(res, 200, result)
  } catch (err) {
    if (err instanceof ValidationError) {
      sendJson(res, 400, { error: err.message })
    } else {
      sendJson(res, 500, { error: 'Internal server error' })
    }
  }
}

/**
 * GET /participants/:address
 */
export async function handleGetParticipant(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  address: string
): Promise<void> {
  try {
    const participant = await getParticipant(address)
    sendJson(res, 200, participant)
  } catch (err) {
    if (err instanceof NotFoundError) {
      sendJson(res, 404, { error: err.message })
    } else if (err instanceof ValidationError) {
      sendJson(res, 400, { error: err.message })
    } else {
      sendJson(res, 500, { error: 'Internal server error' })
    }
  }
}
