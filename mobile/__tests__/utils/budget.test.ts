import { getBudgetProgress, isBudgetOver } from '../../src/utils/budget'

describe('getBudgetProgress', () => {
  describe('normal cases', () => {
    it('returns correct progress when under budget', () => {
      expect(getBudgetProgress(100, 50)).toBe(0.5)
    })

    it('returns 1 when exactly at budget', () => {
      expect(getBudgetProgress(100, 100)).toBe(1)
    })

    it('caps progress at 1 when over budget', () => {
      expect(getBudgetProgress(100, 150)).toBe(1)
    })

    it('returns 0 when no spending', () => {
      expect(getBudgetProgress(100, 0)).toBe(0)
    })

    it('handles fractional progress', () => {
      expect(getBudgetProgress(100, 33)).toBeCloseTo(0.33)
    })
  })

  describe('planned <= 0 edge cases', () => {
    it('returns 1 when planned is 0 but has spending', () => {
      expect(getBudgetProgress(0, 50)).toBe(1)
    })

    it('returns 0 when planned is 0 and no spending', () => {
      expect(getBudgetProgress(0, 0)).toBe(0)
    })

    it('returns 1 when planned is negative but has spending', () => {
      expect(getBudgetProgress(-100, 50)).toBe(1)
    })

    it('returns 0 when planned is negative and no spending', () => {
      expect(getBudgetProgress(-100, 0)).toBe(0)
    })
  })

  describe('negative actual edge cases', () => {
    it('clamps negative actual to 0 progress', () => {
      expect(getBudgetProgress(100, -50)).toBe(0)
    })
  })
})

describe('isBudgetOver', () => {
  describe('normal cases', () => {
    it('returns false when under budget', () => {
      expect(isBudgetOver(100, 50)).toBe(false)
    })

    it('returns false when exactly at budget', () => {
      expect(isBudgetOver(100, 100)).toBe(false)
    })

    it('returns true when over budget', () => {
      expect(isBudgetOver(100, 150)).toBe(true)
    })

    it('returns false when no spending', () => {
      expect(isBudgetOver(100, 0)).toBe(false)
    })
  })

  describe('planned <= 0 edge cases', () => {
    it('returns true when planned is 0 but has spending', () => {
      expect(isBudgetOver(0, 50)).toBe(true)
    })

    it('returns false when planned is 0 and no spending', () => {
      expect(isBudgetOver(0, 0)).toBe(false)
    })

    it('returns true when planned is negative but has spending', () => {
      expect(isBudgetOver(-100, 50)).toBe(true)
    })

    it('returns false when planned is negative and no spending', () => {
      expect(isBudgetOver(-100, 0)).toBe(false)
    })
  })
})
