import { queryRecentAlerts } from '../queries/alertQueries'

export async function getRecentAlerts(
  limitParam?: string | null
): Promise<Record<string, unknown>[]> {
  const limit = Math.min(Number(limitParam) || 50, 200)
  return queryRecentAlerts(limit)
}
