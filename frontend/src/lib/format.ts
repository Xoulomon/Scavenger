import { getLocaleConfig, detectLocale } from './locale'

export function formatDate(dateInput: Date | number | string, locale?: string): string {
  const resolved = locale ?? detectLocale()
  const config = getLocaleConfig(resolved)
  let date: Date

  if (typeof dateInput === 'number') {
    date = new Date(dateInput * 1000)
  } else {
    date = new Date(dateInput)
  }

  return new Intl.DateTimeFormat(config.currencyLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

export function formatCurrency(amount: number, locale?: string, currency?: string): string {
  const resolved = locale ?? detectLocale()
  const config = getLocaleConfig(resolved)
  try {
    return new Intl.NumberFormat(config.currencyLocale, {
      style: 'currency',
      currency: currency ?? config.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  } catch {
    return `${currency ?? config.currency} ${amount.toFixed(2)}`
  }
}

export function formatNumber(value: number, locale?: string, fractionDigits = 2): string {
  const resolved = locale ?? detectLocale()
  const config = getLocaleConfig(resolved)
  return new Intl.NumberFormat(config.currencyLocale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value)
}

export function formatTokenAmount(amount: bigint | number, decimals = 7): string {
  const num = Number(amount) / 10 ** decimals
  return num.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

export function formatWeight(kg: number, unit: 'kg' | 'lb' = 'kg', fractionDigits = 2): string {
  const value = unit === 'lb' ? kg * 2.2046226218 : kg
  return `${formatNumber(value, undefined, fractionDigits)} ${unit}`
}

const WASTE_TYPE_LABELS: Record<string, string> = {
  plastic: 'Plastic',
  paper: 'Paper',
  glass: 'Glass',
  metal: 'Metal',
  organic: 'Organic',
  electronic: 'Electronic',
  textile: 'Textile',
  other: 'Other'
}

export function formatWasteTypeLabel(type: string): string {
  const key = type.trim().toLowerCase()
  return WASTE_TYPE_LABELS[key] ?? type
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
  in_progress: 'In Progress',
  in_transit: 'In Transit'
}

export function formatStatusLabel(status: string): string {
  const key = status.trim().toLowerCase()
  return STATUS_LABELS[key] ?? status
}
