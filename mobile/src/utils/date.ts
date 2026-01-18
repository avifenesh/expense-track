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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  // Parse date components manually to avoid timezone issues
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) {
    return 'Today';
  }

  if (date.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
