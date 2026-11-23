import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { buildCalendarCells, getDaysInMonth, getTodayDayInMonth } from '@/lib/date'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'

interface Props {
  month: Date
  activeDay?: number
  onDayHover?: (day: number | null) => void
  renderDayContent?: (day: number) => React.ReactNode
  dayClassName?: string
  loading?: boolean
}

function CalendarGridComponent({
  month,
  activeDay,
  onDayHover,
  renderDayContent,
  dayClassName,
  loading = false
}: Props) {
  const { t } = useTranslation()
  const year = month.getFullYear()
  const monthIdx = month.getMonth()

  const { cells, todayDay, daysInMonth } = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, monthIdx)
    const todayDay = getTodayDayInMonth(year, monthIdx)
    return {
      cells: buildCalendarCells(year, monthIdx) as (number | null)[],
      todayDay: todayDay ?? -1,
      daysInMonth
    }
  }, [year, monthIdx])

  const monthLabel = month.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

  const weeks: (number | null)[][] = useMemo(() => {
    const rows: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7))
    }
    return rows
  }, [cells])

  if (loading) {
    return <LoadingState label={t('calendar.loading')} />
  }

  if (daysInMonth === 0) {
    return (
      <EmptyState title={t('calendar.empty.title')} description={t('calendar.empty.description')} />
    )
  }

  return (
    <div
      role="grid"
      aria-label={`Calendar for ${monthLabel}`}
      className="grid grid-cols-7 gap-0.5 xs:gap-1 tablet:gap-1.5 text-center text-[10px] xs:text-xs text-muted-foreground"
    >
      <span className="sr-only">{monthLabel}</span>
      <div role="row" className="contents">
        {weekdayKeys.map((d) => (
          <div key={d} role="columnheader" className="py-0.5 xs:py-1 font-medium">
            {t(`calendar.weekdays.${d}`)}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} role="row" className="contents">
          {week.map((day, di) => {
            const isActive = day !== null && day === activeDay
            const isToday = day !== null && day === todayDay
            const interactive = day !== null && !!onDayHover
            return (
              <div
                key={di}
                role="gridcell"
                aria-selected={isActive || undefined}
                aria-current={isToday ? 'date' : undefined}
                aria-label={day !== null ? `${monthLabel} ${day}` : undefined}
                aria-hidden={day === null || undefined}
                tabIndex={interactive ? 0 : undefined}
                className={cn(
                  'relative flex h-7 xs:h-8 tablet:h-9 w-full items-center justify-center rounded-md text-[10px] xs:text-xs',
                  day === null && 'invisible',
                  isActive && 'bg-primary text-primary-foreground font-bold',
                  isToday && !isActive && 'bg-accent text-accent-foreground',
                  day !== null && !isActive && !isToday && 'hover:bg-muted cursor-pointer',
                  dayClassName
                )}
                onMouseEnter={() => onDayHover?.(day)}
                onMouseLeave={() => onDayHover?.(null)}
              >
                {day}
                {renderDayContent && day && renderDayContent(day)}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export const CalendarGrid = memo(CalendarGridComponent)
CalendarGrid.displayName = 'CalendarGrid'
