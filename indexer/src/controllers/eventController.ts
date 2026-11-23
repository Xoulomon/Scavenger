import http from 'http'
import { getEvents } from '../services/eventService'
import { validateEventQueryParams, RequestValidationError } from '../validation'

export async function handleEventQuery(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<void> {
  try {
    const params = validateEventQueryParams(url)

    const result = await getEvents({
      eventType: params.eventType ?? null,
      fromLedger: params.fromLedger !== undefined ? String(params.fromLedger) : null,
      toLedger: params.toLedger !== undefined ? String(params.toLedger) : null,
      limit: params.limit !== undefined ? String(params.limit) : null,
      offset: params.offset !== undefined ? String(params.offset) : null,
      contractId: params.contractId ?? null,
      txHash: params.txHash ?? null
    })

    res.writeHead(200)
    res.end(JSON.stringify(result))
  } catch (err) {
    if (err instanceof RequestValidationError) {
      res.writeHead(400)
      res.end(JSON.stringify(err.toResponse()))
      return
    }
    throw err
  }
}

export function handleEventStream(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sseClients: Set<http.ServerResponse>
): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  res.write('data: {"type":"connected"}\n\n')
  sseClients.add(res)

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n')
  }, 15000)

  req.on('close', () => {
    sseClients.delete(res)
    clearInterval(keepAlive)
  })
}
