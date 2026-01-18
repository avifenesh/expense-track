import {
  getMonthKey,
  formatMonthLabel,
  shiftMonth,
  formatDateShort,
  getDateKey,
  formatDateHeader,
} from '../../src/utils/date';

describe('date utilities', () => {
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
});
