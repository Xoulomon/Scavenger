// The only module under src/ that imports Firebase for notifications.
// NotificationStore loads it with a dynamic import, so Firebase is only fetched when configured.
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  increment,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Notification, NotificationType } from './types'
import type { NotificationTransport } from './transport'

const items = (address: string) => collection(db, 'notifications', address, 'items')

export function createFirebaseTransport(): NotificationTransport {
  return {
    async findRecentUnread(address: string, type: NotificationType, since: number) {
      const snap = await getDocs(
        query(
          items(address),
          where('type', '==', type),
          where('read', '==', false),
          where('createdAt', '>=', since),
          orderBy('createdAt', 'desc'),
        ),
      )
      return snap.empty ? undefined : (snap.docs[0].data() as Notification)
    },

    async insert(address: string, item: Notification) {
      await setDoc(doc(items(address), item.id), item)
    },

    async incrementCount(address: string, id: string) {
      await updateDoc(doc(items(address), id), { count: increment(1) })
    },

    async markRead(address: string, id: string) {
      await updateDoc(doc(items(address), id), { read: true })
    },

    async markAllRead(address: string) {
      const snap = await getDocs(query(items(address), where('read', '==', false)))
      await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })))
    },

    async remove(address: string, id: string) {
      await deleteDoc(doc(items(address), id))
    },

    subscribe(address, max, onItems, onError) {
      const q = query(items(address), orderBy('createdAt', 'desc'), limit(max))
      return onSnapshot(
        q,
        (snapshot) => onItems(snapshot.docs.map((d) => d.data() as Notification)),
        (error) => onError?.(error),
      )
    },
  }
}
