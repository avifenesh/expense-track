const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Validates if a string is a valid month key in YYYY-MM format.
 * @param monthKey - The month key to validate
 * @returns true if valid, false otherwise
 */
export function isValidMonthKey(monthKey: string): boolean {
  return MONTH_KEY_REGEX.test(monthKey);
}

/**
 * Converts a Date object to a month key in YYYY-MM format.
 * @param date - The date to convert (defaults to current date)
 * @returns Month key string in YYYY-MM format
 */
export function getMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Formats a month key into a human-readable label.
 * @param monthKey - Month key in YYYY-MM format
 * @returns Formatted string like "January 2026" or "Invalid Date" if invalid
 */
export function formatMonthLabel(monthKey: string): string {
  if (!isValidMonthKey(monthKey)) {
    return 'Invalid Date';
  }
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Shifts a month key forward or backward by a specified offset.
 * @param monthKey - Month key in YYYY-MM format
 * @param offset - Number of months to shift (positive for future, negative for past)
 * @returns New month key after shifting, or original key if invalid
 */
export function shiftMonth(monthKey: string, offset: number): string {
  if (!isValidMonthKey(monthKey)) {
    return monthKey;
  }
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return getMonthKey(date);
}

/**
 * Formats a date string into a short format (e.g., "Jan 15").
 * @param dateString - ISO date string
 * @returns Short formatted date string
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Extracts the date key (YYYY-MM-DD) from an ISO date string.
 * @param dateString - ISO date string
 * @returns Date key in YYYY-MM-DD format
 */
export function getDateKey(dateString: string): string {
  return dateString.split('T')[0];
}

/**
 * Formats a date key into a human-readable header (Today, Yesterday, or full date).
 * @param dateKey - Date key in YYYY-MM-DD format
 * @returns Formatted date header string
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
 * Compares two month keys chronologically.
 * @param a - First month key in YYYY-MM format
 * @param b - Second month key in YYYY-MM format
 * @returns -1 if a < b, 1 if a > b, 0 if equal or invalid
 */
export function compareMonths(a: string, b: string): number {
  if (!isValidMonthKey(a) || !isValidMonthKey(b)) {
    return 0;
  }
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
 * Checks if a month is chronologically before another month.
 * @param month - Month key to check
 * @param reference - Reference month key
 * @returns true if month is before reference
 */
export function isMonthBefore(month: string, reference: string): boolean {
  return compareMonths(month, reference) < 0;
}

/**
 * Checks if a month is chronologically after another month.
 * @param month - Month key to check
 * @param reference - Reference month key
 * @returns true if month is after reference
 */
export function isMonthAfter(month: string, reference: string): boolean {
  return compareMonths(month, reference) > 0;
}

/**
 * Clamps a month key within specified min and max bounds.
 * @param month - Month key to clamp
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
 * Extracts the year from a month key.
 * @param monthKey - Month key in YYYY-MM format
 * @returns Year as number, or current year if invalid
 */
export function getYearFromMonthKey(monthKey: string): number {
  if (!isValidMonthKey(monthKey)) {
    return new Date().getFullYear();
  }
  return parseInt(monthKey.split('-')[0], 10);
}

/**
 * Extracts the month number from a month key.
 * @param monthKey - Month key in YYYY-MM format
 * @returns Month as number (1-12), or current month if invalid
 */
export function getMonthFromMonthKey(monthKey: string): number {
  if (!isValidMonthKey(monthKey)) {
    return new Date().getMonth() + 1;
  }
  return parseInt(monthKey.split('-')[1], 10);
}
