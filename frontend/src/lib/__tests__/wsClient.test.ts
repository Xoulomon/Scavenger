/**
 * Unit tests for the structured WebSocket client (#1092).
 *
 * Uses a minimal WebSocket mock — no real network connection is made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ScavengerWsClient,
  type WsErrorCode,
  type WsErrorFrame,
  type ServerMessage,
} from '../wsClient'

// ── WebSocket mock ─────────────────────────────────────────────────────────────

/** Minimal mock that captures sent messages and exposes trigger helpers. */
class MockWebSocket {
  static OPEN = 1
  readyState = MockWebSocket.OPEN

  private listeners: Record<string, ((...args: unknown[]) => void)[]> = {}

  addEventListener(event: string, cb: (...args: unknown[]) => void): void {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(cb)
  }

  send = vi.fn()

  close = vi.fn(() => {
    this.readyState = 3 // CLOSED
  })

  /** Simulate the server sending a message. */
  triggerMessage(data: unknown): void {
    for (const cb of this.listeners['message'] ?? []) {
      cb({ data: JSON.stringify(data) })
    }
  }

  /** Simulate the connection opening. */
  triggerOpen(): void {
    for (const cb of this.listeners['open'] ?? []) {
      cb({})
    }
  }

  /** Simulate the connection closing. */
  triggerClose(event = {}): void {
    for (const cb of this.listeners['close'] ?? []) {
      cb(event)
    }
  }
}

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeErrorFrame(code: WsErrorCode, message = 'test error'): WsErrorFrame {
  return { type: 'error', payload: { code, message } }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ScavengerWsClient', () => {
  let mockWs: MockWebSocket

  beforeEach(() => {
    mockWs = new MockWebSocket()
    // Patch global WebSocket so ScavengerWsClient uses our mock.
    vi.stubGlobal('WebSocket', vi.fn(() => mockWs))
  })

  it('sends Authenticate message on open', () => {
    const client = new ScavengerWsClient({
      url: 'ws://localhost:8080/ws',
      token: 'my-test-token',
    })
    client.connect()
    mockWs.triggerOpen()

    expect(mockWs.send).toHaveBeenCalledOnce()
    const sent = JSON.parse(mockWs.send.mock.calls[0][0])
    expect(sent.type).toBe('Authenticate')
    expect(sent.payload.token).toBe('my-test-token')
  })

  it('calls onOpen callback after auth message sent', () => {
    const onOpen = vi.fn()
    const client = new ScavengerWsClient({
      url: 'ws://localhost:8080/ws',
      token: 'tok',
      onOpen,
    })
    client.connect()
    mockWs.triggerOpen()
    expect(onOpen).toHaveBeenCalledOnce()
  })

  // ── Structured error handling ──────────────────────────────────────────────

  it('routes auth.token_required error frame to onError', () => {
    const onError = vi.fn()
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't', onError })
    client.connect()
    mockWs.triggerOpen()
    mockWs.triggerMessage(makeErrorFrame('auth.token_required'))

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].code).toBe('auth.token_required')
  })

  it('routes auth.invalid_token error frame to onError', () => {
    const onError = vi.fn()
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't', onError })
    client.connect()
    mockWs.triggerOpen()
    mockWs.triggerMessage(makeErrorFrame('auth.invalid_token'))

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].code).toBe('auth.invalid_token')
  })

  it('routes server.shutting_down error frame to onError', () => {
    const onError = vi.fn()
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't', onError })
    client.connect()
    mockWs.triggerOpen()
    mockWs.triggerMessage(makeErrorFrame('server.shutting_down'))

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].code).toBe('server.shutting_down')
  })

  it('routes server.heartbeat_timeout error frame to onError', () => {
    const onError = vi.fn()
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't', onError })
    client.connect()
    mockWs.triggerOpen()
    mockWs.triggerMessage(makeErrorFrame('server.heartbeat_timeout'))

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].code).toBe('server.heartbeat_timeout')
  })

  it('routes message.parse_error error frame to onError', () => {
    const onError = vi.fn()
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't', onError })
    client.connect()
    mockWs.triggerOpen()
    mockWs.triggerMessage(makeErrorFrame('message.parse_error'))

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].code).toBe('message.parse_error')
  })

  it('does not call onMessage for error frames', () => {
    const onMessage = vi.fn()
    const client = new ScavengerWsClient({
      url: 'ws://x',
      token: 't',
      onMessage,
    })
    client.connect()
    mockWs.triggerOpen()
    mockWs.triggerMessage(makeErrorFrame('auth.token_required'))

    // onMessage must NOT be called — error frames are routed to onError only.
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('error payload includes message string', () => {
    const onError = vi.fn()
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't', onError })
    client.connect()
    mockWs.triggerOpen()
    mockWs.triggerMessage(makeErrorFrame('channel.not_found', "channel 'events' not found"))

    const payload = onError.mock.calls[0][0]
    expect(payload.message).toBe("channel 'events' not found")
  })

  // ── Normal messages ────────────────────────────────────────────────────────

  it('routes non-error messages to onMessage', () => {
    const onMessage = vi.fn()
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't', onMessage })
    client.connect()
    mockWs.triggerOpen()
    mockWs.triggerMessage({ type: 'AuthSuccess' })

    expect(onMessage).toHaveBeenCalledOnce()
    const msg = onMessage.mock.calls[0][0] as ServerMessage
    expect(msg.type).toBe('AuthSuccess')
  })

  it('handles subscribed confirmation message', () => {
    const onMessage = vi.fn()
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't', onMessage })
    client.connect()
    mockWs.triggerOpen()
    mockWs.triggerMessage({ type: 'subscribed', channel: 'waste:updates' })

    const msg = onMessage.mock.calls[0][0] as { type: 'subscribed'; channel: string }
    expect(msg.channel).toBe('waste:updates')
  })

  // ── Disconnect / close ─────────────────────────────────────────────────────

  it('calls onClose when server closes connection', () => {
    const onClose = vi.fn()
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't', onClose })
    client.connect()
    mockWs.triggerOpen()
    mockWs.triggerClose({ code: 1000 })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('disconnect closes the socket', () => {
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't' })
    client.connect()
    client.disconnect()

    expect(mockWs.close).toHaveBeenCalledOnce()
  })

  // ── subscribe / unsubscribe ────────────────────────────────────────────────

  it('subscribe sends Subscribe message', () => {
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't' })
    client.connect()
    mockWs.triggerOpen()
    // Reset spy so we only see the subscribe call.
    mockWs.send.mockClear()

    client.subscribe('waste:updates')

    expect(mockWs.send).toHaveBeenCalledOnce()
    const sent = JSON.parse(mockWs.send.mock.calls[0][0])
    expect(sent.type).toBe('Subscribe')
    expect(sent.payload.channel).toBe('waste:updates')
  })

  it('unsubscribe sends Unsubscribe message', () => {
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't' })
    client.connect()
    mockWs.triggerOpen()
    mockWs.send.mockClear()

    client.unsubscribe('waste:updates')

    const sent = JSON.parse(mockWs.send.mock.calls[0][0])
    expect(sent.type).toBe('Unsubscribe')
    expect(sent.payload.channel).toBe('waste:updates')
  })

  // ── Non-JSON frame (defensive) ────────────────────────────────────────────

  it('silently ignores non-JSON frames', () => {
    const onMessage = vi.fn()
    const onError = vi.fn()
    const client = new ScavengerWsClient({ url: 'ws://x', token: 't', onMessage, onError })
    client.connect()
    mockWs.triggerOpen()

    // Simulate the event with raw non-JSON text (bypass triggerMessage's stringify).
    for (const cb of (mockWs as unknown as { listeners: Record<string, ((...args: unknown[]) => void)[]> }).listeners['message'] ?? []) {
      cb({ data: 'not-json{{{{' })
    }

    expect(onMessage).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
