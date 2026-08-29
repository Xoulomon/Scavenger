import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  getDocs,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type MessageFolder = 'inbox' | 'sent' | 'archived'

export interface Message {
  id: string
  from: string
  to: string
  subject: string
  body: string
  read: boolean
  archived: boolean
  createdAt: number
  threadId: string
}

export interface ComposeData {
  to: string
  subject: string
  body: string
  threadId?: string
}

function toMessage(id: string, data: Record<string, unknown>): Message {
  const ts = data.createdAt as Timestamp | null
  return {
    id,
    from: (data.from as string) ?? '',
    to: (data.to as string) ?? '',
    subject: (data.subject as string) ?? '',
    body: (data.body as string) ?? '',
    read: (data.read as boolean) ?? false,
    archived: (data.archived as boolean) ?? false,
    createdAt: ts ? ts.toMillis() : 0,
    threadId: (data.threadId as string) ?? id,
  }
}

export function useMessaging(userAddress: string | null) {
  const [inbox, setInbox] = useState<Message[]>([])
  const [sent, setSent] = useState<Message[]>([])
  const [archived, setArchived] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])

  useEffect(() => {
    if (!userAddress) { setIsLoading(false); return }

    const col = collection(db, 'messages')

    const inboxQ = query(
      col,
      where('to', '==', userAddress),
      where('archived', '==', false),
      orderBy('createdAt', 'desc')
    )
    const sentQ = query(col, where('from', '==', userAddress), orderBy('createdAt', 'desc'))
    const archivedQ = query(
      col,
      where('to', '==', userAddress),
      where('archived', '==', true),
      orderBy('createdAt', 'desc')
    )

    let loaded = 0
    const done = () => { if (++loaded === 3) setIsLoading(false) }

    const unsub1 = onSnapshot(inboxQ, (snap) => {
      setInbox(snap.docs.map((d) => toMessage(d.id, d.data() as Record<string, unknown>)))
      done()
    })
    const unsub2 = onSnapshot(sentQ, (snap) => {
      setSent(snap.docs.map((d) => toMessage(d.id, d.data() as Record<string, unknown>)))
      done()
    })
    const unsub3 = onSnapshot(archivedQ, (snap) => {
      setArchived(snap.docs.map((d) => toMessage(d.id, d.data() as Record<string, unknown>)))
      done()
    })

    return () => { unsub1(); unsub2(); unsub3() }
  }, [userAddress])

  const sendMessage = useCallback(async (data: ComposeData) => {
    if (!userAddress) throw new Error('Not authenticated.')
    const threadId = data.threadId ?? `thread_${Date.now()}_${Math.random().toString(36).slice(2)}`
    await addDoc(collection(db, 'messages'), {
      from: userAddress,
      to: data.to,
      subject: data.subject,
      body: data.body,
      read: false,
      archived: false,
      threadId,
      createdAt: serverTimestamp(),
    })
  }, [userAddress])

  const markRead = useCallback(async (messageId: string) => {
    await updateDoc(doc(db, 'messages', messageId), { read: true })
  }, [])

  const archiveMessage = useCallback(async (messageId: string) => {
    await updateDoc(doc(db, 'messages', messageId), { archived: true })
  }, [])

  const blockUser = useCallback((address: string) => {
    setBlockedUsers((prev) => (prev.includes(address) ? prev : [...prev, address]))
  }, [])

  const unblockUser = useCallback((address: string) => {
    setBlockedUsers((prev) => prev.filter((a) => a !== address))
  }, [])

  const searchMessages = useCallback(async (term: string): Promise<Message[]> => {
    if (!userAddress || !term.trim()) return []
    const col = collection(db, 'messages')
    const [inboxSnap, sentSnap] = await Promise.all([
      getDocs(query(col, where('to', '==', userAddress))),
      getDocs(query(col, where('from', '==', userAddress))),
    ])
    const all = [
      ...inboxSnap.docs.map((d) => toMessage(d.id, d.data() as Record<string, unknown>)),
      ...sentSnap.docs.map((d) => toMessage(d.id, d.data() as Record<string, unknown>)),
    ]
    const lower = term.toLowerCase()
    return all.filter(
      (m) =>
        m.subject.toLowerCase().includes(lower) ||
        m.body.toLowerCase().includes(lower) ||
        m.from.toLowerCase().includes(lower)
    )
  }, [userAddress])

  const unreadCount = inbox.filter((m) => !m.read && !blockedUsers.includes(m.from)).length

  const getFolder = (folder: MessageFolder) => {
    const filter = (msgs: Message[]) => msgs.filter((m) => !blockedUsers.includes(m.from))
    if (folder === 'inbox') return filter(inbox)
    if (folder === 'sent') return filter(sent)
    return filter(archived)
  }

  return {
    inbox,
    sent,
    archived,
    isLoading,
    unreadCount,
    blockedUsers,
    getFolder,
    sendMessage,
    markRead,
    archiveMessage,
    blockUser,
    unblockUser,
    searchMessages,
  }
}
