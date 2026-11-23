import { useCallback, useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Subscription } from '@/lib/subscriptionStorage'
import { CalendarGrid } from '@/components/CalendarGrid'
import { EmptyState } from '@/components/EmptyState'
import { getMonthLabel, groupSubscriptionsByPickupDay } from '@/lib/date'
import { SubscriptionStatus } from '@/lib/constants'

interface Props {
  subscriptions: Subscription[]
  month?: Date
}

export function SubscriptionCalendar({ subscriptions, month = new Date() }: Props) {
  const { t } = useTranslation()
  const year = month.getFullYear()
  const monthIdx = month.getMonth()
  const headingId = useId()

  const pickupsByDay = useMemo(
    () => groupSubscriptionsByPickupDay(subscriptions, year, monthIdx, SubscriptionStatus.Active),
    [subscriptions, year, monthIdx]
  )

  const monthLabel = useMemo(() => getMonthLabel(month), [month])
  const hasPickups = Object.keys(pickupsByDay).length > 0

  const renderDayContent = useCallback(
    (day: number) =>
      pickupsByDay[day] && (
        <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-success">
          <span className="sr-only">Scheduled pickup</span>
        </span>
      ),
    [pickupsByDay]
  )

  return (
    <div
      className="rounded-lg border p-2 xs:p-3 tablet:p-4"
      role="region"
      aria-labelledby={headingId}
      aria-label={`Subscription calendar for ${monthLabel}`}
    >
      <h3 id={headingId} className="mb-2 text-xs font-semibold xs:mb-3 xs:text-sm tablet:text-base">
        {monthLabel}
      </h3>
      <CalendarGrid month={month} renderDayContent={renderDayContent} />
      {!hasPickups && (
        <div className="mt-2 xs:mt-3">
          <EmptyState
            title={t('subscriptionCalendar.empty.title')}
            description={t('subscriptionCalendar.empty.description')}
          />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground xs:mt-3 xs:gap-2 xs:text-xs">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-success"
          role="img"
          aria-label={t('subscriptionCalendar.legend.scheduledPickup')}
        />
        <span className="truncate" aria-hidden="true">
          {t('subscriptionCalendar.legend.scheduledPickup')}
        </span>
      </div>
    </div>
  )
}
