import type { AdminUser, MockUser } from './UsersTab'
import type { Dispute } from './DisputesTab'

export type { AdminUser, MockUser, Dispute }

export const MOCK_USERS: AdminUser[] = [
  { address: 'GABC...1234', role: 'Recycler', name: 'Alice Green', status: 'active', joined: Date.now() / 1000 - 86400 * 30 },
  { address: 'GDEF...5678', role: 'Collector', name: 'Bob Smith', status: 'active', joined: Date.now() / 1000 - 86400 * 15 },
  { address: 'GHIJ...9012', role: 'Manufacturer', name: 'Carol White', status: 'suspended', joined: Date.now() / 1000 - 86400 * 60 },
  { address: 'GKLM...3456', role: 'Recycler', name: 'Dave Brown', status: 'active', joined: Date.now() / 1000 - 86400 * 7 },
]

export const MOCK_DISPUTES: Dispute[] = [
  { id: 1, wastId: 42, reporter: 'GABC...1234', description: 'Weight reported does not match actual', status: 'open', createdAt: Date.now() / 1000 - 3600 },
  { id: 2, wastId: 17, reporter: 'GDEF...5678', description: 'Location coordinates are incorrect', status: 'open', createdAt: Date.now() / 1000 - 7200 },
  { id: 3, wastId: 8, reporter: 'GHIJ...9012', description: 'Waste type mislabeled', status: 'resolved', createdAt: Date.now() / 1000 - 86400 },
]

