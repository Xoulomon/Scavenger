export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export function getMonthLabel(month: Date): string {
  return month.toLocaleString('default', { month: 'long', year: 'numeric' })
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function isInMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month
}

export interface CalendarDay {
  date: Date
  day: number
  isCurrentMonth: boolean
  isToday: boolean
}

/**
 * Generates a 6x7 (42 cell) month grid starting on Sunday, including
 * leading/trailing days from adjacent months to fill the grid.
 */
export function getMonthGrid(year: number, month: number, today: Date = new Date()): CalendarDay[] {
  const firstDayOfWeek = getFirstDayOfWeek(year, month)
  const daysInMonth = getDaysInMonth(year, month)
  const daysInPrevMonth = getDaysInMonth(year, month - 1)

  const grid: CalendarDay[] = []

  // Leading days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const date = new Date(year, month - 1, day)
    grid.push({
      date,
      day,
      isCurrentMonth: false,
      isToday: isSameDay(date, today)
    })
  }

  // Days in current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    grid.push({
      date,
      day,
      isCurrentMonth: true,
      isToday: isSameDay(date, today)
    })
  }

  // Trailing days from next month to fill a 6-row grid (42 cells)
  const remaining = 42 - grid.length
  for (let day = 1; day <= remaining; day++) {
    const date = new Date(year, month + 1, day)
    grid.push({
      date,
      day,
      isCurrentMonth: false,
      isToday: isSameDay(date, today)
    })
  }

  return grid
}

/**
 * Returns the previous month as a new Date, handling year rollover.
 */
export function getPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1)
}

/**
 * Returns the next month as a new Date, handling year rollover.
 */
export function getNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

/**
 * Formats a date range as a human-readable string.
 * Examples:
 *  - Same day: "Jan 5, 2024"
 *  - Same month/year: "Jan 5 – 10, 2024"
 *  - Same year: "Jan 5 – Feb 10, 2024"
 *  - Different years: "Dec 30, 2023 – Jan 5, 2024"
 */
export function formatDateRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleString('default', { month: 'short' })
  const endMonth = end.toLocaleString('default', { month: 'short' })
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  if (isSameDay(start, end)) {
    return `${startMonth} ${start.getDate()}, ${startYear}`
  }

  if (startYear === endYear && start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${startYear}`
  }

  if (startYear === endYear) {
    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${startYear}`
  }

  return `${startMonth} ${start.getDate()}, ${startYear} – ${endMonth} ${end.getDate()}, ${endYear}`
}

/**
 * Formats a single date as "Mon D, YYYY" (e.g., "Jan 5, 2024").
 */
export function formatDate(date: Date): string {
  const month = date.toLocaleString('default', { month: 'short' })
  return `${month} ${date.getDate()}, ${date.getFullYear()}`
}

/**
 * Returns the number of days between two dates (inclusive of start, exclusive of end
 * is not assumed; this returns the absolute difference in whole days).
 */
export function getDaysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round(Math.abs(endUtc - startUtc) / msPerDay)
}

/**
 * Returns true if the given date falls within the inclusive range [start, end].
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const d = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const s = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const e = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return d >= s && d <= e
}
