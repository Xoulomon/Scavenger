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
