import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { render, screen, fireEvent } from '@testing-library/react'
import React, { useState } from 'react'

// ── Hoisted mocks (must be declared before vi.mock calls) ─────────────────────

const mocks = vi.hoisted(() => ({
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => args),
  orderBy: vi.fn((...args: unknown[]) => args),
  collection: vi.fn(() => 'col'),
  doc: vi.fn(() => 'docRef'),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}))

vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: mocks.collection,
  addDoc: mocks.addDoc,
  query: mocks.query,
  where: mocks.where,
  orderBy: mocks.orderBy,
  onSnapshot: mocks.onSnapshot,
  updateDoc: mocks.updateDoc,
  doc: mocks.doc,
  serverTimestamp: mocks.serverTimestamp,
  getDocs: mocks.getDocs,
  Timestamp: { now: () => ({ toMillis: () => Date.now() }) },
}))

import { useMessaging, Message } from '@/hooks/useMessaging'

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg1',
    from: 'ADDR_A',
    to: 'ADDR_B',
    subject: 'Hello',
    body: 'World',
    read: false,
    archived: false,
    createdAt: 1700000000000,
    threadId: 'thread1',
    ...overrides,
  }
}

function setupSnapshots(inboxMsgs: Message[], sentMsgs: Message[] = [], archivedMsgs: Message[] = []) {
  let callCount = 0
  mocks.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
    const idx = callCount++
    const msgs = [inboxMsgs, sentMsgs, archivedMsgs][idx] ?? []
    cb({ docs: msgs.map((m) => ({ id: m.id, data: () => ({ ...m, createdAt: { toMillis: () => m.createdAt } }) })) })
    return vi.fn()
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useMessaging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.addDoc.mockResolvedValue({ id: 'new_msg' })
    mocks.updateDoc.mockResolvedValue(undefined)
  })

  it('returns empty state when no address', async () => {
    mocks.onSnapshot.mockImplementation(() => vi.fn())
    const { result } = renderHook(() => useMessaging(null))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.inbox).toHaveLength(0)
  })

  it('loads inbox messages from snapshot', async () => {
    setupSnapshots([makeMsg()])
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.inbox).toHaveLength(1)
    expect(result.current.inbox[0].subject).toBe('Hello')
  })

  it('counts unread messages correctly', async () => {
    setupSnapshots([makeMsg({ read: false }), makeMsg({ id: 'msg2', read: true })])
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.unreadCount).toBe(1)
  })

  it('getFolder returns inbox messages', async () => {
    setupSnapshots([makeMsg()])
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.getFolder('inbox')).toHaveLength(1)
  })

  it('getFolder returns sent messages', async () => {
    setupSnapshots([], [makeMsg({ from: 'ADDR_B', to: 'ADDR_A' })])
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.getFolder('sent')).toHaveLength(1)
  })

  it('getFolder returns archived messages', async () => {
    setupSnapshots([], [], [makeMsg({ archived: true })])
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.getFolder('archived')).toHaveLength(1)
  })

  it('sendMessage calls addDoc with correct fields', async () => {
    setupSnapshots([])
    const { result } = renderHook(() => useMessaging('ADDR_A'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.sendMessage({ to: 'ADDR_B', subject: 'Hi', body: 'Test' })
    })
    expect(mocks.addDoc).toHaveBeenCalledOnce()
    const payload = mocks.addDoc.mock.calls[0][1] as Record<string, unknown>
    expect(payload.from).toBe('ADDR_A')
    expect(payload.to).toBe('ADDR_B')
    expect(payload.subject).toBe('Hi')
  })

  it('markRead calls updateDoc with read: true', async () => {
    setupSnapshots([])
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.markRead('msg1') })
    expect(mocks.updateDoc).toHaveBeenCalledWith('docRef', { read: true })
  })

  it('archiveMessage calls updateDoc with archived: true', async () => {
    setupSnapshots([])
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.archiveMessage('msg1') })
    expect(mocks.updateDoc).toHaveBeenCalledWith('docRef', { archived: true })
  })

  it('blockUser hides messages from that sender', async () => {
    setupSnapshots([makeMsg({ from: 'SPAMMER' })])
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.getFolder('inbox')).toHaveLength(1)
    act(() => result.current.blockUser('SPAMMER'))
    expect(result.current.getFolder('inbox')).toHaveLength(0)
  })

  it('unblockUser restores messages', async () => {
    setupSnapshots([makeMsg({ from: 'SPAMMER' })])
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.blockUser('SPAMMER'))
    act(() => result.current.unblockUser('SPAMMER'))
    expect(result.current.getFolder('inbox')).toHaveLength(1)
  })

  it('searchMessages filters by subject', async () => {
    setupSnapshots([])
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: 'msg1', data: () => ({ ...makeMsg(), createdAt: { toMillis: () => 0 } }) },
        { id: 'msg2', data: () => ({ ...makeMsg({ id: 'msg2', subject: 'Other' }), createdAt: { toMillis: () => 0 } }) },
      ],
    })
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const results = await result.current.searchMessages('Hello')
    expect(results.some((m) => m.subject === 'Hello')).toBe(true)
  })

  it('searchMessages returns empty for blank term', async () => {
    setupSnapshots([])
    const { result } = renderHook(() => useMessaging('ADDR_B'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const results = await result.current.searchMessages('')
    expect(results).toHaveLength(0)
  })
})

// ── ComposeModal unit test ────────────────────────────────────────────────────

function ComposeStub({ onSend }: { onSend: (d: { to: string; subject: string; body: string }) => Promise<void> }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  return (
    <div>
      <input aria-label="to" value={to} onChange={(e) => setTo(e.target.value)} />
      <input aria-label="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea aria-label="body" value={body} onChange={(e) => setBody(e.target.value)} />
      <button onClick={() => onSend({ to, subject, body })}>Send</button>
    </div>
  )
}

describe('ComposeModal stub', () => {
  it('calls onSend with entered values', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ComposeStub onSend={onSend} />)
    fireEvent.change(screen.getByLabelText('to'), { target: { value: 'ADDR_X' } })
    fireEvent.change(screen.getByLabelText('subject'), { target: { value: 'Test Subject' } })
    fireEvent.change(screen.getByLabelText('body'), { target: { value: 'Test body' } })
    fireEvent.click(screen.getByText('Send'))
    expect(onSend).toHaveBeenCalledWith({ to: 'ADDR_X', subject: 'Test Subject', body: 'Test body' })
  })
})
