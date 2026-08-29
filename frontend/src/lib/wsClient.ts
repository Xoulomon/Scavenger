/**
 * Structured WebSocket client (#1092).
 *
 * Handles the backend `WsErrorFrame` protocol:
 * ```json
 * { "type": "error", "payload": { "code": "auth.token_required", "message": "..." } }
 * ```
 *
 * All error frames use a `WsErrorCode` so callers can switch on a stable string
 * rather than parsing free-text messages.
 */

// ── Error codes (must mirror backend WsErrorCode) ─────────────────────────────

/** Stable machine-readable WebSocket error codes emitted by the backend. */
export type WsErrorCode =
  | 'auth.token_required'
  | 'auth.invalid_token'
  | 'channel.not_found'
  | 'message.unknown_type'
  | 'message.parse_error'
  | 'server.shutting_down'
  | 'server.heartbeat_timeout'

// ── Wire types ─────────────────────────────────────────────────────────────────

export interface WsErrorPayload {
  code: WsErrorCode
  message: string
}

export interface WsErrorFrame {
  type: 'error'
  payload: WsErrorPayload
}

// Union of all messages the server may send.
export type ServerMessage =
  | { type: 'AuthSuccess' }
  | { type: 'Pong' }
  | { type: 'subscribed'; channel: string }
  | { type: 'unsubscribed'; channel: string }
  | { type: 'Event'; payload: { channel: string; data: unknown } }
  | { type: 'shutdown'; message: string }
  | WsErrorFrame

// Union of all messages the client may send.
export type ClientMessage =
  | { type: 'Authenticate'; payload: { token: string } }
  | { type: 'Subscribe'; payload: { channel: string } }
  | { type: 'Unsubscribe'; payload: { channel: string } }
  | { type: 'Ping' }

// ── Error handling callback ────────────────────────────────────────────────────

/** Called whenever the server sends a structured error frame. */
export type WsErrorHandler = (error: WsErrorPayload) => void

// ── Client ────────────────────────────────────────────────────────────────────

export interface ScavengerWsClientOptions {
  /** WebSocket URL, e.g. `ws://localhost:8080/ws`. */
  url: string
  /** Bearer token — sent immediately after the connection opens. */
  token: string
  /** Called for every structured error frame from the server. */
  onError?: WsErrorHandler
  /** Called when the connection opens (after sending the auth message). */
  onOpen?: () => void
  /** Called when the connection is closed. */
  onClose?: (event: CloseEvent) => void
  /** Called for every non-error message from the server. */
  onMessage?: (msg: ServerMessage) => void
}

/**
 * Minimal WebSocket client for the Scavenger backend.
 *
 * @example
 * ```ts
 * const client = new ScavengerWsClient({
 *   url: 'ws://localhost:8080/ws',
 *   token: myAuthToken,
 *   onError: (err) => {
 *     switch (err.code) {
 *       case 'auth.token_required':
 *         redirectToLogin()
 *         break
 *       case 'server.shutting_down':
 *         showMaintenanceBanner()
 *         break
 *       default:
 *         console.error('[ws]', err.code, err.message)
 *     }
 *   },
 * })
 * client.connect()
 * client.subscribe('waste:updates')
 * ```
 */
export class ScavengerWsClient {
  private ws: WebSocket | null = null
  private readonly options: ScavengerWsClientOptions

  constructor(options: ScavengerWsClientOptions) {
    this.options = options
  }

  /** Open the connection and authenticate. */
  connect(): void {
    if (this.ws) {
      this.ws.close()
    }

    this.ws = new WebSocket(this.options.url)

    this.ws.addEventListener('open', () => {
      this.send({ type: 'Authenticate', payload: { token: this.options.token } })
      this.options.onOpen?.()
    })

    this.ws.addEventListener('message', (event: MessageEvent<string>) => {
      let parsed: ServerMessage
      try {
        parsed = JSON.parse(event.data) as ServerMessage
      } catch {
        // Non-JSON frame — ignore (server should never send one, but be safe).
        return
      }

      if (parsed.type === 'error') {
        this.options.onError?.((parsed as WsErrorFrame).payload)
        return
      }

      this.options.onMessage?.(parsed)
    })

    this.ws.addEventListener('close', (event) => {
      this.options.onClose?.(event)
    })
  }

  /** Send a raw client message. */
  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  /** Subscribe to a named channel. */
  subscribe(channel: string): void {
    this.send({ type: 'Subscribe', payload: { channel } })
  }

  /** Unsubscribe from a named channel. */
  unsubscribe(channel: string): void {
    this.send({ type: 'Unsubscribe', payload: { channel } })
  }

  /** Close the connection. */
  disconnect(): void {
    this.ws?.close()
    this.ws = null
  }
}
