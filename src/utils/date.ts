import { addMonths, format, startOfMonth } from 'date-fns'

export function getMonthStart(date: Date) {
  return startOfMonth(date)
}

export function getMonthStartFromKey(monthKey: string) {
  const [yearPart, monthPart] = monthKey.split('-')
  const year = Number(yearPart)
  const monthIndex = Number(monthPart) - 1
  // Return UTC date to match database dates
  return new Date(Date.UTC(year, monthIndex, 1))
}

export function getMonthKey(date: Date) {
  return format(getMonthStart(date), 'yyyy-MM')
}

export function formatMonthLabel(monthKey: string) {
  return format(getMonthStartFromKey(monthKey), 'LLLL yyyy')
}

export function shiftMonth(monthKey: string, offset: number) {
  const shifted = addMonths(getMonthStartFromKey(monthKey), offset)
  return getMonthKey(shifted)
}

/**
 * Parse a date string in yyyy-MM-dd format to a UTC Date object.
 * Returns null if the input is invalid.
 */
export function normalizeDateInput(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }

  const [yearPart, monthPart, dayPart] = value.split('-')
  if (!yearPart || !monthPart || !dayPart) {
    return null
  }

  const year = Number(yearPart)
  const monthIndex = Number(monthPart) - 1
  const day = Number(dayPart)

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null
  }
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) {
    return null
  }

  const utcDate = new Date(Date.UTC(year, monthIndex, day))

  if (utcDate.getUTCFullYear() !== year || utcDate.getUTCMonth() !== monthIndex || utcDate.getUTCDate() !== day) {
    return null
  }

  return utcDate
}
