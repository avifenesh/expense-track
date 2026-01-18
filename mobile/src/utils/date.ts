export function getMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return getMonthKey(date);
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function getDateKey(dateString: string): string {
  return dateString.split('T')[0];
}

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

export function isMonthBefore(month: string, reference: string): boolean {
  return compareMonths(month, reference) < 0;
}

export function isMonthAfter(month: string, reference: string): boolean {
  return compareMonths(month, reference) > 0;
}

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

export function getYearFromMonthKey(monthKey: string): number {
  return parseInt(monthKey.split('-')[0], 10);
}

export function getMonthFromMonthKey(monthKey: string): number {
  return parseInt(monthKey.split('-')[1], 10);
}
