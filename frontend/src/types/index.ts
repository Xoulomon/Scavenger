// Re-export all types from shared package for backward compatibility
export * from '@scavngr/types'

// Frontend-specific extensions and UI types
export interface UiState {
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  notifications: NotificationItem[]
}

export interface NotificationItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  timestamp: number
  read: boolean
}

export interface TableColumn<T = Record<string, unknown>> {
  key: keyof T
  label: string
  sortable?: boolean
  render?: (value: unknown, item: T) => React.ReactNode
}

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export interface FormFieldProps {
  name: string
  label: string
  required?: boolean
  disabled?: boolean
  error?: string
  help?: string
}
