import {
  roundToTwoDecimals,
  calculateEqualSplit,
  calculatePercentageSplit,
  getOwnerShare,
  calculateSplitAmounts,
  getTotalParticipantShare,
  validateSplitAmounts,
  createSplitPreview,
  distributeRoundingError,
} from '../../src/lib/splitCalculator';

describe('splitCalculator', () => {
  describe('roundToTwoDecimals', () => {
    it('rounds to two decimal places', () => {
      expect(roundToTwoDecimals(10.456)).toBe(10.46);
      expect(roundToTwoDecimals(10.454)).toBe(10.45);
      expect(roundToTwoDecimals(10.455)).toBe(10.46); // banker's rounding
    });

    it('handles whole numbers', () => {
      expect(roundToTwoDecimals(100)).toBe(100);
      expect(roundToTwoDecimals(0)).toBe(0);
    });

    it('handles small decimals', () => {
      expect(roundToTwoDecimals(0.001)).toBe(0);
      expect(roundToTwoDecimals(0.005)).toBe(0.01);
    });
  });

  describe('calculateEqualSplit', () => {
    it('splits equally among participants and owner', () => {
      // $100 split among 2 participants + owner = 3 people
      // Each pays $33.33
      expect(calculateEqualSplit(100, 2)).toBe(33.33);
    });

    it('handles single participant', () => {
      // $100 split among 1 participant + owner = 2 people
      expect(calculateEqualSplit(100, 1)).toBe(50);
    });

    it('returns 0 for zero participants', () => {
      expect(calculateEqualSplit(100, 0)).toBe(0);
    });

    it('handles odd divisions with rounding', () => {
      // $100 / 3 people = 33.33...
      expect(calculateEqualSplit(100, 2)).toBe(33.33);
    });

    it('handles large amounts', () => {
      expect(calculateEqualSplit(10000, 4)).toBe(2000);
    });

    it('handles small amounts', () => {
      expect(calculateEqualSplit(1, 2)).toBe(0.33);
    });
  });

  describe('calculatePercentageSplit', () => {
    it('calculates amounts based on percentages', () => {
      const percentages = new Map([
        ['user1@example.com', 30],
        ['user2@example.com', 20],
      ]);

      const result = calculatePercentageSplit(100, percentages);

      expect(result.get('user1@example.com')).toBe(30);
      expect(result.get('user2@example.com')).toBe(20);
    });

    it('handles 100% allocation', () => {
      const percentages = new Map([['user@example.com', 100]]);
      const result = calculatePercentageSplit(100, percentages);
      expect(result.get('user@example.com')).toBe(100);
    });

    it('handles 0% allocation', () => {
      const percentages = new Map([['user@example.com', 0]]);
      const result = calculatePercentageSplit(100, percentages);
      expect(result.get('user@example.com')).toBe(0);
    });

    it('handles decimal percentages', () => {
      const percentages = new Map([['user@example.com', 33.33]]);
      const result = calculatePercentageSplit(100, percentages);
      expect(result.get('user@example.com')).toBe(33.33);
    });

    it('handles empty map', () => {
      const result = calculatePercentageSplit(100, new Map());
      expect(result.size).toBe(0);
    });
  });

  describe('getOwnerShare', () => {
    it('calculates owner share as remainder', () => {
      expect(getOwnerShare(100, [30, 20])).toBe(50);
    });

    it('handles when participants pay all', () => {
      expect(getOwnerShare(100, [100])).toBe(0);
    });

    it('handles when participants pay nothing', () => {
      expect(getOwnerShare(100, [0])).toBe(100);
    });

    it('handles empty participants array', () => {
      expect(getOwnerShare(100, [])).toBe(100);
    });

    it('handles rounding issues correctly', () => {
      // $100 split 3 ways: 33.33 * 2 = 66.66, owner pays 33.34
      expect(getOwnerShare(100, [33.33, 33.33])).toBe(33.34);
    });
  });

  describe('calculateSplitAmounts', () => {
    const participants = [
      { email: 'user1@example.com', percentage: 40, fixedAmount: 40 },
      { email: 'user2@example.com', percentage: 30, fixedAmount: 25 },
    ];

    it('calculates EQUAL split correctly', () => {
      const result = calculateSplitAmounts('EQUAL', 100, participants);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(33.33);
      expect(result[1].amount).toBe(33.33);
    });

    it('calculates PERCENTAGE split correctly', () => {
      const result = calculateSplitAmounts('PERCENTAGE', 100, participants);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(40);
      expect(result[0].percentage).toBe(40);
      expect(result[1].amount).toBe(30);
      expect(result[1].percentage).toBe(30);
    });

    it('calculates FIXED split correctly', () => {
      const result = calculateSplitAmounts('FIXED', 100, participants);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(40);
      expect(result[1].amount).toBe(25);
    });

    it('returns empty array for no participants', () => {
      const result = calculateSplitAmounts('EQUAL', 100, []);
      expect(result).toHaveLength(0);
    });
  });

  describe('getTotalParticipantShare', () => {
    it('sums all participant shares', () => {
      const shares = [
        { email: 'user1@example.com', amount: 30 },
        { email: 'user2@example.com', amount: 20 },
      ];
      expect(getTotalParticipantShare(shares)).toBe(50);
    });

    it('returns 0 for empty array', () => {
      expect(getTotalParticipantShare([])).toBe(0);
    });

    it('handles rounding correctly', () => {
      const shares = [
        { email: 'user1@example.com', amount: 33.33 },
        { email: 'user2@example.com', amount: 33.33 },
      ];
      expect(getTotalParticipantShare(shares)).toBe(66.66);
    });
  });

  describe('validateSplitAmounts', () => {
    describe('common validations', () => {
      it('requires at least one participant', () => {
        const errors = validateSplitAmounts('EQUAL', 100, []);
        expect(errors).toContainEqual({
          field: 'participants',
          message: 'At least one participant is required',
        });
      });

      it('requires positive total amount', () => {
        const errors = validateSplitAmounts('EQUAL', 0, [{ email: 'user@example.com' }]);
        expect(errors).toContainEqual({
          field: 'amount',
          message: 'Total amount must be greater than zero',
        });
      });

      it('passes with valid EQUAL split', () => {
        const errors = validateSplitAmounts('EQUAL', 100, [{ email: 'user@example.com' }]);
        expect(errors).toHaveLength(0);
      });
    });

    describe('PERCENTAGE validations', () => {
      it('validates percentage range', () => {
        const errors = validateSplitAmounts('PERCENTAGE', 100, [
          { email: 'user@example.com', percentage: 150 },
        ]);
        expect(errors).toContainEqual(
          expect.objectContaining({
            field: 'percentage',
            message: expect.stringContaining('Invalid percentage'),
          })
        );
      });

      it('validates total percentage does not exceed 100', () => {
        const errors = validateSplitAmounts('PERCENTAGE', 100, [
          { email: 'user1@example.com', percentage: 60 },
          { email: 'user2@example.com', percentage: 50 },
        ]);
        expect(errors).toContainEqual(
          expect.objectContaining({
            field: 'percentage',
            message: expect.stringContaining('cannot exceed 100%'),
          })
        );
      });

      it('passes with valid percentages', () => {
        const errors = validateSplitAmounts('PERCENTAGE', 100, [
          { email: 'user1@example.com', percentage: 30 },
          { email: 'user2@example.com', percentage: 40 },
        ]);
        expect(errors).toHaveLength(0);
      });
    });

    describe('FIXED validations', () => {
      it('validates non-negative amounts', () => {
        const errors = validateSplitAmounts('FIXED', 100, [
          { email: 'user@example.com', fixedAmount: -10 },
        ]);
        expect(errors).toContainEqual(
          expect.objectContaining({
            field: 'amount',
            message: expect.stringContaining('Invalid amount'),
          })
        );
      });

      it('validates total does not exceed expense', () => {
        const errors = validateSplitAmounts('FIXED', 100, [
          { email: 'user1@example.com', fixedAmount: 60 },
          { email: 'user2@example.com', fixedAmount: 50 },
        ]);
        expect(errors).toContainEqual(
          expect.objectContaining({
            field: 'amount',
            message: expect.stringContaining('cannot exceed expense total'),
          })
        );
      });

      it('passes with valid fixed amounts', () => {
        const errors = validateSplitAmounts('FIXED', 100, [
          { email: 'user1@example.com', fixedAmount: 30 },
          { email: 'user2@example.com', fixedAmount: 40 },
        ]);
        expect(errors).toHaveLength(0);
      });
    });
  });

  describe('createSplitPreview', () => {
    it('creates complete preview for EQUAL split', () => {
      const preview = createSplitPreview('EQUAL', 100, [
        { email: 'user1@example.com', displayName: 'User 1' },
        { email: 'user2@example.com', displayName: 'User 2' },
      ]);

      expect(preview.isValid).toBe(true);
      expect(preview.errors).toHaveLength(0);
      expect(preview.participantShares).toHaveLength(2);
      expect(preview.participantShares[0].amount).toBe(33.33);
      expect(preview.totalParticipantAmount).toBe(66.66);
      expect(preview.ownerShare).toBe(33.34);
    });

    it('creates preview for PERCENTAGE split', () => {
      const preview = createSplitPreview('PERCENTAGE', 100, [
        { email: 'user@example.com', percentage: 40 },
      ]);

      expect(preview.isValid).toBe(true);
      expect(preview.participantShares[0].amount).toBe(40);
      expect(preview.totalParticipantAmount).toBe(40);
      expect(preview.ownerShare).toBe(60);
    });

    it('creates preview for FIXED split', () => {
      const preview = createSplitPreview('FIXED', 100, [
        { email: 'user@example.com', fixedAmount: 35 },
      ]);

      expect(preview.isValid).toBe(true);
      expect(preview.participantShares[0].amount).toBe(35);
      expect(preview.totalParticipantAmount).toBe(35);
      expect(preview.ownerShare).toBe(65);
    });

    it('returns invalid preview with errors', () => {
      const preview = createSplitPreview('PERCENTAGE', 100, [
        { email: 'user@example.com', percentage: 150 },
      ]);

      expect(preview.isValid).toBe(false);
      expect(preview.errors.length).toBeGreaterThan(0);
    });

    it('handles no participants', () => {
      const preview = createSplitPreview('EQUAL', 100, []);

      expect(preview.isValid).toBe(false);
      expect(preview.ownerShare).toBe(100);
      expect(preview.participantShares).toHaveLength(0);
      expect(preview.totalParticipantAmount).toBe(0);
    });
  });

  describe('distributeRoundingError', () => {
    it('adjusts first share to match target', () => {
      const shares = [33.33, 33.33];
      const adjusted = distributeRoundingError(100, shares);

      const total = adjusted.reduce((sum, s) => sum + s, 0);
      expect(roundToTwoDecimals(total)).toBe(100);
    });

    it('returns original shares when already correct', () => {
      const shares = [50, 50];
      const adjusted = distributeRoundingError(100, shares);

      expect(adjusted).toEqual([50, 50]);
    });

    it('handles empty array', () => {
      const adjusted = distributeRoundingError(100, []);
      expect(adjusted).toEqual([]);
    });

    it('handles single share', () => {
      const adjusted = distributeRoundingError(100, [99.99]);
      expect(adjusted[0]).toBe(100);
    });
  });
});
