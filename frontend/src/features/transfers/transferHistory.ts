import type { LocalTransferRecord } from './types'

// Local transfer history (session-scoped, not persisted)
const _transferHistory: LocalTransferRecord[] = []

export function addTransferRecord(record: LocalTransferRecord) {
  _transferHistory.unshift(record)
  if (_transferHistory.length > 100) _transferHistory.pop()
}

export function getTransferHistory(): LocalTransferRecord[] {
  return [..._transferHistory]
}
