import { addMonths, format, parseISO, startOfMonth } from 'date-fns';

export function getMonthStart(date: Date) {
  return startOfMonth(date);
}

export function getMonthStartFromKey(monthKey: string) {
  const parsed = parseISO(`${monthKey}-01`);
  return startOfMonth(parsed);
}

export function getMonthKey(date: Date) {
  return format(getMonthStart(date), 'yyyy-MM');
}

export function formatMonthLabel(monthKey: string) {
  return format(getMonthStartFromKey(monthKey), 'LLLL yyyy');
}

export function shiftMonth(monthKey: string, offset: number) {
  const shifted = addMonths(getMonthStartFromKey(monthKey), offset);
  return getMonthKey(shifted);
}
