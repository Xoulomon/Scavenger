import type { VerificationRecord } from './types'

// Session-scoped verification history (not persisted across page loads)
const _sessionHistory: VerificationRecord[] = []

export function addRecord(record: VerificationRecord) {
  _sessionHistory.unshift(record)
  if (_sessionHistory.length > 200) _sessionHistory.pop()
}

export function getSessionHistory(): VerificationRecord[] {
  return [..._sessionHistory]
}
