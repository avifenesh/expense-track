/**
 * Get month key from a date (YYYY-MM format)
 */
export function getMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format a month key into a human-readable label
 * @param monthKey - Month key in YYYY-MM format
 * @returns Formatted string like "January 2026"
 */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Shift a month key by a given offset
 * @param monthKey - Month key in YYYY-MM format
 * @param offset - Number of months to shift (positive for future, negative for past)
 * @returns New month key in YYYY-MM format
 */
export function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return getMonthKey(date);
}

/**
 * Format a date string for display (short format)
 * @param dateString - ISO date string
 * @returns Formatted string like "Jan 15"
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Get a date key for grouping transactions
 * @param dateString - ISO date string
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateKey(dateString: string): string {
  return dateString.split('T')[0];
}

/**
 * Format a date key for section header display
 * @param dateKey - Date key in YYYY-MM-DD format
 * @returns "Today", "Yesterday", or formatted date like "January 15, 2026"
 */
export function formatDateHeader(dateKey: string): string {
  // Parse the dateKey as a UTC date
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Get today's date at midnight UTC
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Get yesterday's date at midnight UTC
  const yesterdayUTC = new Date(todayUTC);
  yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);

  if (date.getTime() === todayUTC.getTime()) {
    return 'Today';
  }

  if (date.getTime() === yesterdayUTC.getTime()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Compare two month keys
 * @param a - First month key in YYYY-MM format
 * @param b - Second month key in YYYY-MM format
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareMonths(a: string, b: string): number {
  const [yearA, monthA] = a.split('-').map(Number);
  const [yearB, monthB] = b.split('-').map(Number);

  if (yearA !== yearB) {
    return yearA < yearB ? -1 : 1;
  }
  if (monthA !== monthB) {
    return monthA < monthB ? -1 : 1;
  }
  return 0;
}

/**
 * Check if a month is before a reference month
 * @param month - Month key to check in YYYY-MM format
 * @param reference - Reference month key in YYYY-MM format
 * @returns true if month is before reference
 */
export function isMonthBefore(month: string, reference: string): boolean {
  return compareMonths(month, reference) < 0;
}

/**
 * Check if a month is after a reference month
 * @param month - Month key to check in YYYY-MM format
 * @param reference - Reference month key in YYYY-MM format
 * @returns true if month is after reference
 */
export function isMonthAfter(month: string, reference: string): boolean {
  return compareMonths(month, reference) > 0;
}

/**
 * Clamp a month key to be within min/max bounds
 * @param month - Month key to clamp in YYYY-MM format
 * @param min - Optional minimum month key
 * @param max - Optional maximum month key
 * @returns Clamped month key
 */
export function clampMonth(month: string, min?: string, max?: string): string {
  let result = month;
  if (min && isMonthBefore(result, min)) {
    result = min;
  }
  if (max && isMonthAfter(result, max)) {
    result = max;
  }
  return result;
}

/**
 * Extract the year from a month key
 * @param monthKey - Month key in YYYY-MM format
 * @returns Year as a number
 */
export function getYearFromMonthKey(monthKey: string): number {
  return parseInt(monthKey.split('-')[0], 10);
}

/**
 * Extract the month (1-12) from a month key
 * @param monthKey - Month key in YYYY-MM format
 * @returns Month as a number (1-12)
 */
export function getMonthFromMonthKey(monthKey: string): number {
  return parseInt(monthKey.split('-')[1], 10);
}
