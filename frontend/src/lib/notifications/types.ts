export type NotificationType = 'transfer' | 'confirmation' | 'reward' | 'system'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  createdAt: number
  count: number
}

export type NewNotification = Omit<Notification, 'id' | 'read' | 'count'>

export type NotificationPreferences = Record<NotificationType, boolean>

export interface NotificationState {
  notifications: Notification[]
  preferences: NotificationPreferences
  unreadCount: number
}

export type NotificationAction =
  | { type: 'add'; notification: NewNotification }
  | { type: 'markRead'; id: string }
  | { type: 'markAllRead' }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'setPreferences'; preferences: Partial<NotificationPreferences> }

export type NotificationListener = (notifications: Notification[]) => void

export type NotificationFilter = (notification: Notification) => boolean

export interface NotificationContextValue {
  notifications: Notification[]
  preferences: NotificationPreferences
  unreadCount: number
  addNotification: (notification: NewNotification) => void
  markRead: (id: string) => void
  markAllRead: () => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  setPreferences: (preferences: Partial<NotificationPreferences>) => void
}
