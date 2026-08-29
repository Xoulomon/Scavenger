export interface ConflictData {
  local: unknown
  remote: unknown
  timestamp: number
}

export type ConflictResolutionStrategy = 'local-wins' | 'remote-wins' | 'manual'

export function resolveConflict(
  conflict: ConflictData,
  strategy: ConflictResolutionStrategy = 'remote-wins'
): unknown {
  switch (strategy) {
    case 'local-wins':
      return conflict.local
    case 'remote-wins':
      return conflict.remote
    case 'manual':
      // For manual resolution, we'll need user input
      // For now, default to remote-wins
      return conflict.remote
    default:
      return conflict.remote
  }
}

export function detectConflict(localData: unknown, remoteData: unknown): boolean {
  // Simple conflict detection - if data is different and both exist
  if (!localData || !remoteData) return false

  // For objects, do a deep comparison
  if (typeof localData === 'object' && typeof remoteData === 'object') {
    return JSON.stringify(localData) !== JSON.stringify(remoteData)
  }

  return localData !== remoteData
}

export async function handleSyncConflict(
  key: string,
  localData: unknown,
  remoteData: unknown,
  strategy: ConflictResolutionStrategy = 'remote-wins'
): Promise<unknown> {
  const conflict: ConflictData = {
    local: localData,
    remote: remoteData,
    timestamp: Date.now(),
  }

  // Log conflict for debugging
  console.warn(`Sync conflict detected for key: ${key}`, conflict)

  return resolveConflict(conflict, strategy)
}