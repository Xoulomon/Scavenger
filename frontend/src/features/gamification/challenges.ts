import { UserStats, Challenge } from './types'

function startOfDay(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfWeek(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.getTime()
}

export function generateChallenges(stats: UserStats, now = Date.now()): Challenge[] {
  const dayStart = startOfDay(now)
  const weekStart = startOfWeek(now)

  const daily: Omit<Challenge, 'current' | 'progressPct' | 'completed'>[] = [
    {
      id: 'daily_submit_3',
      title: 'Daily Submitter',
      description: 'Submit 3 waste items today',
      target: 3,
      type: 'daily',
      expiresAt: dayStart + 86_400_000
    },
    {
      id: 'daily_transfer_1',
      title: 'Daily Mover',
      description: 'Complete 1 transfer today',
      target: 1,
      type: 'daily',
      expiresAt: dayStart + 86_400_000
    }
  ]

  const weekly: Omit<Challenge, 'current' | 'progressPct' | 'completed'>[] = [
    {
      id: 'weekly_submit_15',
      title: 'Weekly Recycler',
      description: 'Submit 15 waste items this week',
      target: 15,
      type: 'weekly',
      expiresAt: weekStart + 7 * 86_400_000
    },
    {
      id: 'weekly_transfer_5',
      title: 'Weekly Mover',
      description: 'Complete 5 transfers this week',
      target: 5,
      type: 'weekly',
      expiresAt: weekStart + 7 * 86_400_000
    },
    {
      id: 'weekly_earn_500',
      title: 'Token Grinder',
      description: 'Earn 500 tokens this week',
      target: 500,
      type: 'weekly',
      expiresAt: weekStart + 7 * 86_400_000
    }
  ]

  const resolve = (c: Omit<Challenge, 'current' | 'progressPct' | 'completed'>): Challenge => {
    let current = 0
    if (c.id.includes('submit')) current = Math.min(c.target, stats.materialsSubmitted)
    else if (c.id.includes('transfer')) current = Math.min(c.target, stats.transfersCount)
    else if (c.id.includes('earn')) current = Math.min(c.target, Number(stats.totalEarned))
    const progressPct = Math.round((current / c.target) * 100)
    return { ...c, current, progressPct, completed: current >= c.target }
  }

  return [...daily, ...weekly].map(resolve)
}
