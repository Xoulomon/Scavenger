import { UserStats, Level } from './types'

const LEVEL_THRESHOLDS = [0, 50, 150, 350, 700, 1200, 2000, 3200, 5000, 8000, 12000]

const LEVEL_TITLES = [
  'Newcomer',
  'Collector',
  'Recycler',
  'Eco Warrior',
  'Green Champion',
  'Sustainability Hero',
  'Planet Guardian',
  'Eco Legend',
  'Master Recycler',
  'Grand Eco Master',
  'Immortal'
]

export function computeXP(stats: UserStats): number {
  return (
    stats.materialsSubmitted * 10 +
    stats.transfersCount * 20 +
    Math.floor(Number(stats.totalEarned) / 100)
  )
}

export function computeLevel(stats: UserStats): Level {
  const xp = computeXP(stats)
  let level = 1
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
      break
    }
  }
  const xpForCurrent = LEVEL_THRESHOLDS[level - 1] ?? 0
  const xpForNext = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  const range = xpForNext - xpForCurrent
  const progressPct =
    range > 0 ? Math.min(100, Math.round(((xp - xpForCurrent) / range) * 100)) : 100

  return { level, title: LEVEL_TITLES[level - 1] ?? 'Immortal', xp, xpForNext, progressPct }
}
