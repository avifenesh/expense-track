import {
  getMonthKey,
  formatMonthLabel,
  shiftMonth,
  formatDateShort,
  getDateKey,
  formatDateHeader,
  compareMonths,
  isMonthBefore,
  isMonthAfter,
  clampMonth,
  getYearFromMonthKey,
  getMonthFromMonthKey,
  isValidMonthKey,
} from '../../src/utils/date';

describe('date utilities', () => {
  describe('isValidMonthKey', () => {
    it('returns true for valid month keys', () => {
      expect(isValidMonthKey('2026-01')).toBe(true);
      expect(isValidMonthKey('2026-12')).toBe(true);
      expect(isValidMonthKey('1999-06')).toBe(true);
      expect(isValidMonthKey('2030-09')).toBe(true);
    });

    it('returns false for invalid month keys', () => {
      expect(isValidMonthKey('')).toBe(false);
      expect(isValidMonthKey('invalid')).toBe(false);
      expect(isValidMonthKey('2026')).toBe(false);
      expect(isValidMonthKey('2026-1')).toBe(false);
      expect(isValidMonthKey('2026-13')).toBe(false);
      expect(isValidMonthKey('2026-00')).toBe(false);
      expect(isValidMonthKey('26-01')).toBe(false);
      expect(isValidMonthKey('2026-01-01')).toBe(false);
    });
  });

  describe('getMonthKey', () => {
    it('returns current month key when no date provided', () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const result = getMonthKey();

      expect(result).toBe(expected);
    });

    it('formats date correctly for January', () => {
      const date = new Date(2026, 0, 15);

      const result = getMonthKey(date);

      expect(result).toBe('2026-01');
    });

    it('formats date correctly for December', () => {
      const date = new Date(2026, 11, 31);

      const result = getMonthKey(date);

      expect(result).toBe('2026-12');
    });

    it('pads single-digit months with zero', () => {
      const date = new Date(2026, 2, 1);

      const result = getMonthKey(date);

      expect(result).toBe('2026-03');
    });
  });

  describe('formatMonthLabel', () => {
    it('formats January correctly', () => {
      const result = formatMonthLabel('2026-01');

      expect(result).toBe('January 2026');
    });

    it('formats December correctly', () => {
      const result = formatMonthLabel('2026-12');

      expect(result).toBe('December 2026');
    });

    it('formats various months correctly', () => {
      expect(formatMonthLabel('2026-06')).toBe('June 2026');
      expect(formatMonthLabel('2025-09')).toBe('September 2025');
      expect(formatMonthLabel('2024-03')).toBe('March 2024');
    });

    it('returns Invalid Date for malformed input', () => {
      expect(formatMonthLabel('')).toBe('Invalid Date');
      expect(formatMonthLabel('invalid')).toBe('Invalid Date');
      expect(formatMonthLabel('2026-13')).toBe('Invalid Date');
      expect(formatMonthLabel('2026')).toBe('Invalid Date');
    });
  });

  describe('shiftMonth', () => {
    it('shifts forward by one month', () => {
      const result = shiftMonth('2026-01', 1);

      expect(result).toBe('2026-02');
    });

    it('shifts backward by one month', () => {
      const result = shiftMonth('2026-03', -1);

      expect(result).toBe('2026-02');
    });

    it('handles year rollover forward', () => {
      const result = shiftMonth('2026-12', 1);

      expect(result).toBe('2027-01');
    });

    it('handles year rollover backward', () => {
      const result = shiftMonth('2026-01', -1);

      expect(result).toBe('2025-12');
    });

    it('shifts by multiple months forward', () => {
      const result = shiftMonth('2026-01', 6);

      expect(result).toBe('2026-07');
    });

    it('shifts by multiple months backward', () => {
      const result = shiftMonth('2026-06', -6);

      expect(result).toBe('2025-12');
    });

    it('handles zero offset', () => {
      const result = shiftMonth('2026-05', 0);

      expect(result).toBe('2026-05');
    });

    it('handles large forward shift across years', () => {
      const result = shiftMonth('2026-01', 24);

      expect(result).toBe('2028-01');
    });

    it('returns input unchanged for invalid month key', () => {
      expect(shiftMonth('invalid', 1)).toBe('invalid');
      expect(shiftMonth('', -1)).toBe('');
      expect(shiftMonth('2026-13', 1)).toBe('2026-13');
    });
  });

  describe('formatDateShort', () => {
    it('formats date with short month name', () => {
      const result = formatDateShort('2026-01-15');

      expect(result).toBe('Jan 15');
    });

    it('formats various dates correctly', () => {
      expect(formatDateShort('2026-12-25')).toBe('Dec 25');
      expect(formatDateShort('2026-06-01')).toBe('Jun 1');
      expect(formatDateShort('2026-03-31')).toBe('Mar 31');
    });

    it('handles ISO date strings', () => {
      const result = formatDateShort('2026-01-15T10:30:00.000Z');

      expect(result).toMatch(/Jan 1[45]/);
    });
  });

  describe('getDateKey', () => {
    it('extracts date from ISO string', () => {
      const result = getDateKey('2026-01-15T10:30:00.000Z');

      expect(result).toBe('2026-01-15');
    });

    it('handles date-only string', () => {
      const result = getDateKey('2026-03-25');

      expect(result).toBe('2026-03-25');
    });

    it('extracts date correctly for various inputs', () => {
      expect(getDateKey('2026-12-31T23:59:59.999Z')).toBe('2026-12-31');
      expect(getDateKey('2025-01-01T00:00:00.000Z')).toBe('2025-01-01');
    });
  });

  describe('formatDateHeader', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns "Today" for current date', () => {
      jest.setSystemTime(new Date('2026-01-18T12:00:00.000Z'));

      const result = formatDateHeader('2026-01-18');

      expect(result).toBe('Today');
    });

    it('returns "Yesterday" for previous date', () => {
      jest.setSystemTime(new Date('2026-01-18T12:00:00.000Z'));

      const result = formatDateHeader('2026-01-17');

      expect(result).toBe('Yesterday');
    });

    it('returns formatted date for older dates', () => {
      jest.setSystemTime(new Date('2026-01-18T12:00:00.000Z'));

      const result = formatDateHeader('2026-01-15');

      expect(result).toBe('January 15, 2026');
    });

    it('returns formatted date for dates more than 2 days ago', () => {
      jest.setSystemTime(new Date('2026-01-20T12:00:00.000Z'));

      expect(formatDateHeader('2026-01-10')).toBe('January 10, 2026');
      expect(formatDateHeader('2025-12-25')).toBe('December 25, 2025');
    });

    it('handles year boundaries correctly', () => {
      jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));

      const yesterday = formatDateHeader('2025-12-31');

      expect(yesterday).toBe('Yesterday');
    });
  });

  describe('compareMonths', () => {
    it('returns 0 for equal months', () => {
      expect(compareMonths('2026-01', '2026-01')).toBe(0);
      expect(compareMonths('2025-12', '2025-12')).toBe(0);
    });

    it('returns -1 when first month is earlier in same year', () => {
      expect(compareMonths('2026-01', '2026-02')).toBe(-1);
      expect(compareMonths('2026-06', '2026-12')).toBe(-1);
    });

    it('returns 1 when first month is later in same year', () => {
      expect(compareMonths('2026-03', '2026-01')).toBe(1);
      expect(compareMonths('2026-12', '2026-06')).toBe(1);
    });

    it('returns -1 when first year is earlier', () => {
      expect(compareMonths('2025-12', '2026-01')).toBe(-1);
      expect(compareMonths('2024-06', '2026-03')).toBe(-1);
    });

    it('returns 1 when first year is later', () => {
      expect(compareMonths('2027-01', '2026-12')).toBe(1);
      expect(compareMonths('2026-03', '2024-06')).toBe(1);
    });

    it('returns 0 for invalid inputs', () => {
      expect(compareMonths('invalid', '2026-01')).toBe(0);
      expect(compareMonths('2026-01', 'invalid')).toBe(0);
      expect(compareMonths('', '')).toBe(0);
    });
  });

  describe('isMonthBefore', () => {
    it('returns true when month is before reference', () => {
      expect(isMonthBefore('2026-01', '2026-02')).toBe(true);
      expect(isMonthBefore('2025-12', '2026-01')).toBe(true);
    });

    it('returns false when month is equal to reference', () => {
      expect(isMonthBefore('2026-01', '2026-01')).toBe(false);
    });

    it('returns false when month is after reference', () => {
      expect(isMonthBefore('2026-03', '2026-01')).toBe(false);
      expect(isMonthBefore('2027-01', '2026-12')).toBe(false);
    });
  });

  describe('isMonthAfter', () => {
    it('returns true when month is after reference', () => {
      expect(isMonthAfter('2026-02', '2026-01')).toBe(true);
      expect(isMonthAfter('2027-01', '2026-12')).toBe(true);
    });

    it('returns false when month is equal to reference', () => {
      expect(isMonthAfter('2026-01', '2026-01')).toBe(false);
    });

    it('returns false when month is before reference', () => {
      expect(isMonthAfter('2026-01', '2026-03')).toBe(false);
      expect(isMonthAfter('2025-12', '2026-01')).toBe(false);
    });
  });

  describe('clampMonth', () => {
    it('returns month unchanged when within bounds', () => {
      expect(clampMonth('2026-06', '2026-01', '2026-12')).toBe('2026-06');
    });

    it('returns min when month is before min', () => {
      expect(clampMonth('2025-06', '2026-01', '2026-12')).toBe('2026-01');
      expect(clampMonth('2025-12', '2026-01', '2026-12')).toBe('2026-01');
    });

    it('returns max when month is after max', () => {
      expect(clampMonth('2027-01', '2026-01', '2026-12')).toBe('2026-12');
      expect(clampMonth('2026-06', '2025-01', '2026-03')).toBe('2026-03');
    });

    it('handles undefined min', () => {
      expect(clampMonth('2020-01', undefined, '2026-12')).toBe('2020-01');
      expect(clampMonth('2027-01', undefined, '2026-12')).toBe('2026-12');
    });

    it('handles undefined max', () => {
      expect(clampMonth('2020-01', '2026-01', undefined)).toBe('2026-01');
      expect(clampMonth('2030-01', '2026-01', undefined)).toBe('2030-01');
    });

    it('handles both bounds undefined', () => {
      expect(clampMonth('2020-01', undefined, undefined)).toBe('2020-01');
    });

    it('handles min equal to max (single valid month)', () => {
      expect(clampMonth('2026-06', '2026-06', '2026-06')).toBe('2026-06');
      expect(clampMonth('2026-01', '2026-06', '2026-06')).toBe('2026-06');
      expect(clampMonth('2026-12', '2026-06', '2026-06')).toBe('2026-06');
    });
  });

  describe('getYearFromMonthKey', () => {
    it('extracts year correctly', () => {
      expect(getYearFromMonthKey('2026-01')).toBe(2026);
      expect(getYearFromMonthKey('2025-12')).toBe(2025);
      expect(getYearFromMonthKey('1999-06')).toBe(1999);
    });

    it('returns current year for invalid input', () => {
      const currentYear = new Date().getFullYear();
      expect(getYearFromMonthKey('invalid')).toBe(currentYear);
      expect(getYearFromMonthKey('')).toBe(currentYear);
      expect(getYearFromMonthKey('2026-13')).toBe(currentYear);
    });
  });

  describe('getMonthFromMonthKey', () => {
    it('extracts month correctly for January', () => {
      expect(getMonthFromMonthKey('2026-01')).toBe(1);
    });

    it('extracts month correctly for December', () => {
      expect(getMonthFromMonthKey('2026-12')).toBe(12);
    });

    it('extracts month correctly for various months', () => {
      expect(getMonthFromMonthKey('2026-06')).toBe(6);
      expect(getMonthFromMonthKey('2025-09')).toBe(9);
      expect(getMonthFromMonthKey('2024-03')).toBe(3);
    });

    it('returns current month for invalid input', () => {
      const currentMonth = new Date().getMonth() + 1;
      expect(getMonthFromMonthKey('invalid')).toBe(currentMonth);
      expect(getMonthFromMonthKey('')).toBe(currentMonth);
      expect(getMonthFromMonthKey('2026-13')).toBe(currentMonth);
    });
  });
});
